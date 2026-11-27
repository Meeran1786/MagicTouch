#!/usr/bin/env node
// MagicTouch offline voice generator. Run once on a PC with internet; the clips it writes play
// on the wall with no internet (shared/audio-engine.js, MagicAudio.speak).
//
//   node scripts/generate-voices.js              make every clip that is missing
//   node scripts/generate-voices.js --dry-run    only count lines and characters (no key needed)
//   options: --lang te-IN   only one language
//            --limit 50     at most 50 new clips this run
//            --lines f.json also speak the lines in f.json ([{ text, lang }], e.g. MagicAudio.misses())
//            --force        make clips again even when the file is already there
//
// Reads GOOGLE_TTS_API_KEY from app/.env (or the repository's .env, or the environment) and calls
// Google Cloud Text-to-Speech. Chirp 3: HD voices exist for en-IN, hi-IN and te-IN (Telugu has no
// Neural2 voice), so one Chirp 3: HD voice speaks all three. Free tier (Google's pricing page,
// checked 2026-11-27): the first 1 million Chirp 3: HD characters each month are free, then US$30
// per million. Billing must be enabled on the Google Cloud project.
//
// What it speaks: every line the templates read aloud from the activity JSON files
// (public/activities/*/activity.json, the SPEAK_KEYS in shared/voice-key.js) plus the templates'
// own fixed words in public/assets/voice/phrases.json.
//
// Free-tier safe:
//   - a clip whose .mp3 is already on disk is skipped (its name is a hash of the text, so a changed
//     line gets a new file; a hand-picked clipId whose text changed is made again)
//   - characters sent are counted per calendar month in data/tts-usage.json; the run stops before
//     the month passes TTS_MONTHLY_LIMIT (default 950000) unless --allow-paid is given
//
// Settings in .env (all optional except the key):
//   GOOGLE_TTS_API_KEY=...          the API key (keep it out of git: .env is git-ignored)
//   TTS_VOICE=Kore                  the Chirp 3: HD voice name used in every language
//   TTS_VOICE_EN_IN=en-IN-Chirp3-HD-Kore   or a full voice name per language
//   TTS_SPEAKING_RATE=0.95          optional pace (1 = normal)
//   TTS_MONTHLY_LIMIT=950000
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(APP, "public");
const VOICE_DIR = path.join(PUB, "assets", "voice");
const MANIFEST = path.join(VOICE_DIR, "manifest.json");
const PHRASES = path.join(VOICE_DIR, "phrases.json");
const USAGE = path.join(APP, "data", "tts-usage.json");
const ENDPOINT = process.env.TTS_ENDPOINT || "https://texttospeech.googleapis.com/v1/text:synthesize";

const { linesOf, normalize, clipId, textHash, langCode, langOf, LANGS } = await import(
  pathToFileURL(path.join(PUB, "shared", "voice-key.js")).href
);

// ── options and settings ────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY = flag("--dry-run");
const FORCE = flag("--force");
const PAID = flag("--allow-paid");
const ONLY = opt("--lang") ? langCode(opt("--lang")) : null;
const LIMIT = opt("--limit") ? Math.max(0, parseInt(opt("--limit"), 10)) : Infinity;

function readEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const v = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
readEnv(path.join(APP, ".env"));
readEnv(path.join(APP, "..", ".env"));
const KEY = process.env.GOOGLE_TTS_API_KEY || "";
const MONTHLY = parseInt(process.env.TTS_MONTHLY_LIMIT || "950000", 10);
const RATE = process.env.TTS_SPEAKING_RATE ? parseFloat(process.env.TTS_SPEAKING_RATE) : null;
function voiceFor(lang) {
  const own = process.env["TTS_VOICE_" + lang.replace("-", "_").toUpperCase()];
  return own || `${lang}-Chirp3-HD-${process.env.TTS_VOICE || "Kore"}`;
}

// ── what to speak ───────────────────────────────────────────────────────
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
const wanted = new Map(); // lang|id → { text, lang, id, from }
function want(text, lang, from, id) {
  const t = normalize(text);
  if (!t || !/[\p{L}\p{N}]/u.test(t)) return;
  const l = lang ? langCode(lang) : langOf(t, "en-IN");
  if (ONLY && l !== ONLY) return;
  const cid = id || clipId(t, l);
  if (!wanted.has(l + "|" + cid)) wanted.set(l + "|" + cid, { text: t, lang: l, id: cid, from });
}
const actDir = path.join(PUB, "activities");
let activities = 0;
for (const name of fs.readdirSync(actDir).sort()) {
  const f = path.join(actDir, name, "activity.json");
  if (!fs.existsSync(f)) continue;
  activities++;
  for (const l of linesOf(readJson(f, {}))) want(l.text, l.lang, name);
}
const phrases = readJson(PHRASES, {});
for (const [lang, list] of Object.entries(phrases)) {
  if (Array.isArray(list)) list.forEach((t) => want(t, LANGS.includes(lang) ? lang : null, "phrases"));
}
if (opt("--lines")) {
  const extra = readJson(path.resolve(opt("--lines")), []);
  (Array.isArray(extra) ? extra : []).forEach((x) => x && want(x.text, x.lang, "lines"));
}

// ── what is already there ───────────────────────────────────────────────
const manifest = readJson(MANIFEST, {});
manifest.voices = manifest.voices || {};
manifest.clips = manifest.clips || {};
for (const l of LANGS) manifest.clips[l] = manifest.clips[l] || {};

const todo = [];
let skippedChars = 0,
  skipped = 0;
for (const w of wanted.values()) {
  const file = path.join(VOICE_DIR, w.lang, w.id + ".mp3");
  const known = manifest.clips[w.lang][w.id];
  const same = !known || !known.h || known.h === textHash(w.text);
  if (!FORCE && fs.existsSync(file) && same) {
    skipped++;
    skippedChars += w.text.length;
    if (!known) manifest.clips[w.lang][w.id] = { t: w.text, h: textHash(w.text), v: "recorded" };
    continue;
  }
  todo.push(w);
}
// any clip file on disk (hand-recorded ones too) is listed, so the wall knows it can play it
for (const l of LANGS) {
  const dir = path.join(VOICE_DIR, l);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const id = f.replace(/\.mp3$/, "");
    if (f.endsWith(".mp3") && !manifest.clips[l][id]) manifest.clips[l][id] = { t: "", h: "", v: "recorded" };
  }
  for (const id of Object.keys(manifest.clips[l]))
    if (!fs.existsSync(path.join(dir, id + ".mp3"))) delete manifest.clips[l][id];
}

const usage = readJson(USAGE, {});
const month = new Date().toISOString().slice(0, 7);
let usedThisMonth = usage[month] || 0;
const batch = todo.slice(0, LIMIT);
const batchChars = batch.reduce((n, w) => n + w.text.length, 0);

function summary(made, madeChars, failed) {
  const per = {};
  for (const w of wanted.values()) {
    per[w.lang] = per[w.lang] || { lines: 0, chars: 0 };
    per[w.lang].lines++;
    per[w.lang].chars += w.text.length;
  }
  console.log(`\nActivities scanned: ${activities}. Lines found: ${wanted.size}.`);
  for (const [l, p] of Object.entries(per))
    console.log(`  ${l}: ${p.lines} lines, ${p.chars} characters (voice ${voiceFor(l)})`);
  console.log(`Skipped (clip already on disk): ${skipped} clips, ${skippedChars} characters.`);
  if (DRY) console.log(`Would generate: ${batch.length} clips, ${batchChars} characters.`);
  else
    console.log(
      `Generated: ${made} clips, ${madeChars} characters sent to Google.${failed ? ` Failed: ${failed}.` : ""}`,
    );
  console.log(`Characters used this month (${month}): ${usedThisMonth} of the ${MONTHLY} limit set here.`);
}

function writeManifest() {
  for (const l of LANGS)
    manifest.clips[l] = Object.fromEntries(Object.entries(manifest.clips[l]).sort(([a], [b]) => a.localeCompare(b)));
  manifest.about = "Pre-generated voice clips, written by app/scripts/generate-voices.js. Do not edit by hand.";
  const tmp = MANIFEST + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 1) + "\n");
  fs.renameSync(tmp, MANIFEST);
}

if (DRY) {
  summary(0, 0, 0);
  process.exit(0);
}
if (!KEY) {
  summary(0, 0, 0);
  console.error(
    "\nNo GOOGLE_TTS_API_KEY. Copy app/.env.example to app/.env, put your key in it, and run this again.\n" +
      "Nothing was sent to Google.",
  );
  writeManifest();
  process.exit(batch.length ? 2 : 0);
}
if (!PAID && usedThisMonth + batchChars > MONTHLY) {
  summary(0, 0, 0);
  console.error(
    `\nThis run needs ${batchChars} characters, which would pass this month's limit (${MONTHLY}).` +
      " Use --limit, wait for next month, or pass --allow-paid.",
  );
  process.exit(3);
}

// ── Google Cloud Text-to-Speech ─────────────────────────────────────────
async function synthesize(w) {
  const body = {
    input: { text: w.text },
    voice: { languageCode: w.lang, name: voiceFor(w.lang) },
    audioConfig: { audioEncoding: "MP3", ...(RATE ? { speakingRate: RATE } : {}) },
  };
  for (let attempt = 0; ; attempt++) {
    let r;
    try {
      r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "X-Goog-Api-Key": KEY },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt < 2) {
        await new Promise((res) => setTimeout(res, 1500));
        continue;
      }
      const err = new Error("cannot reach Google Text-to-Speech (is this PC online?): " + e.message);
      err.fatal = true;
      throw err;
    }
    if (r.ok) {
      const j = await r.json();
      if (!j.audioContent) throw new Error("no audio in the reply");
      return Buffer.from(j.audioContent, "base64");
    }
    const msg = (await r.text()).slice(0, 300);
    if ((r.status === 429 || r.status >= 500) && attempt < 4) {
      await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt));
      continue;
    }
    const e = new Error(`Google TTS ${r.status}: ${msg}`);
    e.fatal = r.status === 400 || r.status === 401 || r.status === 403;
    throw e;
  }
}

let made = 0,
  madeChars = 0,
  failed = 0,
  fatal = null,
  next = 0;
fs.mkdirSync(path.dirname(USAGE), { recursive: true });
async function worker() {
  while (!fatal && next < batch.length) {
    const w = batch[next++];
    try {
      const mp3 = await synthesize(w);
      fs.mkdirSync(path.join(VOICE_DIR, w.lang), { recursive: true });
      fs.writeFileSync(path.join(VOICE_DIR, w.lang, w.id + ".mp3"), mp3);
      manifest.clips[w.lang][w.id] = { t: w.text, h: textHash(w.text), v: voiceFor(w.lang) };
      manifest.voices[w.lang] = voiceFor(w.lang);
      made++;
      madeChars += w.text.length;
      usedThisMonth += w.text.length;
      usage[month] = usedThisMonth;
      if (made % 25 === 0) {
        fs.writeFileSync(USAGE, JSON.stringify(usage, null, 1));
        writeManifest();
        console.log(`  … ${made} of ${batch.length}`);
      }
    } catch (e) {
      failed++;
      if (e.fatal) fatal = e;
      else console.warn(`  ! ${w.lang} "${w.text.slice(0, 40)}": ${e.message}`);
    }
  }
}
await Promise.all([1, 2, 3, 4].map(worker));
fs.writeFileSync(USAGE, JSON.stringify(usage, null, 1));
writeManifest();
summary(made, madeChars, failed);
if (fatal) {
  console.error("\nStopped: " + fatal.message);
  process.exit(1);
}
