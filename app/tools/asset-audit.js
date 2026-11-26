#!/usr/bin/env node
// Lists every picture, sound and 3D model in the wall app with its licence status,
// and fails if any file carries a stock-library marker (watermark text or metadata).
//
//   node tools/asset-audit.js           write ASSETS-AUDIT.csv
//   node tools/asset-audit.js --check   only check, exit 1 on a stock marker
//
// Status values:
//   original-magictouch  drawn or generated for MagicTouch (tools/art, generated audio)
//   bundled-library      open-source library files (see public/vendor/LICENSE.md)
//   purchased-unverified came with the purchased Interactive Wall code; the IP assignment
//                        covers Basha's own work, but the source of stock-looking media
//                        must be confirmed with him before a public release
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(APP, "public");
const MEDIA = /\.(jpe?g|png|gif|webp|svg|mp3|wav|ogg|m4a|glb|gltf|bin|mp4|webm)$/i;
const STOCK = /adobe stock|stock\.adobe|vecteezy|rawpixel|shutterstock|istockphoto|gettyimages|freepik|dreamstime|depositphotos|123rf|alamy|pngtree|epic stock|leenalecklin|envato|audiojungle/i;
const ORIGINAL = new Set([
  "apps/gardenspotter4/images/V3.jpg", "apps/gardenlang4/images/V3.jpg", "apps/fruitsafari4/assets/photos/V3.jpg", "apps/fruitquiz4/assets/photos/V3.jpg", "apps/fruitsafari4/assets/bw/V3.png",
  "apps/gardenspotter3/images/Pista.jpg", "apps/gardenlang3/images/Pista.jpg", "apps/fruitsafari5/assets/photos/Pista.jpg", "apps/fruitquiz5/assets/photos/Pista.jpg", "apps/fruitsafari5/assets/bw/Pista.png",
  "apps/gardenspotter2/images/Ice.jpg", "apps/gardenlang2/images/Ice.jpg", "apps/fruitsafari3/assets/photos/Ice.jpg", "apps/fruitquiz3/assets/photos/Ice.jpg", "apps/fruitsafari3/assets/bw/Ice.png",
  "apps/fruitsafari1/assets/photos/BlueBerry.jpg", "apps/fruitquiz1/assets/photos/BlueBerry.jpg", "apps/fruitsafari1/assets/bw/BlueBerry.png",
  "apps/animallang1/images/Deer.jpg", "apps/junglesafari5/assets/gifs/P1.gif", "apps/junglesafari5/assets/bw/P1.png",
  "apps/music/drum.wav",
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (MEDIA.test(e.name)) out.push(p);
  }
  return out;
}

const rows = [["file", "bytes", "sha256", "status", "note"]];
const flagged = [];
for (const f of walk(PUB)) {
  const rel = path.relative(PUB, f).split(path.sep).join("/");
  const buf = fs.readFileSync(f);
  const m = STOCK.exec(buf.toString("latin1"));
  let status = rel.startsWith("vendor/") ? "bundled-library" : ORIGINAL.has(rel) ? "original-magictouch" : "purchased-unverified";
  let note = status === "original-magictouch" ? (rel.endsWith(".wav") ? "generated sound (tools: python synth)" : "drawn for MagicTouch (tools/art)") : "";
  if (m) { flagged.push(`${rel}: "${m[0]}"`); note = "STOCK MARKER: " + m[0]; }
  rows.push([rel, buf.length, crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16), status, note]);
}
if (!process.argv.includes("--check")) {
  fs.writeFileSync(path.join(APP, "ASSETS-AUDIT.csv"), rows.map(r => r.map(c => /[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(",")).join("\n") + "\n");
}
const count = s => rows.filter(r => r[3] === s).length;
console.log(`${rows.length - 1} media files: ${count("original-magictouch")} original, ${count("bundled-library")} library, ${count("purchased-unverified")} purchased (source to confirm).`);
if (flagged.length) { console.log("Stock-library markers found:\n  " + flagged.join("\n  ")); process.exit(1); }
console.log("No stock-library markers found.");
