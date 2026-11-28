#!/usr/bin/env node
// Voice audition: makes the same few Hindi and Telugu words in every voice Google offers for the
// language, and writes voice-audition/index.html so you can listen to them side by side and pick
// the voice that sounds most natural. Then put the chosen voice in .env and make that language's
// clips again:
//
//   cd app && npm run voices:audition          (needs GOOGLE_TTS_API_KEY in app/.env, and internet)
//   open voice-audition/index.html
//   then in .env:  TTS_VOICE_HI_IN=<the voice you liked>   (and/or TTS_VOICE_TE_IN=...)
//   npm run voices                              (only the changed language is made again)
//
// Options: --lang hi-IN   only one language.  It uses about 2,000 characters in all.
// Standard voices are left out (they sound robotic).
// The voice-audition folder is git-ignored (it is only for listening).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(APP, "voice-audition");
const { requestBody } = await import(pathToFileURL(path.join(APP, "scripts", "tts-voice.js")).href);

function readEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
readEnv(path.join(APP, ".env"));
readEnv(path.join(APP, "..", ".env"));
const KEY = process.env.GOOGLE_TTS_API_KEY || "";
if (!KEY) {
  console.error("No GOOGLE_TTS_API_KEY. Copy .env.example to .env in the app folder and put the key in it.");
  process.exit(2);
}
const argv = process.argv.slice(2);
const only = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : null;

// the words a child hears most: single animal and fruit names, and one praise line
const SAMPLES = {
  "hi-IN": ["हाथी", "बिल्ली", "शाबाश! यह शेर है।"],
  "te-IN": ["ఏనుగు", "పిల్లి", "శభాష్! ఇది సింహం."],
};
// Gemini voices to try as well (they follow a style note; small cost outside the Chirp free tier)
const GEMINI = ["Kore", "Aoede", "Leda", "Zephyr", "Charon", "Puck"].map((v) => "gemini-2.5-flash-tts:" + v);

const BASE = process.env.TTS_BASE || "https://texttospeech.googleapis.com/v1";
const H = { "X-Goog-Api-Key": KEY, "Content-Type": "application/json; charset=utf-8" };
async function listVoices(lang) {
  const r = await fetch(BASE + "/voices?languageCode=" + lang, { headers: H });
  if (!r.ok) throw new Error(`voices list ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.voices || [])
    .filter((v) => v.languageCodes.includes(lang))
    .map((v) => ({ name: v.name, gender: v.ssmlGender || "" }));
}
async function say(voice, lang, text) {
  const r = await fetch(BASE + "/text:synthesize", {
    method: "POST",
    headers: H,
    body: JSON.stringify(requestBody(voice, lang, text)),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 160)}`);
  return Buffer.from((await r.json()).audioContent, "base64");
}
const kind = (n) =>
  /gemini/i.test(n)
    ? "Gemini"
    : /Chirp3/.test(n)
      ? "Chirp 3: HD"
      : /Chirp/.test(n)
        ? "Chirp HD"
        : /Neural2/.test(n)
          ? "Neural2"
          : /Wavenet/.test(n)
            ? "WaveNet"
            : /Standard/.test(n)
              ? "Standard"
              : "Other";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let chars = 0;
const sections = [];
for (const lang of Object.keys(SAMPLES)) {
  if (only && only !== lang) continue;
  const voices = [...(await listVoices(lang)), ...GEMINI.map((name) => ({ name, gender: "" }))];
  // Chirp 3: HD first (preferred), then Neural2 and WaveNet, then Gemini; never Standard voices
  const rank = (n) =>
    /Chirp3-HD/.test(n) ? 0 : /Neural2/.test(n) ? 1 : /Wavenet/.test(n) ? 2 : /gemini/i.test(n) ? 3 : 9;
  const pick = voices
    .filter((v) => rank(v.name) < 9)
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  console.log(`${lang}: ${pick.length} voices`);
  const rows = [];
  fs.mkdirSync(path.join(OUT, lang), { recursive: true });
  for (const v of pick) {
    const cells = [];
    let ok = true;
    for (let i = 0; i < SAMPLES[lang].length; i++) {
      const file = `${lang}/${v.name.replace(/[^\w.-]+/g, "_")}-${i}.mp3`;
      try {
        fs.writeFileSync(path.join(OUT, file), await say(v.name, lang, SAMPLES[lang][i]));
        chars += SAMPLES[lang][i].length;
        cells.push(`<td><audio controls preload="none" src="${file}"></audio></td>`);
      } catch (e) {
        ok = false;
        cells.push(`<td class="err">${esc(e.message.slice(0, 80))}</td>`);
        break;
      }
    }
    if (!ok && /gemini/i.test(v.name))
      console.log(`  ${v.name}: not available on this key (${cells.at(-1).replace(/<[^>]+>/g, "")})`);
    process.stdout.write(ok ? "." : "x");
    rows.push(
      `<tr><td><b>${esc(v.name)}</b><br><small>${kind(v.name)} ${esc(v.gender.toLowerCase())}</small></td>${cells.join("")}` +
        `<td><code>TTS_VOICE_${lang.replace("-", "_").toUpperCase()}=${esc(v.name)}</code></td></tr>`,
    );
  }
  console.log("");
  const head = SAMPLES[lang].map((t) => `<th>${esc(t)}</th>`).join("");
  sections.push(
    `<h2>${lang === "hi-IN" ? "Hindi" : "Telugu"} (${lang})</h2><table><tr><th>Voice</th>${head}<th>Line for .env</th></tr>${rows.join("")}</table>`,
  );
}
fs.writeFileSync(
  path.join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>MagicTouch voice audition</title>
<style>body{font:16px system-ui,sans-serif;margin:24px;color:#3D0E37}h1{color:#631654}table{border-collapse:collapse;margin-bottom:32px}
td,th{border:1px solid #e6d9e3;padding:6px 10px;vertical-align:middle;text-align:left}th{background:#F7F1F5}
audio{width:170px;height:34px}code{background:#F7F1F5;padding:2px 6px;border-radius:4px;user-select:all}.err{color:#CC3054;font-size:13px}</style>
<h1>MagicTouch voice audition</h1>
<p>Play the words in each voice. When one sounds like a native speaker, copy its line into <code>app/.env</code>,
then run <code>npm run voices</code> in the app folder: only that language is made again.</p>
${sections.join("\n")}`,
);
console.log(`Done: about ${chars} characters. Open ${path.relative(process.cwd(), path.join(OUT, "index.html"))}`);
