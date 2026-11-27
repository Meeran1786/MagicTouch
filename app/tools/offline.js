#!/usr/bin/env node
// The wall runs with no internet. This fails if any page, script, style or activity file
// (outside the bundled libraries in public/vendor) would load something from the internet.
//
//   node tools/offline.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
// a URL that the browser would fetch: src/href attributes, imports, CSS url(), fetch()
const EXTERNAL =
  /(?:src|href)\s*=\s*["'](?:https?:)?\/\/|from\s+["']https?:\/\/|import\(\s*["']https?:\/\/|url\(\s*["']?(?:https?:)?\/\/|fetch\(\s*["']https?:\/\/|"(?:file|photo|cover|audio|src|sound|video|image|poster|layer)"\s*:\s*"https?:\/\//;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "vendor") walk(p, out);
    } else if (/\.(html|js|mjs|css|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

const found = [];
for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f);
  fs.readFileSync(f, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (EXTERNAL.test(line) && !/^\s*(\/\/|\*|<!--)/.test(line)) found.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
    });
}
if (found.length) {
  console.log("These load from the internet:\n  " + found.join("\n  "));
  process.exit(1);
}
console.log("Offline: nothing loads from the internet.");
