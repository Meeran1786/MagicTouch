#!/usr/bin/env node
// Every activity is a folder public/activities/<id>/ holding activity.json and its own
// pictures and sounds. This tool checks them all and writes the list the menus read.
//
//   node tools/activities.js           check every activity, and rewrite activities/index.json
//   node tools/activities.js --check   check only; also fails if index.json is out of date
//
// Fails on: a bad or missing field, an unknown template, a file an activity names that is
// not there, a duplicate id, an unknown concept, a bad status.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MTExpr as X } from "../public/engine/js/expr.js";
import { LEVEL_KEYS } from "../public/shared/levels.js";

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const ACT = path.join(PUBLIC, "activities");
const TEMPLATES = path.join(PUBLIC, "engine", "templates");
const CHECK = process.argv.includes("--check");
const errors = [], warnings = [];
const err = (f, m) => errors.push(f + ": " + m), warn = (f, m) => warnings.push(f + ": " + m);

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { err(path.relative(PUBLIC, p), "not valid JSON (" + e.message + ")"); return null; }
}

const templates = fs.readdirSync(TEMPLATES).filter(f => f.endsWith(".js")).map(f => f.slice(0, -3));
const concepts = new Set(((readJSON(path.join(PUBLIC, "engine", "data", "concepts.json")) || {}).concepts || []).map(c => c.id));

// fields each template reads from the activity file
const NEEDS = {
  sort: ["bins", "items"], match: ["pairs"], order: ["items"], label: ["scene", "targets"],
  explore: ["scene", "hotspots"], simulate: ["model", "sliders", "goals"], space3d: ["scene"],
  reveal: ["scene", "targets"], ball: ["rounds"], quiz: ["questions"], map: ["scene", "regions"], pack: ["steps"],
  "emoji-quiz": ["items"], "picture-chart": ["items"], "picture-spotter": ["items"], "word-wheel": ["items"],
  "picture-quiz": ["items"], "picture-reveal": ["items"], "count-pick": ["fruits"],
};
const STEP_COMMON = ["template", "instruction"];

// checks that look inside a template's data; f = file name, where = "" or " step 2"
function deep(f, a, where, allActs) {
  const e = m => err(f, (where ? where.trim() + ': ' : '') + m);
  if (a.template && !templates.includes(a.template)) e('unknown template "' + a.template + '"');
  (NEEDS[a.template] || []).forEach(k => { if (a[k] === undefined) e('template "' + a.template + '" needs "' + k + '"'); });
  if (a.template === 'slice' && !a.items && !a.numbers) e('template "slice" needs "items" or "numbers"');
  if (a.template === 'slice') (a.rules || []).forEach(r => { if (!['even', 'odd', 'more', 'less', 'times'].includes(r.kind)) e('slice rule kind "' + r.kind + '" is not one of even, odd, more, less, times'); });
  if (a.template === 'simulate') {
    const names = {}; (a.sliders || []).forEach(s => { names[s.id] = s.value; if (!(s.min < s.max && s.step > 0)) e('slider "' + s.id + '" needs min < max and step > 0'); });
    ({ circuit: ['I'], market: ['D', 'S'] }[a.model] || []).forEach(k => names[k] = 1);
    Object.keys(a.formulas || {}).forEach(k => { try { names[k] = X.expr(a.formulas[k], names); } catch (x) { e('formula ' + k + ': ' + x.message); } });
    const texts = [].concat(a.picture || [], (a.solution || {}).lines || [], (a.solution || {}).note || [],
      ...(a.predict || []).map(p => [p.text, p.explain || '']));
    texts.forEach(t => X.placeholders(t).forEach(ph => { try { X.expr(ph, names); } catch (x) { e('{' + ph + '}: ' + x.message); } }));
    (a.predict || []).forEach((p, i) => {
      if (!Array.isArray(p.options) || !(p.answer >= 0 && p.answer < p.options.length)) e('prediction ' + (i + 1) + ' needs options and an answer index inside them');
      Object.keys(Object.assign({}, p.set, p.then)).forEach(k => { if (!(k in names)) e('prediction ' + (i + 1) + ' sets unknown slider "' + k + '"'); });
    });
    if (a.model === 'formula' && !a.picture && !a.display && !a.formulas) e('model "formula" needs "picture", "display" or "formulas"');
  }
  if (a.template === 'quiz') (a.questions || []).forEach((q, i) => {
    const n = 'question ' + (i + 1);
    if (q.type === 'truefalse') { if (typeof q.answer !== 'boolean') e(n + ': true/false answer must be true or false'); }
    else if (q.type === 'assertion') { if (!q.assertion || !q.reason || !(q.answer >= 0 && q.answer <= 3)) e(n + ': needs assertion, reason and answer 0–3'); }
    else if (!q.q || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 || !(q.answer >= 0 && q.answer < q.options.length)) e(n + ': needs q, 2–4 options and an answer index inside them');
    if (!q.explain) warn(f, (where ? where.trim() + ' ' : '') + n + ' has no "explain" (the reason shown after answering)');
  });
  if (a.template === 'map') {
    (a.regions || []).forEach(r => { if (!String(a.scene || '').includes('data-region="' + r.id + '"')) e('region "' + r.id + '" has no shape with data-region="' + r.id + '" in the scene'); });
    const ids = new Set((a.regions || []).map(r => r.id));
    (a.find || []).forEach((q, i) => { if (!ids.has(q.region)) e('find ' + (i + 1) + ' points to unknown region "' + q.region + '"'); });
    if (/india|bharat/i.test(JSON.stringify(a))) warn(f, 'map mentions India: it must use an official Survey of India outline before it goes to schools');
  }
  if (a.template === 'pack') (a.steps || []).forEach((s, i) => {
    const w = ' step ' + (i + 1);
    let st = s.activity || {};
    if (s.ref) { const base = allActs[s.ref]; if (!base) { err(f, w.trim() + ': ref "' + s.ref + '" is not an activity id'); return; } st = Object.assign({}, base, st); }
    if (st.template === 'pack') { err(f, w.trim() + ': a pack cannot contain another pack'); return; }
    STEP_COMMON.forEach(k => { if (st[k] === undefined || st[k] === '') err(f, w.trim() + ': missing "' + k + '"'); });
    deep(f, st, w, allActs);
  });
}
const CLASS_SUBJECTS = ["maths", "science", "social", "evs"];
const EARLY_SUBJECTS = ["letters", "numbers", "colours", "nature", "play", "world"];
const STATUS = ["draft", "review", "approved"];
const early = a => ["nursery", "prekg", "lkg"].includes(a.level);

// Every media file an activity names must be in its own folder (or be a shared file).
function files(f, dir, a) {
  JSON.stringify(a).replace(/"(?:file|photo|bw|gif|image|audio|src|sound|video)":"([^"]+)"/g, (_, rel) => {
    if (/^(https?:)?\/\//.test(rel)) err(f, "names a file on the internet: " + rel);
    else if (!fs.existsSync(rel.startsWith("/") ? path.join(PUBLIC, rel) : path.join(dir, rel))) err(f, "names a missing file: " + rel);
    return _;
  });
}

const folders = fs.readdirSync(ACT, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
const byId = {};
for (const id of folders) {
  const p = path.join(ACT, id, "activity.json");
  if (!fs.existsSync(p)) { err(id, "folder has no activity.json"); continue; }
  const a = readJSON(p);
  if (a) byId[id] = a;
}
for (const [id, a] of Object.entries(byId)) {
  const f = id + "/activity.json";
  const common = ["id", "level", "subject", "title", "template", "status"].concat(early(a) ? [] : ["concept", "instruction"]);
  common.forEach(k => { if (a[k] === undefined || a[k] === "") err(f, 'missing "' + k + '"'); });
  if (a.id !== id) err(f, 'id "' + a.id + '" must match its folder name "' + id + '"');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err(f, "folder names use lower case letters, digits and dashes");
  if (a.level && !LEVEL_KEYS.includes(a.level)) err(f, "level must be one of " + LEVEL_KEYS.join(", "));
  const subjects = early(a) ? EARLY_SUBJECTS : CLASS_SUBJECTS;
  if (a.subject && !subjects.includes(a.subject)) err(f, "subject must be one of " + subjects.join(", "));
  if (a.status && !STATUS.includes(a.status)) err(f, "status must be one of " + STATUS.join(", "));
  if (a.concept && !concepts.has(a.concept)) err(f, 'concept "' + a.concept + '" is not in engine/data/concepts.json');
  if (!early(a) && !a.doneText) warn(f, 'no "doneText" (the finish message)');
  if (/\bNCERT\b/i.test(JSON.stringify(a))) warn(f, 'mentions NCERT: content must be our own, at most "aligned to learning outcomes"');
  deep(f, a, "", byId);
  files(f, path.join(ACT, id), a);
}

// The list the launcher and the engine menu read: one line per activity.
const ORDER = LEVEL_KEYS;
const list = Object.values(byId)
  .filter(a => a.id && a.level)
  .sort((x, y) => ORDER.indexOf(x.level) - ORDER.indexOf(y.level) || (y.showcase ? 1 : 0) - (x.showcase ? 1 : 0) || String(x.order ?? x.title).localeCompare(String(y.order ?? y.title), "en", { numeric: true }))
  .map(a => Object.fromEntries(Object.entries({
    id: a.id, level: a.level, subject: a.subject, title: a.title, topic: a.topic || "", icon: a.icon || "",
    template: a.template, status: a.status, showcase: a.showcase || undefined,
  }).filter(([, v]) => v !== undefined)));
const indexFile = path.join(ACT, "index.json");
const text = JSON.stringify(list, null, 1) + "\n";
if (CHECK) {
  if (!fs.existsSync(indexFile) || fs.readFileSync(indexFile, "utf8") !== text) err("index.json", "out of date: run node tools/activities.js");
} else fs.writeFileSync(indexFile, text);

const approved = list.filter(a => a.status === "approved").length;
warnings.forEach(w => console.log("warning  " + w));
errors.forEach(e => console.log("ERROR    " + e));
console.log(`${list.length} activities checked, ${approved} approved, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
