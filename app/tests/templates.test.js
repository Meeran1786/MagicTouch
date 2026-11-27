// Every template keeps the engine's contract (see CODE-STANDARD.md): an ES module with a
// default export mount(area, activity, ctx) and a meta object, styles that exist, and no
// library the stack does not allow.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const DIR = path.join(PUB, "engine/templates");
const templates = fs.readdirSync(DIR).filter((f) => f.endsWith(".js"));

test("every template has a default mount function and a meta object", () => {
  for (const f of templates) {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    assert.match(src, /export default function \w+\(area, /, f);
    assert.match(src, /export const meta = \{/, f);
    assert.match(src, /^\/\/ .+\n(\/\/.*\n)*/, `${f} starts with a comment saying what it is and its data`);
  }
});

test("every style a template asks for exists", () => {
  for (const f of templates) {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    const styles = (src.match(/styles: \[([^\]]*)\]/) || ["", ""])[1].match(/"[^"]+"/g) || [];
    for (const s of styles) assert.ok(fs.existsSync(path.join(DIR, JSON.parse(s) + ".css")), `${f}: ${s}.css`);
  }
});

test("no frameworks or retired libraries anywhere in our code", () => {
  const banned = /\b(p5|ml5|jquery|react|vue|tailwind)(\.min)?\.js\b|from ["'](react|vue)["']|createCanvas\(|new p5\(/i;
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) return e.name === "vendor" ? [] : walk(p);
      return /\.(js|html)$/.test(e.name) ? [p] : [];
    });
  for (const f of walk(PUB)) assert.doesNotMatch(fs.readFileSync(f, "utf8"), banned, path.relative(PUB, f));
});

test("every template used by an activity exists, and every template is used", () => {
  const index = JSON.parse(fs.readFileSync(path.join(PUB, "activities/index.json"), "utf8"));
  const names = new Set(templates.map((f) => f.slice(0, -3)));
  const used = new Set(index.map((a) => a.template));
  for (const t of used) assert.ok(names.has(t), `missing template ${t}`);
  // pack steps load other templates by name, so a template may be used only inside packs
  const packs = fs
    .readdirSync(path.join(PUB, "activities"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => fs.readFileSync(path.join(PUB, "activities", e.name, "activity.json"), "utf8"))
    .join("\n");
  for (const t of names) assert.ok(used.has(t) || packs.includes(`"template": "${t}"`), `unused template ${t}`);
});
