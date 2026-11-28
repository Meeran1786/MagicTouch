#!/usr/bin/env node
// Gives every picture, card, hotspot, region and puppet a real-world theme sound when one exists
// for its word ("Cow" → "sfx": "cow", "Auto Rickshaw" → "sfx": "auto-rickshaw"), so no animal,
// vehicle, machine or instrument in any activity is silent.
//
//   node tools/attach-sfx.js           add the missing "sfx" fields (and print what was added)
//   node tools/attach-sfx.js --check   only report items that have a sound but no "sfx" (exit 1)
//
// A word has a sound when public/assets/sfx/themes/ has a file of that name, aliases.json maps the
// name to a file, or shared/theme-synth.js makes it in code. An item that should stay silent says
// "sfx": "" (the field is then left alone). Names are the word in lower case, with dashes for
// spaces and anything in brackets left out ("Vegetable (V2)" → "vegetable").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(APP, "public");
const THEMES = path.join(PUB, "assets", "sfx", "themes");
const CHECK = process.argv.includes("--check");

const { synthTheme } = await import(pathToFileURL(path.join(PUB, "shared", "theme-synth.js")).href);
const files = new Set(
  fs
    .readdirSync(THEMES)
    .filter((f) => /\.(ogg|mp3|wav)$/i.test(f))
    .map((f) => f.replace(/\.[^.]+$/, "").toLowerCase()),
);
const aliases = JSON.parse(fs.readFileSync(path.join(THEMES, "aliases.json"), "utf8")).aliases || {};
const hasSound = (n) => files.has(n) || files.has(aliases[n]) || !!synthTheme(n);
const slug = (w) =>
  String(w || "")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// the lists whose entries a template plays a theme sound for, and the field that names the entry
const LISTS = ["items", "targets", "regions", "puppets", "animals", "hotspots"];
const nameOf = (o) => o.word || o.label || o.name;
// templates that read an entry's "sfx" (see engine/templates/*.js)
const TEMPLATES = new Set([
  "picture-chart",
  "picture-reveal",
  "picture-quiz",
  "picture-spotter",
  "emoji-quiz",
  "word-wheel",
  "explore",
  "reveal",
  "map",
  "shadow-puppet",
  "animal-3d",
]);

const actDir = path.join(PUB, "activities");
let added = 0;
const missing = [];
for (const id of fs.readdirSync(actDir).sort()) {
  const f = path.join(actDir, id, "activity.json");
  if (!fs.existsSync(f)) continue;
  const a = JSON.parse(fs.readFileSync(f, "utf8"));
  if (!TEMPLATES.has(a.template)) continue;
  let changed = false;
  for (const key of LISTS) {
    if (!Array.isArray(a[key])) continue;
    a[key] = a[key].map((o) => {
      if (!o || typeof o !== "object" || "sfx" in o) return o;
      const n = slug(nameOf(o));
      if (!n || !hasSound(n)) return o;
      missing.push(`${id}: ${nameOf(o)} → ${n}`);
      if (CHECK) return o;
      changed = true;
      added++;
      // keep "sfx" next to the entry's name
      const out = {};
      for (const [k, v] of Object.entries(o)) {
        out[k] = v;
        if (k === "word" || k === "label" || k === "name") out.sfx = n;
      }
      if (!("sfx" in out)) out.sfx = n;
      return out;
    });
  }
  if (changed) fs.writeFileSync(f, JSON.stringify(a, null, 2) + "\n");
}
if (CHECK) {
  if (missing.length) {
    console.error(`${missing.length} entries have a theme sound but no "sfx" (run node tools/attach-sfx.js):`);
    console.error("  " + missing.join("\n  "));
    process.exit(1);
  }
  console.log('Theme sounds: every entry that has a sound names it ("sfx").');
} else console.log(`Added "sfx" to ${added} entries:\n  ` + missing.join("\n  "));
