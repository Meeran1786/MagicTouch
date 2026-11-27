#!/usr/bin/env node
// Copies the Twemoji pictures the wall needs (card pictures, remote list, charts) into
// public/vendor/twemoji/svg, so the wall works offline and every PC shows the same art.
//   npm pack @twemoji/svg@15.0.0 && tar xzf twemoji-svg-15.0.0.tgz
//   node tools/twemoji.js <unpacked package dir>      copy what is missing
//   node tools/twemoji.js --check                      fail if a picture is missing
//   node tools/twemoji.js --prune                      delete pictures nothing uses
// Twemoji graphics: CC BY 4.0 (c) Twitter, Inc and other contributors (see vendor/LICENSE.md).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MASCOTS } from "../server/api.js";
import { ICONS } from "../public/shared/catalog.js";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(APP, "public/vendor/twemoji/svg");
const icons = new Set([...ICONS, ...MASCOTS]);
// Every emoji an activity names: its own icon and its items' pictures.
const actDir = path.join(APP, "public/activities");
for (const id of fs.readdirSync(actDir)) {
  const f = path.join(actDir, id, "activity.json");
  if (!fs.existsSync(f)) continue;
  JSON.stringify(JSON.parse(fs.readFileSync(f, "utf8"))).replace(/"(?:icon|emoji)":"([^"]+)"/g, (_, e) => {
    const v = JSON.parse('"' + e + '"');
    for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(v))
      if (/\p{Extended_Pictographic}/u.test(segment)) icons.add(segment);
  });
}
const code = (e) =>
  Array.from(e)
    .map((c) => c.codePointAt(0))
    .filter((c) => c !== 0xfe0f)
    .map((c) => c.toString(16))
    .join("-");
const withFe0f = (e) =>
  Array.from(e)
    .map((c) => c.codePointAt(0).toString(16))
    .join("-");

const check = process.argv[2] === "--check";
const src = check || process.argv[2] === "--prune" ? null : process.argv[2];
const missing = [];
let copied = 0;
for (const e of icons) {
  const name = code(e) + ".svg",
    dest = path.join(OUT, name);
  if (fs.existsSync(dest)) continue;
  if (check) {
    missing.push(`${e} ${name}`);
    continue;
  }
  const from =
    [name, withFe0f(e) + ".svg"].map((n) => path.join(src, n)).find((p) => fs.existsSync(p)) ||
    [name, withFe0f(e) + ".svg"].map((n) => path.join(src, "svg", n)).find((p) => fs.existsSync(p));
  if (!from) {
    missing.push(`${e} ${name}`);
    continue;
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(from, dest);
  copied++;
}
// --prune: delete pictures nothing uses any more
let pruned = 0;
if (process.argv.includes("--prune")) {
  const used = new Set([...icons].map((e) => code(e) + ".svg"));
  for (const f of fs.readdirSync(OUT))
    if (!used.has(f)) {
      fs.unlinkSync(path.join(OUT, f));
      pruned++;
    }
}
console.log(
  `${icons.size} pictures used; ${copied} copied; ${missing.length} missing${pruned ? `; ${pruned} unused removed` : ""}.`,
);
if (missing.length) {
  console.log("  missing: " + missing.join(", "));
  process.exit(1);
}
