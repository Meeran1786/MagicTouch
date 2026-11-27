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
//   1. plays /assets/voice/<lang>/<clipId>.mp3 when the voice manifest lists it (decoded once,
//      kept in a small cache, so repeats start at once; a new line cancels the old one cleanly)
//   2. otherwise falls back to window.speechSynthesis with the best voice for that language that
//      works offline, at a natural rate and pitch. Missing lines are remembered (MagicAudio.misses())
//      so the voice generator can make them next time.
//   MagicAudio.stop()                    stops the voice now
//   MagicAudio.preload(lines, lang)      decode clips ahead of time; preloadActivity(activity)
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

const MUTE_KEY = "mtSfxOn";
const VOICE_ROOT = "/assets/voice/";
const SFX_ROOT = "/assets/sfx/";
const MISS_KEY = "mtVoiceMisses";
export const CUES = ["tap", "toggle", "tick", "success", "wrong", "pop"];
const LEVEL = { tap: 0.5, toggle: 0.55, tick: 0.32, success: 0.6, wrong: 0.6, pop: 0.55 };
const VOICE_CACHE = 80; // decoded clips kept (≈ 100 KB each at 24 kHz)
const PART_GAP_S = 0.07; // between the parts of one line

// ── the one audio context ───────────────────────────────────────────────
let ctx = null,
  fxBus = null,
  voiceBus = null;
/** The one Web Audio context every part of the wall uses. */
export function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
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
function buffer(url, keep = VOICE_CACHE) {
  let p = buffers.get(url);
  if (p) {
    buffers.delete(url); // most recently used goes last
    buffers.set(url, p);
    return p;
  }
  p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(url + ": " + r.status);
      return r.arrayBuffer();
    })
    .then(decode);
  p.catch(() => buffers.delete(url));
  buffers.set(url, p);
  while (buffers.size > keep) buffers.delete(buffers.keys().next().value);
  return p;
}
function clipUrl(lang, id) {
  return VOICE_ROOT + lang + "/" + id + ".mp3";
}

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

// ── voice ────────────────────────────────────────────────────────────────
let token = 0;
let sources = [];
let partTimers = [];
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
  if (window.speechSynthesis) speechSynthesis.cancel();
}

function playClips(list, my, onPart) {
  const c = wake(),
    out = voiceOut();
  let t = c.currentTime + 0.03;
  return new Promise((resolve) => {
    list.forEach((buf, i) => {
      const s = c.createBufferSource();
      s.buffer = buf;
      s.connect(out);
      s.start(t);
      sources.push(s);
      if (onPart) partTimers.push(setTimeout(() => my === token && onPart(i), (t - c.currentTime) * 1000));
      if (i === list.length - 1)
        s.onended = () => {
          sources = sources.filter((x) => x !== s);
          resolve(my === token);
        };
      t += buf.duration + PART_GAP_S;
    });
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
function synth(parts, lang, my, o) {
  if (!window.speechSynthesis) return Promise.resolve(false);
  const voice = bestVoice(lang);
  // with onPart each part is its own utterance (letters stay letters); otherwise one line
  const lines = o.onPart ? parts : [parts.join(" ")];
  return new Promise((resolve) => {
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(o.onPart && text.length === 1 ? text.toLowerCase() : text);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = o.rate || (o.onPart && text.length === 1 ? 0.8 : 0.95);
      u.pitch = 1;
      if (o.onPart) u.onstart = () => my === token && o.onPart(i);
      if (i === lines.length - 1) u.onend = u.onerror = () => resolve(my === token);
      speechSynthesis.speak(u);
    });
  });
}

async function speak(opts, lang2) {
  const o =
    typeof opts === "string" || typeof opts === "number" || Array.isArray(opts)
      ? { text: opts, lang: lang2 }
      : opts || {};
  const parts = (Array.isArray(o.text) ? o.text : [o.text]).map(normalize).filter(Boolean);
  stop();
  const my = token;
  if (!on || (!parts.length && !o.src)) return false;
  const lang = o.lang ? langCode(o.lang) : langOf(parts.join(" "), "en-IN");
  let urls = [];
  if (o.src) urls = [o.src];
  else {
    const table = (await manifest())[lang] || {};
    const id = parts.length === 1 && safeId(o.clipId);
    if (id && table[id]) urls = [clipUrl(lang, id)];
    else {
      const ids = parts.map((p) => keyOf(p, lang));
      const missing = parts.filter((p, i) => !table[ids[i]]);
      missing.forEach((p) => noteMiss(p, lang));
      if (!missing.length) urls = ids.map((x) => clipUrl(lang, x));
    }
  }
  if (my !== token) return false;
  if (urls.length) {
    try {
      const list = await Promise.all(urls.map((u) => buffer(u)));
      if (my !== token) return false;
      return await playClips(list, my, o.onPart);
    } catch {
      if (my !== token) return false; // a broken clip: say it with the fallback voice
    }
  }
  return synth(parts, lang, my, o);
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

export const MagicAudio = {
  CUES,
  speak,
  stop,
  preload,
  preloadActivity: (activity) => preload(linesOf(activity || {})),
  playSfx,
  muted: () => !on,
  setMuted,
  toggleMute: () => setMuted(on),
  onMute(fn) {
    muteFns.add(fn);
    return () => muteFns.delete(fn);
  },
  context: audioCtx,
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
