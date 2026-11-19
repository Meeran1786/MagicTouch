#!/usr/bin/env node
// Checks every activity file before it goes on the wall:
//   node tools/check-activities.js        (run from the webcam folder)
// Fails (exit 1) on: a file missing from index.json or listed but missing, duplicate ids,
// an unknown template, missing fields, an unknown concept, or a bad status.
const fs = require('fs'), path = require('path');
const POC = path.join(__dirname, '..', 'poc');
const ACT = path.join(POC, 'activities');
const errors = [], warnings = [];
const err = (f, m) => errors.push(f + ': ' + m), warn = (f, m) => warnings.push(f + ': ' + m);

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(path.relative(POC, p), 'not valid JSON (' + e.message + ')'); return null; } }

const templates = fs.readdirSync(path.join(POC, 'js', 'templates')).filter(f => f.endsWith('.js'))
  .map(f => (fs.readFileSync(path.join(POC, 'js', 'templates', f), 'utf8').match(/MT\.templates\.(\w+)\s*=/) || [])[1]).filter(Boolean);
const concepts = new Set(((readJSON(path.join(POC, 'data', 'concepts.json')) || {}).concepts || []).map(c => c.id));

// fields each template reads from the activity file
const NEEDS = {
  sort: ['bins', 'items'], match: ['pairs'], order: ['items'], label: ['scene', 'targets'],
  explore: ['scene', 'hotspots'], simulate: ['model', 'sliders', 'goals'], space3d: ['scene'],
  reveal: ['scene', 'targets'], ball: ['rounds'], quiz: ['questions'], map: ['scene', 'regions'], pack: ['steps'],
};
const X = require(path.join(POC, 'js', 'expr.js'));
const STEP_COMMON = ['template', 'instruction'];

// checks that look inside a template's data; f = file name, where = "" or " step 2"
function deep(f, a, where, allActs) {
  const e = m => err(f, (where ? where.trim() + ': ' : '') + m);
  if (a.template && !templates.includes(a.template)) e('unknown template "' + a.template + '"');
  (NEEDS[a.template] || []).forEach(k => { if (a[k] === undefined) e('template "' + a.template + '" needs "' + k + '"'); });
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
const COMMON = ['id', 'grade', 'subject', 'title', 'template', 'concept', 'status', 'instruction'];
const SUBJECTS = ['maths', 'science', 'social', 'evs'], STATUS = ['draft', 'review', 'approved'];

const index = readJSON(path.join(ACT, 'index.json')) || [];
const files = fs.readdirSync(ACT).filter(f => f.endsWith('.json') && f !== 'index.json');
files.filter(f => !index.includes(f)).forEach(f => err(f, 'not listed in index.json, so it never shows in the menu'));
index.filter(f => !files.includes(f)).forEach(f => err('index.json', 'lists ' + f + ' but the file does not exist'));

const ids = {}, byId = {};
index.filter(f => files.includes(f)).forEach(f => { const a = readJSON(path.join(ACT, f)); if (a && a.id) byId[a.id] = a; });
index.filter(f => files.includes(f)).forEach(f => {
  const a = readJSON(path.join(ACT, f)); if (!a) return;
  COMMON.forEach(k => { if (a[k] === undefined || a[k] === '') err(f, 'missing "' + k + '"'); });
  if (a.id) { if (ids[a.id]) err(f, 'id "' + a.id + '" is also used by ' + ids[a.id]); ids[a.id] = f; }
  deep(f, a, '', byId);
  if (a.subject && !SUBJECTS.includes(a.subject)) err(f, 'subject must be one of ' + SUBJECTS.join(', '));
  if (a.grade !== undefined && !(Number.isInteger(a.grade) && a.grade >= 0 && a.grade <= 12)) err(f, 'grade must be a whole number 0–12');
  if (a.status && !STATUS.includes(a.status)) err(f, 'status must be one of ' + STATUS.join(', '));
  if (a.concept && !concepts.has(a.concept)) err(f, 'concept "' + a.concept + '" is not in data/concepts.json');
  if (!a.doneText) warn(f, 'no "doneText" (the finish message)');
  if (/\bNCERT\b/i.test(JSON.stringify(a))) warn(f, 'mentions NCERT: content must be our own, at most "aligned to learning outcomes"');
});

const approved = index.map(f => files.includes(f) && readJSON(path.join(ACT, f))).filter(a => a && a.status === 'approved').length;
warnings.forEach(w => console.log('warning  ' + w));
errors.forEach(e => console.log('ERROR    ' + e));
console.log(`${index.length} activities checked, ${approved} approved, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
