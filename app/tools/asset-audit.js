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
//   commons-credited     theme sounds in public/assets/sfx/themes: Wikimedia Commons, credited per file
//   cc0-library          public-domain (CC0) files: the Kenney sound cues in public/assets/sfx
//   generated-voice      voice clips made by scripts/generate-voices.js (Google Cloud TTS)
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
const STOCK =
  /adobe stock|stock\.adobe|vecteezy|rawpixel|shutterstock|istockphoto|gettyimages|freepik|dreamstime|depositphotos|123rf|alamy|pngtree|epic stock|leenalecklin|envato|audiojungle/i;
// Our own files, by the start of their SHA-256 (so they are known wherever they move).
const ORIGINAL = new Map([
  ["06ac3c3fd6701014", "drawn for MagicTouch (tools/art)"], // Deer
  ["fe7549b3ed7c5690", "drawn for MagicTouch (tools/art)"], // Blueberry
  ["24aa0efc25f94963", "drawn for MagicTouch (tools/art)"], // Ice apple
  ["bfa59ea032a38e13", "drawn for MagicTouch (tools/art)"], // V3
  ["d3fb808314c1191f", "drawn for MagicTouch (tools/art)"], // Pista
  ["6758a49d189864d0", "drawn for MagicTouch (tools/art)"], // P1 (jungle safari)
  ["56df5fbb3e8730f0", "generated sound (tools: python synth)"], // drum
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (MEDIA.test(e.name)) out.push(p);
  }
  return out;
}

const rows = [["file", "bytes", "sha256", "status", "note"]];
const flagged = [];
for (const f of walk(PUB)) {
  const rel = path.relative(PUB, f).split(path.sep).join("/");
  const buf = fs.readFileSync(f);
  const m = STOCK.exec(buf.toString("latin1"));
  const sha = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const status = rel.startsWith("vendor/")
    ? "bundled-library"
    : rel.startsWith("assets/sfx/themes/")
      ? "commons-credited"
      : rel.startsWith("assets/sfx/")
        ? "cc0-library"
        : rel.startsWith("assets/voice/")
          ? "generated-voice"
          : ORIGINAL.has(sha)
            ? "original-magictouch"
            : "purchased-unverified";
  let note =
    ORIGINAL.get(sha) ||
    (status === "commons-credited"
      ? "Wikimedia Commons, CC0 / public domain / CC BY / CC BY-SA, author and licence per file (assets/sfx/themes/credits.json)"
      : status === "cc0-library"
        ? "Kenney Interface Sounds 1.0, CC0 (assets/sfx/LICENSE-Kenney.txt)"
        : "") ||
    (status === "generated-voice" ? "Google Cloud Text-to-Speech, scripts/generate-voices.js" : "");
  if (m) {
    flagged.push(`${rel}: "${m[0]}"`);
    note = "STOCK MARKER: " + m[0];
  }
  rows.push([rel, buf.length, sha, status, note]);
}
if (!process.argv.includes("--check")) {
  fs.writeFileSync(
    path.join(APP, "ASSETS-AUDIT.csv"),
    rows
      .map((r) => r.map((c) => (/[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(","))
      .join("\n") + "\n",
  );
}
const count = (s) => rows.filter((r) => r[3] === s).length;
console.log(
  `${rows.length - 1} media files: ${count("original-magictouch")} original, ${count("bundled-library")} library, ${count("cc0-library")} CC0, ${count("commons-credited")} Commons (credited), ${count("generated-voice")} voice clips, ${count("purchased-unverified")} purchased (source to confirm).`,
);
if (flagged.length) {
  console.log("Stock-library markers found:\n  " + flagged.join("\n  "));
  process.exit(1);
}
console.log("No stock-library markers found.");
