// MagicTouch soft background music, made in the browser (Web Audio), so there is no
// recording to license. A slow, quiet pentatonic piece: warm pad chords, a few soft
// bell notes and a gentle low note, through a muffled room echo. It never repeats
// exactly but always stays calm. (Its sfx export is kept for old callers; it plays MagicAudio cues.)
//
//   const m = createSoftMusic(); m.start(); m.setMuted(true|false); m.stop();
//   sfx.tap(); sfx.correct(); sfx.wrong(); sfx.celebrate(); sfx.pitch(0…1);

import { audioCtx, MagicAudio } from "/shared/audio-engine.js";
// The one Web Audio context of the wall now lives in the audio engine; re-exported for old imports.
export { audioCtx };

function roomEcho(ctx, seconds = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds),
    buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
// C major pentatonic chord shapes, moving slowly: C, Am, F(add9), G(sus)
const CHORDS = [
  [48, 55, 60, 64, 67],
  [45, 52, 57, 60, 64],
  [41, 48, 57, 60, 67],
  [43, 50, 55, 62, 67],
];
const BELLS = [72, 74, 76, 79, 81, 84];

export function createSoftMusic({ volume = 0.16 } = {}) {
  const ctx = audioCtx();
  const out = ctx.createGain();
  out.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2200;
  tone.Q.value = 0.3;
  const echo = roomEcho(ctx),
    wet = ctx.createGain();
  wet.gain.value = 0.45;
  const dry = ctx.createGain();
  dry.gain.value = 0.7;
  tone.connect(dry).connect(out);
  tone.connect(echo).connect(wet).connect(out);
  out.connect(ctx.destination);

  let timer = null,
    step = 0,
    muted = false,
    running = false;

  function pad(notes, t, dur) {
    notes.slice(0, 4).forEach((n, i) => {
      [-4, 4].forEach((detune) => {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = hz(n);
        o.detune.value = detune;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045 / (1 + i * 0.4), t + 1.8);
        g.gain.setValueAtTime(0.045 / (1 + i * 0.4), t + dur - 1.6);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
        o.connect(g).connect(tone);
        o.start(t);
        o.stop(t + dur + 0.8);
      });
    });
  }
  function bell(n, t, level = 0.06) {
    const o = ctx.createOscillator(),
      o2 = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = hz(n);
    o2.type = "sine";
    o2.frequency.value = hz(n) * 2.01;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(tone);
    o.start(t);
    o2.start(t);
    o.stop(t + 2.6);
    o2.stop(t + 2.6);
  }
  function bar() {
    const t = ctx.currentTime + 0.1,
      dur = 8; // one chord every 8 s (very slow)
    const chord = CHORDS[step % CHORDS.length];
    pad(chord, t, dur);
    bell(chord[0] + 12, t + 0.05, 0.03); // soft low marker
    const n = 2 + Math.floor(Math.random() * 3); // a few gentle bell notes per bar
    for (let i = 0; i < n; i++) {
      const pick = BELLS[Math.floor(Math.random() * BELLS.length)];
      bell(pick, t + 1 + (i * (dur - 2)) / n + Math.random() * 0.4, 0.035 + Math.random() * 0.02);
    }
    step++;
  }
  function level() {
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(muted || !running ? 0 : volume, ctx.currentTime, 0.6);
  }

  return {
    async start() {
      if (running) return true;
      try {
        await ctx.resume();
      } catch (e) {
        /* needs a tap first */
      }
      if (ctx.state !== "running") return false;
      running = true;
      bar();
      timer = setInterval(bar, 8000);
      level();
      return true;
    },
    stop() {
      running = false;
      clearInterval(timer);
      level();
    },
    setMuted(m) {
      muted = !!m;
      level();
    },
    get playing() {
      return running && !muted;
    },
  };
}

/** Sound effects are on unless the school (or the speaker button) muted them. */
export function sfxOn() {
  return !MagicAudio.muted();
}

// The polite effects, now played by MagicAudio (Kenney CC0 cues, warm synthesized fallback).
export const sfx = {
  tap: () => MagicAudio.playSfx("tap"),
  correct: () => MagicAudio.playSfx("success", { volume: 0.75 }),
  wrong: () => MagicAudio.playSfx("wrong"),
  celebrate: () => MagicAudio.playSfx("success"),
  // slider feedback: a short soft tick whose pitch follows the slider (k = 0 … 1)
  pitch: (k) => MagicAudio.playSfx("tick", { pitch: k }),
};
