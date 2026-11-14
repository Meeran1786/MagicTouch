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
  reveal: ['scene', 'targets'], ball: ['rounds'],
};
const COMMON = ['id', 'grade', 'subject', 'title', 'template', 'concept', 'status', 'instruction'];
const SUBJECTS = ['maths', 'science', 'social', 'evs'], STATUS = ['draft', 'review', 'approved'];

const index = readJSON(path.join(ACT, 'index.json')) || [];
const files = fs.readdirSync(ACT).filter(f => f.endsWith('.json') && f !== 'index.json');
files.filter(f => !index.includes(f)).forEach(f => err(f, 'not listed in index.json, so it never shows in the menu'));
index.filter(f => !files.includes(f)).forEach(f => err('index.json', 'lists ' + f + ' but the file does not exist'));

const ids = {};
index.filter(f => files.includes(f)).forEach(f => {
  const a = readJSON(path.join(ACT, f)); if (!a) return;
  COMMON.forEach(k => { if (a[k] === undefined || a[k] === '') err(f, 'missing "' + k + '"'); });
  if (a.id) { if (ids[a.id]) err(f, 'id "' + a.id + '" is also used by ' + ids[a.id]); ids[a.id] = f; }
  if (a.template && !templates.includes(a.template)) err(f, 'unknown template "' + a.template + '" (have: ' + templates.join(', ') + ')');
  (NEEDS[a.template] || []).forEach(k => { if (a[k] === undefined) err(f, 'template "' + a.template + '" needs "' + k + '"'); });
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
