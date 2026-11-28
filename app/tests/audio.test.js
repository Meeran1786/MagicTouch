// The Frozen Audio Standard (CLAUDE.md §8): voice keys, sound cue files and the no-bypass rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { clipId, normalize, linesOf, langOf, langCode } from "../public/shared/voice-key.js";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(APP, "public");

test("clip ids are stable, case-insensitive and safe file names", () => {
  assert.equal(clipId("Yes! The Apple.", "en-IN"), clipId("  yes!   the apple. ", "en-IN"));
  assert.notEqual(clipId("Apple", "en-IN"), clipId("Apple", "hi-IN"));
  assert.notEqual(clipId("Yes!", "en-IN"), clipId("Yes", "en-IN"));
  for (const t of ["Rhino", "गैंडा", "ఖడ్గమృగం", "<b>Ohm's</b> law & you", "3"])
    assert.match(clipId(t, langOf(t)), /^[a-z0-9-]{3,60}$/);
  assert.equal(normalize("<b>Ohm</b>&nbsp;law"), "Ohm law");
  assert.equal(langCode("Telugu"), "te-IN");
  assert.equal(langOf("ఎలుగుబంటి", "en-IN"), "te-IN");
  assert.equal(langOf("भालू"), "hi-IN");
});

test("lines are found in activity JSON, in the right language", () => {
  const lines = linesOf({
    intro: "Hello!",
    items: [
      {
        word: "Bear",
        says: [
          { lang: "Hindi", text: "भालू", code: "hi-IN" },
          { text: "ఎలుగుబంటి", code: "te-IN" },
        ],
      },
    ],
    explain: "V = {V} volts",
    photo: "images/bear.jpg",
  });
  const got = lines.map((l) => l.lang + ":" + l.text).sort();
  assert.deepEqual(got, ["en-IN:Bear", "en-IN:Hello!", "hi-IN:भालू", "te-IN:ఎలుగుబంటి"]);
});

test("the six sound cues are on disk as listed, with the CC0 licence", () => {
  const idx = JSON.parse(fs.readFileSync(path.join(PUB, "assets/sfx/index.json"), "utf8"));
  for (const cue of ["tap", "toggle", "tick", "success", "wrong", "pop"]) {
    assert.ok(idx[cue], cue + " listed");
    const f = path.join(PUB, "assets/sfx", idx[cue]);
    assert.ok(fs.statSync(f).size > 1000, cue + " file");
    assert.equal(fs.readFileSync(f).subarray(0, 4).toString("latin1"), "OggS", cue + " is Ogg");
  }
  assert.match(fs.readFileSync(path.join(PUB, "assets/sfx/LICENSE-Kenney.txt"), "utf8"), /CC0/);
});

test("only the audio engine speaks or makes UI sounds", () => {
  // theme-synth.js is part of the audio engine: the theme sounds it makes are played by MagicAudio
  const allowed = new Set(["shared/audio-engine.js", "shared/theme-synth.js"]);
  const instruments = new Set([
    "engine/templates/piano.js",
    "engine/templates/conductor.js",
    "shared/studio/soft-music.js",
  ]);
  const bad = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(PUB, p).split(path.sep).join("/");
      if (e.isDirectory()) {
        if (rel !== "vendor") walk(p);
      } else if (/\.(js|html)$/.test(e.name) && !allowed.has(rel)) {
        const src = fs.readFileSync(p, "utf8");
        if (/speechSynthesis|SpeechSynthesisUtterance/.test(src)) bad.push(rel + ": speechSynthesis");
        if (/createOscillator/.test(src) && !instruments.has(rel)) bad.push(rel + ": raw oscillator");
      }
    }
  })(PUB);
  assert.deepEqual(bad, []);
});

test("the voice manifest is valid and .env is never tracked", () => {
  const m = JSON.parse(fs.readFileSync(path.join(PUB, "assets/voice/manifest.json"), "utf8"));
  for (const l of ["en-IN", "hi-IN", "te-IN"]) assert.equal(typeof m.clips[l], "object");
  for (const [l, clips] of Object.entries(m.clips))
    for (const id of Object.keys(clips)) assert.ok(fs.existsSync(path.join(PUB, "assets/voice", l, id + ".mp3")), id);
  const ignore = fs.readFileSync(path.join(APP, ".gitignore"), "utf8");
  assert.match(ignore, /^\.env$/m);
});

test("the voice generator dry run counts lines without a key or the internet", () => {
  const env = { ...process.env, GOOGLE_TTS_API_KEY: "" };
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "mt-voice-"));
  const out = execFileSync(process.execPath, [path.join(APP, "scripts/generate-voices.js"), "--dry-run"], {
    env,
    cwd: home,
    encoding: "utf8",
  });
  assert.match(out, /Lines found: \d+/);
  assert.match(out, /te-IN: \d+ lines/);
  assert.match(out, /Would generate: \d+ clips, \d+ characters/);
});

test("silent voice clips are told apart from spoken ones", async () => {
  const { isSilent, mp3Gain } = await import("../scripts/mp3-voice-check.js");
  // pure digital silence (ffmpeg anullsrc, 24 kHz mono 32 kbit/s, like the voice pack)
  assert.equal(isSilent(fs.readFileSync(path.join(APP, "tests", "fixtures", "silence.mp3"))), true);
  assert.equal(isSilent(Buffer.from("not an mp3 at all")), true);
  // the longest clips of the pack are spoken sentences
  const dir = path.join(PUB, "assets", "voice", "en-IN");
  const big = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => [f, fs.statSync(path.join(dir, f)).size])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [f] of big) {
    const buf = fs.readFileSync(path.join(dir, f));
    assert.equal(isSilent(buf), false, f);
    assert.ok(mp3Gain(buf).seconds > 1, f);
  }
});

test("spelling goes through the one-at-a-time voice queue", () => {
  const early = fs.readFileSync(path.join(PUB, "engine", "js", "early.js"), "utf8");
  assert.match(early, /export function spell[\s\S]*?MT\.speakSequence\(/);
  const engine = fs.readFileSync(path.join(PUB, "shared", "audio-engine.js"), "utf8");
  assert.match(engine, /speakSequence,/);
  // background music plays into the music bus (ducked under the voice, muted with all sound)
  const music = fs.readFileSync(path.join(PUB, "shared", "studio", "soft-music.js"), "utf8");
  assert.match(music, /MagicAudio\.musicOut\(\)/);
  assert.doesNotMatch(music, /connect\(ctx\.destination\)/);
});
