#!/usr/bin/env node
// Makes every activity load its libraries and fonts from this app instead of the
// internet, and links the Studio theme into every activity page.
// Safe to run again: it only changes what still needs changing.
//
//   node tools/localize.js          rewrite files
//   node tools/localize.js --check  exit 1 if anything still points at the internet
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const CHECK = process.argv.includes("--check");
const THEME = '<link rel="stylesheet" href="/shared/studio/studio-theme.css" data-mt-theme>';
const BOOT = '<script src="/shared/studio/wall-boot.js" data-mt-boot></script>';

const SWAPS = [
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/p5\.js\/1\.9\.[04]\/p5\.min\.js/g, "/vendor/p5/p5.min.js"],
  [/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/0\.147\.0\/three\.min\.js/g, "/vendor/three-r147/three.min.js"],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/examples\/js\/loaders\/GLTFLoader\.js/g, "/vendor/three-r147/GLTFLoader.js"],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@0\.10\.14\/vision_bundle\.mjs/g, "/vendor/mediapipe-tasks/vision_bundle.mjs"],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@0\.10\.14\/wasm/g, "/vendor/mediapipe-tasks/wasm"],
  [/https:\/\/storage\.googleapis\.com\/mediapipe-models\/hand_landmarker\/hand_landmarker\/float16\/1\/hand_landmarker\.task/g, "/vendor/mediapipe-tasks/hand_landmarker.task"],
  [/https:\/\/cdn\.jsdelivr\.net\/gh\/jdecked\/twemoji@15\.1\.0\/assets/g, "/vendor/twemoji"],
  [/TWEMOJI_BASE \+ '\/72x72\/'  \+ _emojiCode\(emoji\) \+ '\.png'/g, "TWEMOJI_BASE + '/svg/' + _emojiCode(emoji) + '.svg'"],
  // Google Fonts: the Studio theme bundles the fonts and maps the old family names.
  [/[ \t]*<link[^>]*href="https:\/\/fonts\.(googleapis|gstatic)\.com[^"]*"[^>]*>[ \t]*\r?\n?/g, ""],
  [/@import url\(['"]?https:\/\/fonts\.googleapis\.com[^)]*\);?\s*/g, ""],
];

// External URLs that are fine to leave: comments/docs inside bundled libraries.
const EXTERNAL = /(?:src|href)\s*=\s*["']https?:\/\/|from\s+["']https?:\/\/|import\(\s*["']https?:\/\/|url\(\s*["']?https?:\/\/|["']https:\/\/(?:cdn|cdnjs|unpkg|storage\.googleapis|fonts\.)[^"']*["']/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["vendor", "libraries", "node_modules"].includes(e.name)) walk(p, out); }
    else if (/\.(html|js|mjs|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

let changed = 0, themed = 0;
const leftovers = [];
for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f);
  let s = fs.readFileSync(f, "utf8"), o = s;
  for (const [re, to] of SWAPS) s = s.replace(re, to);
  // Theme every activity page (not the launcher, which has its own Studio CSS).
  if (/^apps\/[^/]+\/index\.html$/.test(rel) && !s.includes("data-mt-theme")) {
    s = s.replace(/<\/head>/i, `  ${THEME}\n</head>`); themed++;
  }
  // The boot script must run before the activity's own scripts (it can stand in for the camera).
  if (/^apps\/[^/]+\/index\.html$/.test(rel) && !s.includes("data-mt-boot")) {
    s = s.replace(/<head([^>]*)>/i, m => `${m}\n  ${BOOT}`);
  }
  if (s !== o) { changed++; if (!CHECK) fs.writeFileSync(f, s); }
  s.split("\n").forEach((line, i) => {
    if (EXTERNAL.test(line) && !/^\s*(\/\/|\*|<!--)/.test(line) && !/developer\.mozilla|p5js\.org|github\.com/.test(line)) leftovers.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
  });
}
console.log(`${CHECK ? "Would change" : "Changed"} ${changed} files; theme linked into ${themed} activities.`);
if (leftovers.length) { console.log("Still loading from the internet:\n  " + leftovers.join("\n  ")); }
process.exit(CHECK && (changed || leftovers.length) ? 1 : 0);
