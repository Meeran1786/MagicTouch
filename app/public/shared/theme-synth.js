// MagicTouch theme sounds made in code (Web Audio, rendered once offline): the real-world sounds
// that can be built from noise and tones — weather, water, machines, vehicles, engines, bubbles,
// insects' wings and legs, fire, coins, a heartbeat, phones, magic sparkles, a bell, a drum. They are our own, so there is nothing to license. A recording with the same name in
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

  // a motorbike or scooter: a buzzing two-stroke engine revving past, 2.6 s
  motorcycle: [
    2.6,
    (c) =>
      engine(
        c,
        2.6,
        48,
        [
          [0, 40],
          [0.9, 95],
          [1.7, 70],
          [2.6, 50],
        ],
        900,
        0.4,
      ),
  ],
  // an auto-rickshaw: a putt-putt three-wheeler pulling away, with a squeeze horn, 2.6 s
  rickshaw: [
    2.6,
    (c) => {
      engine(
        c,
        2.6,
        26,
        [
          [0, 24],
          [2.6, 34],
        ],
        700,
        0.45,
      );
      honk(c, 1.6, 0.18, [622]);
      honk(c, 1.85, 0.25, [587]);
    },
  ],
  // a tractor: a slow, heavy diesel chug, 3 s
  tractor: [
    3,
    (c) =>
      engine(
        c,
        3,
        9,
        [
          [0, 8],
          [3, 11],
        ],
        380,
        0.6,
      ),
  ],
  // a race car: a high engine screaming up through the gears, 2.6 s
  racecar: [
    2.6,
    (c) =>
      engine(
        c,
        2.6,
        120,
        [
          [0, 90],
          [0.9, 260],
          [1.0, 170],
          [2.0, 320],
          [2.6, 300],
        ],
        2600,
        0.35,
      ),
  ],
  // a speedboat: an outboard motor over splashing water, 3 s
  speedboat: [
    3,
    (c) => {
      engine(
        c,
        3,
        70,
        [
          [0, 60],
          [1, 110],
          [3, 105],
        ],
        1400,
        0.3,
      );
      const n = noise(c, 3),
        bp = filter(c, "bandpass", 1600, 0.6),
        g = gain(c, 0);
      env(g.gain, [
        [0, 0],
        [1, 0.25],
        [2.6, 0.25],
        [3, 0],
      ]);
      lfo(c, g.gain, 3, 0.1, 3);
      n.connect(bp).connect(g).connect(c.destination);
      n.start(0);
    },
  ],
  // water bubbles rising (fish, sea creatures, a pond), 2.4 s
  bubbles: [
    2.4,
    (c) => {
      for (let k = 0; k < 14; k++) {
        const t = Math.random() * 2,
          f = 300 + Math.random() * 500,
          o = osc(c, "sine", f),
          g = gain(c, 0);
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.12);
        env(g.gain, [
          [t, 0],
          [t + 0.01, 0.35],
          [t + 0.12, 0],
        ]);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.14);
      }
    },
  ],
  // a splash in water, 1.4 s
  splash: [1.4, (c) => burst(c, 0, 1.2, "bandpass", 1200, 0.5, 0.9)],
  // butterfly / moth wings: soft, fast fluttering, 1.6 s
  flutter: [
    1.6,
    (c) => {
      const n = noise(c, 1.6),
        bp = filter(c, "bandpass", 900, 0.8),
        g = gain(c, 0);
      env(g.gain, [
        [0, 0],
        [0.2, 0.2],
        [1.3, 0.2],
        [1.6, 0],
      ]);
      lfo(c, g.gain, 16, 0.18, 1.6);
      n.connect(bp).connect(g).connect(c.destination);
      n.start(0);
    },
  ],
  // a hummingbird / dragonfly: a fast wing whirr, 1.6 s
  whirr: [
    1.6,
    (c) => {
      const o = osc(c, "triangle", 48),
        bp = filter(c, "bandpass", 250, 1),
        g = gain(c, 0);
      env(g.gain, [
        [0, 0],
        [0.2, 0.5],
        [1.3, 0.5],
        [1.6, 0],
      ]);
      lfo(c, o.frequency, 2, 6, 1.6);
      o.connect(bp).connect(g).connect(c.destination);
      o.start(0);
      o.stop(1.6);
    },
  ],
  // tiny legs scurrying (ant, spider, ladybug, cockroach, scorpion), 1.4 s
  skitter: [
    1.4,
    (c) => {
      for (let k = 0; k < 22; k++) tick(c, 0.05 + k * 0.055 + Math.random() * 0.02, 3500 + Math.random() * 2500, 0.25);
    },
  ],
  // something hopping (kangaroo, rabbit): three soft thumps, 1.4 s
  hop: [1.4, (c) => [0, 0.42, 0.84].forEach((t) => thump(c, t, 1))],
  // leaves rustling (tortoise, snail, lizard in the grass), 1.8 s
  rustle: [
    1.8,
    (c) => {
      const n = noise(c, 1.8),
        hp = filter(c, "highpass", 2500),
        g = gain(c, 0);
      env(g.gain, [
        [0, 0],
        [0.3, 0.3],
        [0.6, 0.08],
        [1, 0.3],
        [1.4, 0.1],
        [1.8, 0],
      ]);
      lfo(c, g.gain, 9, 0.08, 1.8);
      n.connect(hp).connect(g).connect(c.destination);
      n.start(0);
    },
  ],
  // a fire crackling (campfire, candle, fire), 3 s
  crackle: [
    3,
    (c) => {
      const n = noise(c, 3, "brown"),
        lp = filter(c, "lowpass", 500);
      n.connect(lp).connect(gain(c, 0.5)).connect(c.destination);
      n.start(0);
      for (let k = 0; k < 40; k++)
        tick(c, Math.random() * 2.9, 1500 + Math.random() * 4000, 0.2 + Math.random() * 0.6, "noise");
    },
  ],
  // a balloon or party popper going pop, 1 s
  pop: [
    1,
    (c) => {
      burst(c, 0.05, 0.12, "lowpass", 3500, 0.7, 1);
      thump(c, 0.05, 0.6);
    },
  ],
  // coins clinking (money, wallet, shop), 1.6 s
  coin: [1.6, (c) => [0, 0.16, 0.3, 0.52].forEach((t, i) => chime(c, t, [2637, 3520, 4186, 3136][i], 0.35))],
  // a heartbeat (stethoscope, heart), 2.4 s
  heartbeat: [2.4, (c) => [0, 0.28, 1.1, 1.38].forEach((t, i) => thump(c, t, i % 2 ? 0.7 : 1, 60))],
  // a mobile phone ringtone, 2.4 s
  ringtone: [
    2.4,
    (c) =>
      [0, 0.14, 0.28, 0.42, 1.2, 1.34, 1.48, 1.62].forEach((t, i) =>
        beep(c, t, 0.12, [1319, 1568, 1976, 1568][i % 4], 0.25),
      ),
  ],
  // a robot: bleeps and bloops, 2 s
  robot: [
    2,
    (c) =>
      [0, 0.2, 0.35, 0.7, 0.9, 1.3].forEach((t, i) =>
        beep(c, t, 0.14, [880, 660, 1320, 440, 990, 1760][i], 0.22, "square"),
      ),
  ],
  // a video game: a happy eight-bit tune, 2 s
  chiptune: [
    2,
    (c) => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(c, i * 0.16, 0.14, f, 0.2, "square")),
  ],
  // dice rattling and rolling on a table, 1.6 s
  dice: [
    1.6,
    (c) => {
      for (let k = 0; k < 12; k++)
        tick(c, 0.05 + k * 0.11 * (1 + k * 0.04), 1800 + Math.random() * 1500, 0.6 - k * 0.04, "noise");
    },
  ],
  // magic sparkle (fairy, wizard, unicorn, rainbow, star), 2 s
  magic: [2, (c) => [1568, 2093, 2637, 3136, 3520, 4186, 3520, 4699].forEach((f, i) => chime(c, i * 0.12, f, 0.22))],
  // a whoosh going past (comet, kite, swing), 1.6 s
  whoosh: [
    1.6,
    (c) => {
      const n = noise(c, 1.6),
        bp = filter(c, "bandpass", 400, 1.4),
        g = gain(c, 0);
      env(bp.frequency, [
        [0, 300],
        [0.8, 2200],
        [1.6, 500],
      ]);
      env(g.gain, [
        [0, 0],
        [0.8, 0.6],
        [1.6, 0],
      ]);
      n.connect(bp).connect(g).connect(c.destination);
      n.start(0);
    },
  ],
  // a hot-air balloon burner: a roaring flame, 2.4 s
  burner: [2.4, (c) => burst(c, 0.1, 2, "lowpass", 900, 0.8, 0.9)],
  // keys jingling, 1.4 s
  keys: [
    1.4,
    (c) => {
      for (let k = 0; k < 9; k++) chime(c, Math.random() * 0.9, 3000 + Math.random() * 3000, 0.18);
    },
  ],
  // water dripping (tap, sink, water drop), 2 s
  drip: [
    2,
    (c) =>
      [0, 0.6, 1.2].forEach((t) => {
        const o = osc(c, "sine", 900),
          g = gain(c, 0);
        o.frequency.setValueAtTime(900, t);
        o.frequency.exponentialRampToValueAtTime(1800, t + 0.06);
        env(g.gain, [
          [t, 0],
          [t + 0.005, 0.5],
          [t + 0.09, 0],
        ]);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.1);
      }),
  ],
  // a hiss (fire extinguisher, spray, snake), 1.8 s
  hiss: [1.8, (c) => burst(c, 0.05, 1.6, "highpass", 3000, 0.6, 0.6)],
  // radio or television static, tuning in, 2 s
  static: [
    2,
    (c) => {
      burst(c, 0, 1.2, "bandpass", 2500, 0.4, 0.35);
      beep(c, 1.2, 0.6, 1000, 0.15, "sine");
    },
  ],
  // a deep rumble (volcano, earthquake, mountain), 3 s
  rumble: [3, (c) => burst(c, 0.05, 2.8, "lowpass", 140, 0.6, 2)],
  // a ball bouncing, 1.6 s
  bounce: [1.6, (c) => [0, 0.5, 0.86, 1.12, 1.3].forEach((t, i) => thump(c, t, 1 - i * 0.17, 180))],
  // playing cards being shuffled, 1.4 s
  shuffle: [
    1.4,
    (c) => {
      for (let k = 0; k < 26; k++) tick(c, 0.1 + k * 0.04, 3000, 0.25, "noise");
    },
  ],
  // scissors snipping, 1.2 s
  snip: [
    1.2,
    (c) =>
      [0.05, 0.5].forEach((t) => {
        tick(c, t, 4000, 0.6, "noise");
        tick(c, t + 0.06, 5500, 0.4, "noise");
      }),
  ],
  // a knock on the door, 1.2 s
  knock: [1.2, (c) => [0, 0.22, 0.44].forEach((t) => thump(c, t, 0.9, 220))],
};
// an engine: a sawtooth at the firing rate (Hz) following a pitch curve, through a low-pass
function engine(c, len, f, curve, cutoff, level) {
  const o = osc(c, "sawtooth", f),
    lp = filter(c, "lowpass", cutoff),
    g = gain(c, 0);
  env(o.frequency, curve);
  env(g.gain, [
    [0, 0],
    [0.15, level],
    [len - 0.3, level],
    [len, 0],
  ]);
  o.connect(lp).connect(g).connect(c.destination);
  o.start(0);
  o.stop(len);
  const n = noise(c, len, "brown"),
    nl = filter(c, "lowpass", cutoff / 2),
    ng = gain(c, level);
  n.connect(nl).connect(ng).connect(c.destination);
  n.start(0);
}
// a burst of filtered noise from t for len seconds
function burst(c, t, len, type, f, q, level) {
  const n = noise(c, len, type === "lowpass" && f < 300 ? "brown" : "white"),
    x = filter(c, type, f, q),
    g = gain(c, 0);
  env(g.gain, [
    [t, 0],
    [t + Math.min(0.05, len / 4), level],
    [t + len * 0.6, level * 0.6],
    [t + len, 0],
  ]);
  n.connect(x).connect(g).connect(c.destination);
  n.start(t);
}
// a tiny click: a short tone or noise grain at f Hz
function tick(c, t, f, level, kind) {
  const s = kind === "noise" ? noise(c, 0.03) : osc(c, "square", f),
    bp = filter(c, "bandpass", f, kind === "noise" ? 2 : 8),
    g = gain(c, 0);
  env(g.gain, [
    [t, 0],
    [t + 0.002, level],
    [t + 0.025, 0],
  ]);
  s.connect(bp).connect(g).connect(c.destination);
  s.start(t);
  if (s.stop) s.stop(t + 0.04);
}
// a soft low thump (a hop, a heartbeat, a bounce, a knock)
function thump(c, t, level, f = 90) {
  const o = osc(c, "sine", f * 1.6),
    g = gain(c, 0);
  o.frequency.setValueAtTime(f * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
  env(g.gain, [
    [t, 0],
    [t + 0.004, 0.9 * level],
    [t + 0.2, 0],
  ]);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.22);
}
// a short bright bell-like ping
function chime(c, t, f, level) {
  // the upper partial only while it stays under the render's Nyquist limit (11 kHz)
  [1, 2.76].forEach((m, i) => {
    if (f * m > 10500) return;
    const o = osc(c, "sine", f * m),
      g = gain(c, 0);
    env(g.gain, [
      [t, 0],
      [t + 0.003, level / (i * 2 + 1)],
      [t + 0.45, 0],
    ]);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.5);
  });
}
// a plain beep
function beep(c, t, len, f, level, type = "sine") {
  const o = osc(c, type, f),
    lp = filter(c, "lowpass", 4000),
    g = gain(c, 0);
  env(g.gain, [
    [t, 0],
    [t + 0.008, level],
    [t + len - 0.02, level],
    [t + len, 0],
  ]);
  o.connect(lp).connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + len + 0.01);
}
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
  motorbike: "motorcycle",
  scooter: "motorcycle",
  auto: "rickshaw",
  "auto-rickshaw": "rickshaw",
  "race-car": "racecar",
  "racing-car": "racecar",
  taxi: "car",
  van: "car",
  jeep: "car",
  trolleybus: "bus",
  "fire-truck": "bus",
  "cable-car": "electric",
  metro: "electric",
  fish: "bubbles",
  goldfish: "bubbles",
  starfish: "bubbles",
  jellyfish: "bubbles",
  octopus: "bubbles",
  crab: "bubbles",
  shark: "bubbles",
  turtle: "bubbles",
  tadpole: "bubbles",
  tadpoles: "bubbles",
  "sea-shell": "waves",
  shell: "waves",
  butterfly: "flutter",
  moth: "flutter",
  caterpillar: "skitter",
  ant: "skitter",
  spider: "skitter",
  ladybug: "skitter",
  cockroach: "skitter",
  scorpion: "skitter",
  hummingbird: "whirr",
  dragonfly: "whirr",
  kangaroo: "hop",
  rabbit: "hop",
  bunny: "hop",
  tortoise: "rustle",
  snail: "rustle",
  iguana: "rustle",
  lizard: "rustle",
  sloth: "rustle",
  hedgehog: "rustle",
  fire: "crackle",
  campfire: "crackle",
  candle: "crackle",
  balloon: "pop",
  "party-popper": "pop",
  money: "coin",
  coins: "coin",
  cash: "coin",
  wallet: "coin",
  bank: "coin",
  heart: "heartbeat",
  stethoscope: "heartbeat",
  "mobile-phone": "ringtone",
  mobile: "ringtone",
  phone: "ringtone",
  "video-game": "chiptune",
  game: "chiptune",
  fairy: "magic",
  wizard: "magic",
  genie: "magic",
  unicorn: "magic",
  mermaid: "magic",
  rainbow: "magic",
  sparkles: "magic",
  star: "magic",
  comet: "whoosh",
  kite: "whoosh",
  "hot-air-balloon": "burner",
  key: "keys",
  "water-drop": "drip",
  sink: "drip",
  "fire-extinguisher": "hiss",
  snake: "hiss",
  radio: "static",
  television: "static",
  tv: "static",
  volcano: "rumble",
  earthquake: "rumble",
  ball: "bounce",
  football: "bounce",
  basketball: "bounce",
  "soccer-ball": "bounce",
  "playing-cards": "shuffle",
  cards: "shuffle",
  scissors: "snip",
  door: "knock",
  bike: "bicycle",
  cycle: "bicycle",
  tabla: "drum",
  dhol: "drum",
  tick: "clock",
  tennis: "bounce",
  volleyball: "bounce",
  baseball: "bounce",
  racket: "bounce",
  rat: "skitter",
  mouse: "skitter",
  fan: "wind",
  cloudy: "wind",
  snowy: "wind",
  windy: "wind",
  winter: "wind",
  autumn: "wind",
  desert: "wind",
  mountain: "wind",
  cold: "wind",
  snowflake: "wind",
  hot: "crackle",
  fast: "racecar",
  slow: "rustle",
  leaves: "rustle",
  astronaut: "static",
  alien: "robot",
  popcorn: "pop",
  "confetti-ball": "pop",
  gift: "magic",
  superhero: "whoosh",
  skiing: "whoosh",
  skateboard: "whoosh",
  "roller-skate": "whoosh",
  sled: "whoosh",
  "ice-skate": "whoosh",
  "yo-yo": "whoosh",
  pot: "bubbles",
  honey: "bee",
  wheat: "tractor",
  chess: "knock",
  blocks: "knock",
  "boxing-glove": "knock",
  cycling: "bicycle",
  stopwatch: "clock",
  watch: "clock",
  hourglass: "clock",
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
