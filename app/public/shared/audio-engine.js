// MagicTouch audio engine (the Frozen Audio Standard, CLAUDE.md §8): every voice line and
// every sound effect in the wall app goes through MagicAudio. Plain ES module, no libraries,
// works offline.
//
//   import { MagicAudio } from "/shared/audio-engine.js";      (also window.MagicAudio)
//
// Voice
//   MagicAudio.speak({ text, lang, clipId, src, onPart, rate })   → Promise<true when it finished>
//     text    a line, or a list of parts spoken back to back (["Yes!", word]), so each part can be
//             a pre-generated clip that many lines share
//     lang    "en-IN" (default) | "hi-IN" | "te-IN" (or "English" / "Hindi" / "Telugu")
//     clipId  optional hand-picked clip name; otherwise the id comes from the text (voice-key.js)
//     src     optional recorded file to play instead (an activity's own audio)
//     onPart  optional (i) => …, called as part i starts (letter-tile bounces in time with the voice)
//     queue   true: wait for the line now speaking instead of cutting it off
//   1. plays /assets/voice/<lang>/<clipId>.mp3 when the voice manifest lists it (decoded once,
//      trimmed of leading/trailing silence, kept in a small cache; a new line cancels the old one)
//   2. otherwise (no clip, or a clip that turned out silent) that part alone is said by
//      window.speechSynthesis with the best offline voice for the language. Missing lines are
//      remembered (MagicAudio.misses()) so the voice generator can make them next time.
//   MagicAudio.speakSequence(items, { lang, gap, onPart, queue })   spelling: one item at a time,
//     each waits for the one before it to END (its "ended" event), then a 120 ms gap. Nothing is
//     skipped and no item cuts off another. MT.speak(["Yes!", word]) uses the same queue.
//   MagicAudio.stop()                    stops the voice now
//   MagicAudio.musicOut()                the bus background music plays into: ducked to 30 % while
//                                        the voice speaks, silent while muted
//   MagicAudio.preload(lines, lang)      decode clips ahead of time; preloadActivity(activity)
//
// Theme sounds (real-world): MagicAudio.playTheme("cat" | { name, loop, volume, now }) → { stop() }
//   plays /assets/sfx/themes/<name>.ogg|.mp3 when it is there, else the sound made in code
//   (theme-synth.js), else nothing. Activities name them with "sfx" (a one-shot) and "ambience" (a
//   quiet loop). A one-shot waits until the voice has finished the word, then plays.
//   MagicAudio.playSound(url, { loop, volume }) plays any recorded file the same way.
//
// Sound effects: tap, toggle, tick, success, wrong, pop
//   MagicAudio.playSfx(name, { volume, pitch })   pitch 0…1 raises the note (slider ticks)
//   Plays /assets/sfx/<name>.ogg or .mp3 (listed in /assets/sfx/index.json; Kenney CC0). Without a
//   file it synthesizes a warm, low-pass filtered sound: soft marimba and wood plucks, gentle chimes.
//
// One global mute (the Studio speaker button, the launcher's "Sound effects" switch)
//   MagicAudio.muted() / setMuted(m) / toggleMute() / onMute(fn) → unsubscribe
//   Kept in localStorage "mtSfxOn" ("0" = muted) and shared by every page and frame on the wall.
//
//   MagicAudio.context()                 the one Web Audio context of the wall (instruments use it)
import { normalize, clipId as keyOf, langCode, langOf, safeId, linesOf } from "/shared/voice-key.js";
import { synthTheme, renderTheme } from "/shared/theme-synth.js";

const MUTE_KEY = "mtSfxOn";
const VOICE_ROOT = "/assets/voice/";
const SFX_ROOT = "/assets/sfx/";
const MISS_KEY = "mtVoiceMisses";
export const CUES = ["tap", "toggle", "tick", "success", "wrong", "pop"];
const LEVEL = { tap: 0.5, toggle: 0.55, tick: 0.32, success: 0.6, wrong: 0.6, pop: 0.55 };
const VOICE_CACHE = 80; // decoded clips kept (≈ 100 KB each at 24 kHz)
const ITEM_GAP_MS = 120; // speakSequence: the pause after each item (a letter) ends
const PART_GAP_MS = 70; // speak: between the parts of one line ("Yes!" … "Ambulance")
const SILENT_PEAK = 0.03; // a decoded clip quieter than this (−30 dBFS) has no speech in it
const MUSIC_LEVEL = 1; // the music bus (soft-music.js sets the piece's own level)
const MUSIC_DUCK = 0.3; // music level while the voice speaks
const THEME_DUCK = 0.5; // theme sounds (a roar, a siren) while the voice speaks

// ── the one audio context ───────────────────────────────────────────────
let ctx = null,
  fxBus = null,
  voiceBus = null;
/** The one Web Audio context every part of the wall uses. */
export function audioCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    watchState();
  }
  return ctx;
}
function wake() {
  const c = audioCtx();
  if (c.state !== "running") c.resume().catch(() => {});
  return c;
}
// effects: a gentle low-pass (no harsh highs on projector speakers) and a soft compressor
function fx() {
  if (fxBus) return fxBus;
  const c = audioCtx(),
    lp = c.createBiquadFilter(),
    comp = c.createDynamicsCompressor();
  lp.type = "lowpass";
  lp.frequency.value = 6500;
  lp.Q.value = 0.4;
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  lp.connect(comp).connect(c.destination);
  return (fxBus = lp);
}
function voiceOut() {
  if (voiceBus) return voiceBus;
  voiceBus = audioCtx().createGain();
  voiceBus.gain.value = 1;
  voiceBus.connect(audioCtx().destination);
  return voiceBus;
}
// decoding needs no running context (and so no autoplay warning before the first tap)
let decoder = null;
function decode(bytes) {
  if (!decoder) decoder = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
  return decoder.decodeAudioData(bytes);
}

// ── mute ─────────────────────────────────────────────────────────────────
function readOn() {
  try {
    return localStorage.getItem(MUTE_KEY) !== "0";
  } catch {
    return true;
  }
}
let on = readOn();
const muteFns = new Set();
function emitMute() {
  muteFns.forEach((fn) => {
    try {
      fn(!on);
    } catch {
      /* a listener's own problem */
    }
  });
}
window.addEventListener("storage", (e) => {
  if (e.key !== MUTE_KEY && e.key !== null) return;
  const now = readOn();
  if (now === on) return;
  on = now;
  if (!on) stop();
  musicLevel();
  emitMute();
});
function setMuted(m) {
  on = !m;
  try {
    localStorage.setItem(MUTE_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked: this page still follows it */
  }
  if (!on) stop();
  musicLevel();
  emitMute();
}

// ── clips: manifest and decoded-buffer cache ────────────────────────────
let manifestP = null;
function manifest() {
  if (!manifestP)
    manifestP = fetch(VOICE_ROOT + "manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m) => (m && m.clips) || {});
  return manifestP;
}
const buffers = new Map();
function buffer(url, keep = VOICE_CACHE, after = null) {
  const key = (after ? "v|" : "") + url;
  let p = buffers.get(key);
  if (p) {
    buffers.delete(key); // most recently used goes last
    buffers.set(key, p);
    return p;
  }
  p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(url + ": " + r.status);
      return r.arrayBuffer();
    })
    .then(decode)
    .then((b) => (after ? after(b) : b));
  p.catch(() => buffers.delete(key));
  buffers.set(key, p);
  while (buffers.size > keep) buffers.delete(buffers.keys().next().value);
  return p;
}
function clipUrl(lang, id) {
  return VOICE_ROOT + lang + "/" + id + ".mp3";
}

// A voice clip, ready to play: null when the clip is silent (text-to-speech services sometimes
// return silence for one letter or a very short word), otherwise trimmed of its leading and
// trailing silence, so a letter starts the moment its tile bounces and the next one follows
// right after it ends.
function tidy(buf) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) {
    const x = Math.abs(d[i]);
    if (x > peak) peak = x;
  }
  if (peak < SILENT_PEAK) return null;
  const th = Math.max(0.004, peak * 0.02),
    sr = buf.sampleRate;
  let a = 0,
    b = d.length - 1;
  while (a < b && Math.abs(d[a]) < th) a++;
  while (b > a && Math.abs(d[b]) < th) b--;
  a = Math.max(0, a - Math.round(sr * 0.04));
  b = Math.min(d.length, b + Math.round(sr * 0.08));
  if (a === 0 && b === d.length) return buf;
  const out = decoder.createBuffer(buf.numberOfChannels, b - a, sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.copyToChannel(buf.getChannelData(ch).subarray(a, b), ch);
  return out;
}
const voiceClip = (url) => buffer(url, VOICE_CACHE, tidy);

// lines with no clip yet, for the next run of scripts/generate-voices.js (--lines)
function noteMiss(text, lang) {
  try {
    const all = JSON.parse(localStorage.getItem(MISS_KEY) || "{}");
    const k = lang + "|" + text;
    if (!(k in all) && Object.keys(all).length >= 500) return;
    all[k] = (all[k] || 0) + 1;
    localStorage.setItem(MISS_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked or full */
  }
}

// ── music bus: gentle, ducked while the voice speaks, silent when muted ──
let musicBus = null,
  talking = 0;
function musicLevel() {
  if (themeBus) {
    const c = audioCtx();
    themeBus.gain.cancelScheduledValues(c.currentTime);
    themeBus.gain.setTargetAtTime(on ? (talking ? THEME_DUCK : 1) : 0, c.currentTime, talking || !on ? 0.08 : 0.4);
  }
  if (!musicBus) return;
  const c = audioCtx(),
    v = on ? MUSIC_LEVEL * (talking ? MUSIC_DUCK : 1) : 0;
  musicBus.gain.cancelScheduledValues(c.currentTime);
  // duck and mute fast (the voice must be clear at once), come back slowly
  musicBus.gain.setTargetAtTime(v, c.currentTime, talking || !on ? 0.08 : 0.5);
}
function musicOut() {
  if (musicBus) return musicBus;
  musicBus = audioCtx().createGain();
  musicBus.gain.value = on ? MUSIC_LEVEL : 0;
  musicBus.connect(audioCtx().destination);
  return musicBus;
}
// theme one-shots (a lion's roar as its picture opens): through the effects bus, a little lower
// while the voice says the word over them
let themeBus = null;
function themeOut() {
  if (themeBus) return themeBus;
  themeBus = audioCtx().createGain();
  themeBus.gain.value = on ? (talking ? THEME_DUCK : 1) : 0;
  themeBus.connect(fx());
  return themeBus;
}
function talk(d) {
  talking = Math.max(0, talking + d);
  musicLevel();
}
// Audio can only start after a tap. Wait for it without hanging: resolves true once running.
const waiters = new Set();
// May the context be made now? Inside the wall's frame (allow="autoplay") yes; on a page of its
// own only after the first tap, so Chrome never logs "AudioContext was not allowed to start".
function mayStart() {
  if (ctx) return true;
  try {
    if (window.parent !== window) return true;
  } catch {
    return true;
  }
  const ua = navigator.userActivation;
  return !ua || ua.hasBeenActive;
}
function whenRunning(cancellable = false) {
  if (mayStart()) {
    const c = audioCtx();
    if (c.state === "running") return Promise.resolve(true);
    c.resume().catch(() => {});
  }
  // a line asked for before the first tap plays at that tap, unless stop() or a newer line comes first
  return new Promise((resolve) => {
    const r = (ok) => {
      waiters.delete(r);
      pending.delete(r);
      resolve(ok);
    };
    waiters.add(r);
    if (cancellable) pending.add(r);
  });
}
function unlock() {
  const c = audioCtx();
  if (c.state !== "running") c.resume().catch(() => {});
  else [...waiters].forEach((r) => r(true));
}
["pointerdown", "keydown", "touchstart", "click"].forEach((t) =>
  window.addEventListener(t, unlock, { capture: true, passive: true }),
);
function watchState() {
  audioCtx().addEventListener("statechange", () => {
    if (ctx.state !== "running") return;
    [...waiters].forEach((r) => r(true));
  });
}

// ── voice: a queue that says one item at a time ─────────────────────────
let token = 0;
let sources = [];
const pending = new Set(); // resolvers of items now playing, so stop() never leaves one hanging
let partTimers = [];
let queueTail = Promise.resolve(true); // the sequence now speaking (speak with queue: true waits for it)
function stop() {
  token++;
  sources.forEach((s) => {
    try {
      s.stop();
    } catch {
      /* already ended */
    }
  });
  sources = [];
  partTimers.forEach(clearTimeout);
  partTimers = [];
  pending.forEach((r) => r(false));
  pending.clear();
  if (window.speechSynthesis) speechSynthesis.cancel();
}

// one clip, started gap seconds from now on the audio clock; resolves on its "ended" event
async function playOne(buf, my, onStart, gap) {
  if (!(await whenRunning(true)) || my !== token) return false;
  const c = audioCtx(),
    s = c.createBufferSource(),
    t = c.currentTime + Math.max(0.01, gap);
  s.buffer = buf;
  s.connect(voiceOut());
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      pending.delete(finish);
      sources = sources.filter((x) => x !== s);
      resolve(ok && my === token);
    };
    pending.add(finish);
    s.onended = () => finish(true);
    // a safety net only (a context that stalls): the clip's own "ended" event normally comes first
    const guard = setTimeout(() => finish(true), (gap + buf.duration) * 1000 + 1500);
    sources.push(s);
    s.start(t);
    if (onStart) partTimers.push(setTimeout(() => my === token && onStart(), (t - c.currentTime) * 1000));
  });
}

// the best installed voice for a language: offline voices first (a classroom has no internet),
// then natural/neural ones, then the online Google voices when the internet is there
const PREFERRED = {
  "en-IN": /heera|ravi|neerja|prabhat|veena|rishi|isha|kajal/i,
  "hi-IN": /kalpana|hemant|swara|madhur|lekha|kiyara/i,
  "te-IN": /shruti|mohan|chitra|geeta/i,
};
let voices = [];
function loadVoices() {
  voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
}
if (window.speechSynthesis) {
  loadVoices();
  speechSynthesis.addEventListener("voiceschanged", loadVoices);
}
function bestVoice(lang) {
  if (!voices.length) loadVoices();
  const base = lang.slice(0, 2);
  let best = null,
    top = -1;
  for (const v of voices) {
    const vl = String(v.lang || "").replace("_", "-");
    let s;
    if (vl === lang) s = 100;
    else if (vl.slice(0, 2).toLowerCase() === base) s = 50;
    else continue;
    if (v.localService) s += 20;
    if (/natural|neural|enhanced|premium/i.test(v.name)) s += 15;
    if (PREFERRED[lang] && PREFERRED[lang].test(v.name)) s += 10;
    if (!v.localService && navigator.onLine === false) s -= 60;
    else if (/google/i.test(v.name)) s += 5;
    if (s > top) {
      top = s;
      best = v;
    }
  }
  return best;
}
// one item with the fallback voice; resolves on the utterance's "end" event
function sayOne(text, lang, my, o, onStart, gap) {
  if (!window.speechSynthesis) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false,
      guard = 0;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      pending.delete(finish);
      resolve(ok && my === token);
    };
    pending.add(finish);
    const go = () => {
      if (my !== token) return finish(false);
      const letter = [...text].length === 1;
      const u = new SpeechSynthesisUtterance(letter ? text.toLowerCase() : text);
      u.lang = lang;
      const voice = bestVoice(lang);
      if (voice) u.voice = voice;
      u.rate = o.rate || (letter ? 0.8 : 0.95);
      u.pitch = 1;
      u.onstart = () => my === token && onStart && onStart();
      u.onend = () => finish(true);
      u.onerror = () => finish(true);
      guard = setTimeout(() => finish(true), 4000 + text.length * 180); // a voice that never ends
      speechSynthesis.speak(u);
    };
    if (gap > 0) partTimers.push(setTimeout(go, gap * 1000));
    else go();
  });
}

function asItem(x) {
  if (x && typeof x === "object") return { ...x, text: normalize(x.text) };
  return { text: normalize(x) };
}

/**
 * Says a list of items one at a time: each item (a letter, a word, a phrase) waits for the one
 * before it to end, then a short gap, then starts. A missing or silent clip is said by the
 * fallback voice for that item only, so nothing is ever skipped.
 *   items  ["A", "M", "B", …, "Ambulance"] or [{ text, src, clipId, lang }]
 *   opt    { lang, gap: ms between items (default 120), onPart(i) as item i starts, rate,
 *            queue: true to wait for what is speaking now instead of stopping it }
 * Resolves true when every item was said, false when it was stopped or muted.
 */
function speakSequence(items, opt = {}) {
  const list = (Array.isArray(items) ? items : [items]).map(asItem).filter((it) => it.text || it.src);
  if (!opt.queue) stop();
  const run = async (my) => {
    if (!on || !list.length || my !== token) return false;
    const lang0 = opt.lang ? langCode(opt.lang) : langOf(list.map((it) => it.text).join(" "), "en-IN");
    const table = await manifest();
    if (my !== token) return false;
    // start fetching every clip now, so there is no wait between items
    const jobs = list.map((it) => {
      const lang = it.lang ? langCode(it.lang) : lang0,
        t = table[lang] || {},
        id = (safeId(it.clipId) && t[safeId(it.clipId)] && safeId(it.clipId)) || keyOf(it.text, lang);
      let clip = Promise.resolve(null);
      if (it.src) clip = buffer(it.src).catch(() => null);
      else if (it.text && t[id]) clip = voiceClip(clipUrl(lang, id)).catch(() => null);
      return { it, lang, clip };
    });
    const gap = (opt.gap == null ? ITEM_GAP_MS : opt.gap) / 1000;
    talk(1);
    try {
      for (let i = 0; i < jobs.length; i++) {
        const { it, lang, clip } = jobs[i];
        const buf = await clip;
        if (my !== token || !on) return false;
        const start = opt.onPart ? () => opt.onPart(i) : null,
          wait = i ? gap : 0;
        let ok;
        if (buf) ok = await playOne(buf, my, start, wait);
        else {
          if (!it.src) noteMiss(it.text, lang);
          ok = it.text ? await sayOne(it.text, lang, my, opt, start, wait) : true;
        }
        if (!ok || my !== token) return false;
      }
      return true;
    } finally {
      talk(-1);
    }
  };
  const my = token;
  const p = opt.queue ? queueTail.then(() => run(my)) : run(my);
  queueTail = p.catch(() => false);
  return p;
}

/** Says a line, or a list of parts back to back (see the header). */
function speak(opts, lang2) {
  const o =
    typeof opts === "string" || typeof opts === "number" || Array.isArray(opts)
      ? { text: opts, lang: lang2 }
      : opts || {};
  const parts = Array.isArray(o.text) ? o.text : [o.text];
  let items = parts.map((t) => ({ text: t }));
  if (items.length === 1) items[0] = { text: o.text, clipId: o.clipId, src: o.src };
  else if (o.src) items = [{ text: parts.map(normalize).join(" "), src: o.src }];
  return speakSequence(items, {
    lang: o.lang,
    onPart: o.onPart,
    rate: o.rate,
    queue: o.queue,
    gap: o.gap == null ? PART_GAP_MS : o.gap,
  });
}

/** Decodes the clips of these lines ahead of time (only clips the manifest lists). */
async function preload(lines, lang) {
  const table = await manifest();
  const list = (Array.isArray(lines) ? lines : [lines]).slice(0, 40);
  for (const l of list) {
    const text = normalize(typeof l === "object" ? l.text : l);
    if (!text) continue;
    const lg = typeof l === "object" && l.lang ? langCode(l.lang) : lang ? langCode(lang) : langOf(text, "en-IN");
    const id = keyOf(text, lg);
    if (table[lg] && table[lg][id]) buffer(clipUrl(lg, id)).catch(() => {});
  }
}

// ── sound effects ───────────────────────────────────────────────────────
const sfxFiles = {}; // name → AudioBuffer once loaded
let sfxReady = null;
function loadSfx() {
  if (!sfxReady)
    sfxReady = fetch(SFX_ROOT + "index.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((idx) =>
        Promise.all(
          CUES.filter((n) => /^[\w.-]+\.(ogg|mp3)$/.test(idx[n] || "")).map((n) =>
            buffer(SFX_ROOT + idx[n], 1e9)
              .then((b) => (sfxFiles[n] = b))
              .catch(() => {}),
          ),
        ),
      );
  return sfxReady;
}
loadSfx();

// warm synthesis: every note goes through its own low-pass, then the effects bus
function chain(c, cutoff) {
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  lp.Q.value = 0.6;
  lp.connect(fx());
  return lp;
}
function note(c, dest, { f, t, len, level, to, type = "sine", attack = 0.004 }) {
  const o = c.createOscillator(),
    g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + len * 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + len + 0.02);
}
let noise = null;
function knock(c, dest, t, level, centre) {
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
  }
  const s = c.createBufferSource(),
    bp = c.createBiquadFilter(),
    g = c.createGain();
  s.buffer = noise;
  bp.type = "bandpass";
  bp.frequency.value = centre;
  bp.Q.value = 1.2;
  g.gain.value = level;
  s.connect(bp).connect(g).connect(dest);
  s.start(t);
}
// a soft marimba bar: fundamental, its 4th-harmonic ring, and a little wood knock
function marimba(c, dest, f, t, level, len = 0.3) {
  note(c, dest, { f, t, len, level });
  note(c, dest, { f: f * 3.93, t, len: len * 0.3, level: level * 0.16 });
  knock(c, dest, t, level * 0.35, f * 2);
}
function chime(c, dest, f, t, level) {
  note(c, dest, { f, t, len: 1.1, level, attack: 0.008 });
  note(c, dest, { f: f * 2.76, t, len: 0.5, level: level * 0.12, attack: 0.008 });
}
const SYNTH = {
  tap: (c, t, v) => marimba(c, chain(c, 2600), 660, t, 0.3 * v, 0.18),
  toggle: (c, t, v) => {
    const d = chain(c, 2600);
    marimba(c, d, 587, t, 0.26 * v, 0.16);
    marimba(c, d, 784, t + 0.06, 0.26 * v, 0.2);
  },
  tick: (c, t, v, k) => marimba(c, chain(c, 2400), 440 * Math.pow(2, k), t, 0.16 * v, 0.07),
  success: (c, t, v) => {
    const d = chain(c, 3200);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => chime(c, d, f, t + i * 0.09, 0.16 * v));
  },
  wrong: (c, t, v) => {
    const d = chain(c, 650);
    note(c, d, { f: 175, to: 92, t, len: 0.24, level: 0.5 * v });
    note(c, d, { f: 88, t, len: 0.28, level: 0.25 * v });
    knock(c, d, t, 0.3 * v, 260);
  },
  pop: (c, t, v) => note(c, chain(c, 2400), { f: 360, to: 940, t, len: 0.1, level: 0.32 * v }),
};

/** Plays one of the six classroom cues. opt: { volume 0…1, pitch 0…1 (tick: higher slider, higher note) } */
function playSfx(name, opt = {}) {
  if (!on || !SYNTH[name]) return;
  try {
    const c = wake(),
      vol = opt.volume == null ? 1 : Math.max(0, Math.min(1, opt.volume)),
      k = Math.max(0, Math.min(1, opt.pitch || 0)),
      buf = sfxFiles[name];
    if (buf) {
      const s = c.createBufferSource(),
        g = c.createGain();
      s.buffer = buf;
      if (name === "tick") s.playbackRate.value = 0.8 + k * 0.7;
      g.gain.value = LEVEL[name] * vol;
      s.connect(g).connect(fx());
      s.start();
    } else SYNTH[name](c, c.currentTime + 0.005, vol, k);
  } catch {
    /* audio not allowed yet */
  }
}

// ── theme sounds: real-world sounds an activity names ("sfx": "cat") ────
// Files live in /assets/sfx/themes/ (cat.ogg, airplane.mp3, …). The wall's server lists that
// folder at /assets/sfx/themes/index.json, so a file dropped in is used at once, and a name with
// no file yet plays nothing (no request, no error): the activity's own cue still sounds.
const THEME_ROOT = SFX_ROOT + "themes/";
let themesP = null;
function themes() {
  if (!themesP)
    themesP = fetch(THEME_ROOT + "index.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m) => (m && typeof m === "object" ? m.sounds || m : {}));
  return themesP;
}
const themeName = (n) =>
  String(n || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
const NO_SOUND = { stop() {}, playing: false };
/**
 * Plays a recorded sound file: one-shots through the effects bus, loops (ambience) through the
 * music bus, so they are ducked under the voice too. Every sound stays silent while muted.
 * Returns { stop(fadeSeconds) } at once.
 */
function playSound(url, opt = {}) {
  if (!on || !url) return NO_SOUND;
  return playBuffer(buffer(url, VOICE_CACHE), opt);
}
// plays a decoded buffer (a promise of one) as a one-shot or a loop
function playBuffer(bufP, opt = {}) {
  const loop = !!opt.loop,
    vol = Math.max(0, Math.min(1, opt.volume == null ? (loop ? 0.35 : 0.7) : opt.volume));
  let src = null,
    g = null,
    stopped = false;
  const h = {
    playing: true,
    stop(fade = 0.4) {
      stopped = true;
      h.playing = false;
      if (!src) return;
      const c = audioCtx();
      try {
        g.gain.setTargetAtTime(0, c.currentTime, Math.max(0.01, fade / 3));
        src.stop(c.currentTime + fade + 0.05);
      } catch {
        /* already ended */
      }
    },
  };
  bufP
    .then(async (buf) => {
      if (!buf || stopped || !on || !(await whenRunning(false)) || stopped) return;
      const c = audioCtx();
      src = c.createBufferSource();
      g = c.createGain();
      src.buffer = buf;
      src.loop = loop;
      g.gain.value = vol;
      src.connect(g).connect(loop ? musicOut() : themeOut());
      src.onended = () => (h.playing = false);
      src.start();
    })
    .catch(() => (h.playing = false));
  return h;
}
/** Resolves once the voice is quiet (it gives a line said in the same tap a moment to start), plus a
 *  short gap; gives up after 6 s so a long line never swallows the sound. */
async function afterVoice(cancelled) {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  await nap(60);
  let waited = 0;
  while (talking && waited < 6000 && !cancelled()) {
    await nap(100);
    waited += 100;
  }
  if (waited) await nap(150);
}
/** Plays the theme sound with this name ("cat", "airplane", "electric"): its recording if there is
 *  one, else the same sound made in code when theme-synth.js has it, else nothing. */
function playTheme(name, opt = {}) {
  if (name && typeof name === "object") return playTheme(name.name, { ...name, ...opt });
  const key = themeName(name);
  if (!on || !/^[a-z0-9-]{1,40}$/.test(key)) return NO_SOUND;
  let inner = NO_SOUND,
    stopped = false;
  const h = {
    get playing() {
      return inner.playing;
    },
    stop(fade) {
      stopped = true;
      inner.stop(fade);
    },
  };
  // a one-shot waits for the voice: the word is said first, then its sound plays (they never
  // talk over each other); a loop (ambience) or { now: true } starts at once, ducked under the voice
  const turn = opt.loop || opt.now ? Promise.resolve() : afterVoice(() => stopped);
  Promise.all([themes(), turn]).then(([idx]) => {
    if (stopped) return;
    // a name, or the name its code-made sound goes by ("aeroplane" → "airplane"), may have a recording
    const file = idx[key] || idx[synthTheme(key)];
    // 1. a recording in /assets/sfx/themes/   2. one made in code (theme-synth.js)   3. nothing
    if (typeof file === "string" && /^[\w.-]+\.(ogg|mp3|wav)$/.test(file)) inner = playSound(THEME_ROOT + file, opt);
    else if (synthTheme(key)) inner = playBuffer(renderTheme(synthTheme(key)), opt);
  });
  return h;
}

export const MagicAudio = {
  CUES,
  speak,
  speakSequence,
  stop,
  preload,
  preloadActivity: (activity) => preload(linesOf(activity || {})),
  playSfx,
  playSound,
  playTheme,
  /** Resolves the names of the recorded theme sounds present: { cat: "cat.ogg", … } */
  themes: () => themes().then((m) => ({ ...m })),
  /** Whether a theme name has a sound made in code (used when no recording is there). */
  synthTheme,
  muted: () => !on,
  setMuted,
  toggleMute: () => setMuted(on),
  onMute(fn) {
    muteFns.add(fn);
    return () => muteFns.delete(fn);
  },
  context: audioCtx,
  /** The music bus: background music connects here (gentle, ducked under the voice, muted with all sound). */
  musicOut,
  /** Resolves true once audio is allowed to play (after the first tap). */
  ready: () => whenRunning(false),
  /** Whether the voice is speaking now. */
  speaking: () => talking > 0,
  /** Lines spoken with the fallback voice because no clip exists yet: [{ text, lang, count }]. */
  misses() {
    try {
      return Object.entries(JSON.parse(localStorage.getItem(MISS_KEY) || "{}")).map(([k, count]) => {
        const i = k.indexOf("|");
        return { lang: k.slice(0, i), text: k.slice(i + 1), count };
      });
    } catch {
      return [];
    }
  },
  clearMisses() {
    try {
      localStorage.removeItem(MISS_KEY);
    } catch {
      /* storage blocked */
    }
  },
  /** Whether a pre-generated clip exists for this line (resolves true/false). */
  async hasClip(text, lang) {
    const lg = lang ? langCode(lang) : langOf(normalize(text), "en-IN");
    const table = (await manifest())[lg] || {};
    return !!table[keyOf(text, lg)];
  },
};
window.MagicAudio = MagicAudio;
