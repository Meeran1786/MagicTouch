// MagicTouch theme sounds made in code (Web Audio, rendered once offline): the real-world sounds
// that can be built from noise and tones — weather, water, machines, vehicles, a bell, a drum, a
// bee. They are our own, so there is nothing to license. A recording with the same name in
// /assets/sfx/themes/ always wins (audio-engine.js, MagicAudio.playTheme); animals need recordings.
//
//   import { synthTheme, renderTheme } from "/shared/theme-synth.js";
//   renderTheme(synthTheme("aeroplane")) → Promise<AudioBuffer | null>

const SR = 22050;
const cache = new Map();

// ── building blocks ─────────────────────────────────────────────────────
function noiseBuffer(c, seconds, colour = "white") {
  const n = Math.floor(c.sampleRate * seconds),
    b = c.createBuffer(1, n, c.sampleRate),
    d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (colour === "brown") {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return b;
}
function noise(c, seconds, colour) {
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c, seconds, colour);
  return s;
}
function filter(c, type, f, q = 0.7) {
  const x = c.createBiquadFilter();
  x.type = type;
  x.frequency.value = f;
  x.Q.value = q;
  return x;
}
function gain(c, v = 1) {
  const g = c.createGain();
  g.gain.value = v;
  return g;
}
// an envelope: points [[time, level], …], linear between them
function env(param, points) {
  param.setValueAtTime(points[0][1], points[0][0]);
  for (const [t, v] of points.slice(1)) param.linearRampToValueAtTime(v, t);
}
function osc(c, type, f) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = f;
  return o;
}
// a slow wobble on a parameter: depth around its value, rate in Hz
function lfo(c, param, rate, depth, len) {
  const o = osc(c, "sine", rate),
    g = gain(c, depth);
  o.connect(g).connect(param);
  o.start(0);
  o.stop(len);
}

// ── the sounds: each builds its graph into c.destination and returns nothing ─
const SOUNDS = {
  // a jet passing over: rising then falling roar with a whine (Doppler), 3.5 s
  airplane: [
    3.5,
    (c) => {
      const out = gain(c, 0);
      env(out.gain, [
        [0, 0],
        [1.6, 0.9],
        [2.2, 0.9],
        [3.5, 0],
      ]);
      out.connect(c.destination);
      const n = noise(c, 3.5),
        bp = filter(c, "bandpass", 500, 0.6);
      env(bp.frequency, [
        [0, 350],
        [1.8, 1400],
        [3.5, 420],
      ]);
      n.connect(bp).connect(out);
      const r = noise(c, 3.5, "brown"),
        lp = filter(c, "lowpass", 180);
      r.connect(lp).connect(gain(c, 0.9)).connect(out);
      const w = osc(c, "sawtooth", 1900),
        wl = filter(c, "lowpass", 2600),
        wg = gain(c, 0.035);
      env(w.frequency, [
        [0, 2100],
        [1.8, 1900],
        [3.5, 1500],
      ]);
      w.connect(wl).connect(wg).connect(out);
      [n, r, w].forEach((s) => s.start(0));
      w.stop(3.5);
    },
  ],
  // rotor thump about 11 times a second over an engine whine, 3 s
  helicopter: [
    3,
    (c) => {
      const out = gain(c, 0);
      env(out.gain, [
        [0, 0],
        [0.4, 0.9],
        [2.5, 0.9],
        [3, 0],
      ]);
      out.connect(c.destination);
      const n = noise(c, 3, "brown"),
        lp = filter(c, "lowpass", 420),
        chop = gain(c, 0.45);
      lfo(c, chop.gain, 11, 0.45, 3);
      n.connect(lp).connect(chop).connect(out);
      const e = osc(c, "sawtooth", 95),
        el = filter(c, "lowpass", 600),
        eg = gain(c, 0.06);
      e.connect(el).connect(eg).connect(out);
      n.start(0);
      e.start(0);
      e.stop(3);
    },
  ],
  // an engine idling, then two short honks, 2.4 s
  car: [
    2.4,
    (c) => {
      const engine = osc(c, "sawtooth", 55),
        el = filter(c, "lowpass", 260),
        eg = gain(c, 0);
      env(eg.gain, [
        [0, 0],
        [0.2, 0.35],
        [2.1, 0.35],
        [2.4, 0],
      ]);
      lfo(c, eg.gain, 18, 0.12, 2.4);
      engine.connect(el).connect(eg).connect(c.destination);
      engine.start(0);
      engine.stop(2.4);
      [0.7, 1.25].forEach((t) => honk(c, t, 0.32, [415, 523]));
    },
  ],
  // a bus horn: one long low honk, 1.4 s
  bus: [1.4, (c) => honk(c, 0.05, 1.1, [262, 330])],
  // a ship's horn: a deep blast that fills the harbour, 2.6 s
  ship: [
    2.6,
    (c) => {
      const g = gain(c, 0);
      env(g.gain, [
        [0, 0],
        [0.25, 0.5],
        [2.1, 0.5],
        [2.6, 0],
      ]);
      const lp = filter(c, "lowpass", 700);
      lp.connect(g).connect(c.destination);
      [110, 112, 165].forEach((f) => {
        const o = osc(c, "sawtooth", f);
        o.connect(lp);
        o.start(0);
        o.stop(2.6);
      });
    },
  ],
  // a rocket lifting off: a deep roar that swells and crackles, 3.5 s
  rocket: [
    3.5,
    (c) => {
      const out = gain(c, 0);
      env(out.gain, [
        [0, 0],
        [0.6, 1],
        [2.8, 0.9],
        [3.5, 0],
      ]);
      out.connect(c.destination);
      const r = noise(c, 3.5, "brown"),
        lp = filter(c, "lowpass", 300);
      env(lp.frequency, [
        [0, 200],
        [3.5, 900],
      ]);
      r.connect(lp).connect(gain(c, 1.4)).connect(out);
      const h = noise(c, 3.5),
        hp = filter(c, "bandpass", 1800, 0.5);
      h.connect(hp).connect(gain(c, 0.18)).connect(out);
      r.start(0);
      h.start(0);
    },
  ],
  // a bicycle bell: two bright rings, 1.6 s
  bicycle: [1.6, (c) => [0, 0.32].forEach((t) => ring(c, t, 0.4))],
  // electricity: a mains hum with a few crackling sparks, 2 s
  electric: [
    2,
    (c) => {
      const g = gain(c, 0);
      env(g.gain, [
        [0, 0],
        [0.15, 0.22],
        [1.8, 0.22],
        [2, 0],
      ]);
      const lp = filter(c, "lowpass", 900);
      lp.connect(g).connect(c.destination);
      [100, 200, 300].forEach((f, i) => {
        const o = osc(c, i ? "sine" : "sawtooth", f);
        o.connect(gain(c, 1 / (i + 1))).connect(lp);
        o.start(0);
        o.stop(2);
      });
      for (let k = 0; k < 7; k++) {
        const t = 0.2 + Math.random() * 1.5,
          s = noise(c, 0.04),
          hp = filter(c, "highpass", 2500),
          sg = gain(c, 0);
        env(sg.gain, [
          [t, 0],
          [t + 0.002, 0.5 + Math.random() * 0.4],
          [t + 0.035, 0],
        ]);
        s.connect(hp).connect(sg).connect(c.destination);
        s.start(t);
      }
    },
  ],
  // thunder: a sharp crack, then a long rolling rumble, 4.5 s
  thunder: [
    4.5,
    (c) => {
      const crack = noise(c, 0.4),
        cg = gain(c, 0),
        cl = filter(c, "lowpass", 3000);
      env(cg.gain, [
        [0, 0],
        [0.01, 0.9],
        [0.35, 0],
      ]);
      crack.connect(cl).connect(cg).connect(c.destination);
      crack.start(0);
      const rum = noise(c, 4.5, "brown"),
        rl = filter(c, "lowpass", 160),
        rg = gain(c, 0);
      env(rg.gain, [
        [0, 0],
        [0.15, 1.6],
        [1.2, 1.1],
        [2.2, 1.4],
        [4.5, 0],
      ]);
      lfo(c, rg.gain, 1.7, 0.35, 4.5);
      rum.connect(rl).connect(rg).connect(c.destination);
      rum.start(0);
    },
  ],
  // wind: soft noise that gusts and sighs (loops), 8 s
  wind: [
    8,
    (c) => {
      const n = noise(c, 8),
        bp = filter(c, "bandpass", 500, 0.9),
        g = gain(c, 0.25);
      lfo(c, bp.frequency, 0.18, 260, 8);
      lfo(c, g.gain, 0.25, 0.12, 8);
      n.connect(bp).connect(g).connect(c.destination);
      n.start(0);
    },
    { loop: true },
  ],
  // sea waves rolling in and drawing back (loops), 8 s
  waves: [
    8,
    (c) => {
      const n = noise(c, 8),
        lp = filter(c, "lowpass", 900),
        g = gain(c, 0);
      env(g.gain, [
        [0, 0.05],
        [1.6, 0.55],
        [4, 0.08],
        [5.6, 0.55],
        [8, 0.05],
      ]);
      env(lp.frequency, [
        [0, 400],
        [1.6, 1400],
        [4, 450],
        [5.6, 1400],
        [8, 400],
      ]);
      n.connect(lp).connect(g).connect(c.destination);
      n.start(0);
    },
    { loop: true },
  ],
  // a bee buzzing past, 2 s
  bee: [
    2,
    (c) => {
      const o = osc(c, "sawtooth", 225),
        bp = filter(c, "bandpass", 700, 1.2),
        g = gain(c, 0);
      lfo(c, o.frequency, 6, 12, 2);
      env(g.gain, [
        [0, 0],
        [0.5, 0.3],
        [1.4, 0.3],
        [2, 0],
      ]);
      o.connect(bp).connect(g).connect(c.destination);
      o.start(0);
      o.stop(2);
    },
  ],
  // a drum: dum, dum, da-dum, 1.6 s
  drum: [1.6, (c) => [0, 0.42, 0.84, 1.05].forEach((t, i) => skin(c, t, i === 2 ? 0.7 : 1))],
  // a clock ticking, 2 s
  clock: [
    2,
    (c) => {
      for (let k = 0; k < 4; k++) {
        const t = k * 0.5,
          o = osc(c, "square", k % 2 ? 1800 : 2200),
          bp = filter(c, "bandpass", k % 2 ? 1800 : 2200, 8),
          g = gain(c, 0);
        env(g.gain, [
          [t, 0],
          [t + 0.002, 0.5],
          [t + 0.03, 0],
        ]);
        o.connect(bp).connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.05);
      }
    },
  ],
};
function honk(c, t, len, freqs) {
  const g = gain(c, 0),
    lp = filter(c, "lowpass", 2200);
  env(g.gain, [
    [t, 0],
    [t + 0.02, 0.22],
    [t + len - 0.03, 0.22],
    [t + len, 0],
  ]);
  lp.connect(g).connect(c.destination);
  freqs.forEach((f) => {
    const o = osc(c, "square", f);
    o.connect(lp);
    o.start(t);
    o.stop(t + len + 0.02);
  });
}
function ring(c, t, level) {
  [2093, 2794, 4186, 5274].forEach((f, i) => {
    const o = osc(c, "sine", f),
      g = gain(c, 0);
    env(g.gain, [
      [t, 0],
      [t + 0.003, level / (i + 1)],
      [t + 1.1 - i * 0.2, 0],
    ]);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 1.2);
  });
}
function skin(c, t, level) {
  const o = osc(c, "sine", 140),
    g = gain(c, 0);
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.3);
  env(g.gain, [
    [t, 0],
    [t + 0.004, 0.9 * level],
    [t + 0.4, 0],
  ]);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.45);
  const n = noise(c, 0.08),
    bp = filter(c, "bandpass", 900, 0.8),
    ng = gain(c, 0);
  env(ng.gain, [
    [t, 0],
    [t + 0.002, 0.35 * level],
    [t + 0.07, 0],
  ]);
  n.connect(bp).connect(ng).connect(c.destination);
  n.start(t);
}

// other names for the same sound
const ALIASES = {
  aeroplane: "airplane",
  plane: "airplane",
  jet: "airplane",
  aircraft: "airplane",
  chopper: "helicopter",
  electricity: "electric",
  current: "electric",
  spark: "electric",
  circuit: "electric",
  storm: "thunder",
  lightning: "thunder",
  sea: "waves",
  ocean: "waves",
  beach: "waves",
  breeze: "wind",
  boat: "ship",
  steamer: "ship",
  truck: "bus",
  lorry: "bus",
  motorbike: "car",
  scooter: "car",
  auto: "car",
  rickshaw: "car",
  bike: "bicycle",
  cycle: "bicycle",
  tabla: "drum",
  dhol: "drum",
  tick: "clock",
};
/** The names this module can make (aliases included). */
export const synthNames = [...Object.keys(SOUNDS), ...Object.keys(ALIASES)];
/** The sound made in code for this theme name, or "" when there is none. */
export const synthTheme = (name) => (SOUNDS[name] ? name : ALIASES[name] || "");
/** Whether a theme sound made in code should loop when played as ambience. */
export const synthLoops = (name) => !!(SOUNDS[name] && SOUNDS[name][2] && SOUNDS[name][2].loop);

/** Renders a theme sound once (cached): Promise<AudioBuffer | null>. */
export function renderTheme(name) {
  const s = SOUNDS[name];
  if (!s) return Promise.resolve(null);
  if (!cache.has(name)) {
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const c = new Off(1, Math.ceil(SR * s[0]), SR);
    s[1](c);
    cache.set(
      name,
      c.startRendering().then((b) => {
        // level match: about −18 dBFS RMS like the recorded theme sounds, peaks kept under −2 dBFS
        const d = b.getChannelData(0);
        let pk = 0,
          sq = 0;
        for (let i = 0; i < d.length; i++) {
          pk = Math.max(pk, Math.abs(d[i]));
          sq += d[i] * d[i];
        }
        const rms = Math.sqrt(sq / d.length);
        const k = pk > 0 ? Math.min(0.8 / pk, 0.126 / rms) : 1;
        for (let i = 0; i < d.length; i++) d[i] *= k;
        return b;
      }),
    );
  }
  return cache.get(name);
}
