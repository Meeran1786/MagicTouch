#!/usr/bin/env node
// Copies the Twemoji pictures the wall needs (card pictures, remote list, charts) into
// public/vendor/twemoji/svg, so the wall works offline and every PC shows the same art.
//   npm pack @twemoji/svg@15.0.0 && tar xzf twemoji-svg-15.0.0.tgz
//   node tools/twemoji.js <unpacked package dir>      copy what is missing
//   node tools/twemoji.js --check                      fail if a picture is missing
// Twemoji graphics: CC BY 4.0 (c) Twitter, Inc and other contributors (see vendor/LICENSE.md).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { MASCOTS } from "../server/api.js";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(APP, "public/vendor/twemoji/svg");
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ["public/apps.js", "public/catalog.js"]) vm.runInContext(fs.readFileSync(path.join(APP, f), "utf8"), ctx);
const icons = new Set([...(ctx.window.WALL_APPS || []).map(a => a.icon), ...ctx.window.MTCatalog.ICONS, ...MASCOTS]);
// Engine activities may name their own picture.
const actDir = path.resolve(APP, "../webcam/poc/activities");
for (const f of fs.readdirSync(actDir).filter(f => f.endsWith(".json") && f !== "index.json")) {
  const a = JSON.parse(fs.readFileSync(path.join(actDir, f), "utf8"));
  if (a.icon) icons.add(a.icon);
}
const code = e => Array.from(e).map(c => c.codePointAt(0)).filter(c => c !== 0xfe0f).map(c => c.toString(16)).join("-");
const withFe0f = e => Array.from(e).map(c => c.codePointAt(0).toString(16)).join("-");

const check = process.argv[2] === "--check";
const src = check ? null : process.argv[2];
let missing = [], copied = 0;
for (const e of icons) {
  const name = code(e) + ".svg", dest = path.join(OUT, name);
  if (fs.existsSync(dest)) continue;
  if (check) { missing.push(`${e} ${name}`); continue; }
  const from = [name, withFe0f(e) + ".svg"].map(n => path.join(src, n)).find(p => fs.existsSync(p))
    || [name, withFe0f(e) + ".svg"].map(n => path.join(src, "svg", n)).find(p => fs.existsSync(p));
  if (!from) { missing.push(`${e} ${name}`); continue; }
  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(from, dest); copied++;
}
console.log(`${icons.size} pictures used; ${copied} copied; ${missing.length} missing.`);
if (missing.length) { console.log("  missing: " + missing.join(", ")); process.exit(1); }
