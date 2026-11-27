// MagicTouch motion engine: the shared motion, sound and control layer of the Gold Standard
// (reference: /engine/templates/reference-ohms-law.html). Every template and simulation uses these
// instead of writing its own. Pair it with /shared/studio-base.css. Plain ES module, no libraries,
// works offline.
//
//   import { ME } from "/shared/motion-engine.js";
//
// Device and motion
//   ME.lowSpec()                 window.MAGICTOUCH_LOW_SPEC (set by ?lowspec=1 or localStorage mtLowSpec = "1")
//   ME.calm()                    prefers-reduced-motion: no moving particles, numbers jump, looks switch at once
//   ME.loop(el, fn(dt, t))       requestAnimationFrame loop; pauses while the page is hidden, stops when el
//                                leaves the page; returns stop()
//   ME.ease(cur, target, dt, r)  number roll-up (exponential ease, r ≈ 9 for read-outs)
//   ME.spring(k, c)              {x, v, step(target, dt)}: needles, knobs (k 90, c 11 = a little overshoot)
//   ME.burst(el)                 1.2 s canvas confetti from el: ≤ 60 pieces, 24 low-spec, none when calm
// Sound (procedural Web Audio, one global switch shared with the wall launcher)
//   ME.sound.on() / set(on) / tap() / good() / bad() / win() / pitch(0…1)
// Canvas
//   ME.stage(holder, W, H, onSize)  an elevated .st-stage that keeps W:H and fits holder; canvas at the
//                                   right pixel ratio (1× on low-spec). onSize({scale, dpr, canvas}) redraws
//                                   cached layers. Returns {box, canvas, ctx, scale(), dpr(), begin(), stop()}
//   ME.layer(w, h)               an offscreen canvas for art drawn once per size
//   ME.track(points)             a polyline that particles ride: {len, at(f 0…1) → [x, y]}
//   ME.pill(ctx, x, y, text, {size, bg, color, line, weight})   a projector-readable label pill
//   ME.graph(canvas)             projector-readable x–y graph: draw({xMax, yMax, xLabel, yLabel, lines, point, note})
// Controls (IR-pen sized: never make them smaller)
//   ME.slider(host, spec, onChange)    −/track/+ slider; knob moves by transform with a spring; pitch tick
//   ME.toggle(host, options, current, onChange)   segmented switch, e.g. Real | Diagram
//   ME.soundButton(host)         the speaker button (global mute)
import { audioCtx, sfx as soft, sfxOn } from "/shared/studio/soft-music.js";

export const PALETTE = {
  white: "#FFFFFF",
  tint: "#F7F1F5",
  plum: "#631654",
  plumDark: "#3D0E37",
  magenta: "#CC3054",
  orange: "#E96E24",
  amber: "#F3A328",
  yellow: "#FBD064",
  green: "#2FA86A",
  ink: "#242430",
  mute: "#5D5464",
  line: "#EADBE5",
};
export const FONT = "Carlito, Calibri, 'Segoe UI', sans-serif";

// ── device and motion ─────────────────────────────────────────────────────
try {
  if (new URLSearchParams(location.search).get("lowspec") === "1" || localStorage.getItem("mtLowSpec") === "1")
    window.MAGICTOUCH_LOW_SPEC = true;
} catch {
  /* storage blocked */
}
function lowSpec() {
  return !!window.MAGICTOUCH_LOW_SPEC;
}
function calm() {
  return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function loop(el, fn) {
  let raf = 0,
    last = 0,
    dead = false;
  function frame(now) {
    raf = 0;
    if (dead) return;
    if (el && !el.isConnected) return stop();
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    fn(dt, now / 1000);
    if (!document.hidden && !dead) raf = requestAnimationFrame(frame);
  }
  function vis() {
    if (!document.hidden && !raf && !dead) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  function stop() {
    dead = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", vis);
  }
  document.addEventListener("visibilitychange", vis);
  raf = requestAnimationFrame(frame);
  return stop;
}
function ease(cur, target, dt, rate) {
  return cur + (target - cur) * (1 - Math.exp(-dt * rate));
}
function spring(k, c) {
  const s = {
    x: 0,
    v: 0,
    step: function (target, dt) {
      if (calm()) {
        s.x = target;
        s.v = 0;
      } else {
        s.v += ((k || 90) * (target - s.x) - (c || 11) * s.v) * dt;
        s.x += s.v * dt;
      }
      return s.x;
    },
  };
  return s;
}

// ── sound ────────────────────────────────────────────────────────────────
let lastPitch = 0;
function play(fn) {
  if (!sfxOn()) return;
  try {
    audioCtx().resume();
    fn();
  } catch {
    /* audio not allowed yet */
  }
}
const sound = {
  on: function () {
    return sfxOn();
  },
  set: function (on) {
    try {
      localStorage.setItem("mtSfxOn", on ? "1" : "0");
    } catch {
      /* storage blocked */
    }
    if (!on && window.speechSynthesis) speechSynthesis.cancel();
  },
  tap: function () {
    play(soft.tap);
  },
  good: function () {
    play(soft.correct);
  },
  bad: function () {
    play(soft.wrong);
  },
  win: function () {
    play(soft.celebrate);
  },
  // k = 0 … 1 (where the slider is); at most one tick every 45 ms while dragging
  pitch: function (k) {
    const now = performance.now();
    if (now - lastPitch < 45) return;
    lastPitch = now;
    play(function () {
      soft.pitch(k);
    });
  },
};

// ── confetti burst ───────────────────────────────────────────────────────
function burst(el) {
  if (calm() || !el) return;
  const r = el.getBoundingClientRect(),
    dpr = lowSpec() ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement("canvas");
  cv.className = "st-burst";
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  document.body.appendChild(cv);
  const c = cv.getContext("2d"),
    cols = [PALETTE.plum, PALETTE.magenta, PALETTE.orange, PALETTE.amber, PALETTE.yellow, PALETTE.green],
    ox = r.left + r.width / 2,
    oy = r.top + r.height / 2,
    bits = [];
  const n = lowSpec() ? 24 : 60; // design system: at most 60 confetti pieces
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2,
      v = 260 + Math.random() * 420;
    bits.push({
      x: ox + (Math.random() - 0.5) * r.width * 0.6,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 260,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 14,
      w: 8 + Math.random() * 8,
      h: 5 + Math.random() * 5,
      col: cols[i % cols.length],
    });
  }
  let life = 0;
  function end() {
    stop();
    cv.remove();
  }
  const stop = loop(cv, function (dt) {
    life += dt;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.globalAlpha = clamp((1.2 - life) / 0.35, 0, 1);
    bits.forEach(function (b) {
      b.vy += 900 * dt;
      b.vx *= 1 - 1.6 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.rot);
      c.scale(1, Math.cos(b.rot * 1.7)); // flutter
      c.fillStyle = b.col;
      c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      c.restore();
    });
    if (life >= 1.2) end();
  });
  setTimeout(end, 2500); // the page may be hidden mid-burst
}

// ── canvas helpers ───────────────────────────────────────────────────────
function layer(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function track(pts) {
  const segs = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a: a, b: b, s: len, l: l });
    len += l;
  }
  return {
    len: len,
    at: function (f) {
      const d = (((f % 1) + 1) % 1) * len;
      let lo = 0,
        hi = segs.length - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (segs[m].s <= d) lo = m;
        else hi = m - 1;
      }
      const g = segs[lo],
        k = (d - g.s) / g.l;
      return [g.a[0] + (g.b[0] - g.a[0]) * k, g.a[1] + (g.b[1] - g.a[1]) * k];
    },
  };
}
function pill(c, x, y, text, opt) {
  opt = opt || {};
  const size = opt.size || 18;
  c.font = (opt.weight || 700) + " " + size + "px " + FONT;
  const w = c.measureText(text).width + 28,
    h = size + 14;
  c.fillStyle = opt.bg || PALETTE.white;
  c.strokeStyle = opt.line || "rgba(99,22,84,.15)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  c.fill();
  if (opt.line !== "none") c.stroke();
  c.fillStyle = opt.color || PALETTE.plum;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, x, y + 1);
}
// An elevated stage that keeps the W:H shape of its drawing and fits the holder.
function stage(holder, W, H, onSize) {
  const low = lowSpec();
  const box = document.createElement("div");
  box.className = "st-stage";
  const cv = document.createElement("canvas");
  cv.setAttribute("role", "img");
  box.appendChild(cv);
  holder.appendChild(box);
  const ctx = cv.getContext("2d");
  let scale = 1,
    dpr = 1;
  function fit() {
    const w = holder.clientWidth,
      h = holder.clientHeight;
    if (!w || !h) return;
    scale = Math.min(w / W, h / H);
    box.style.width = Math.floor(W * scale) + "px";
    box.style.height = Math.floor(H * scale) + "px";
    dpr = low ? 1 : Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * scale * dpr);
    cv.height = Math.round(H * scale * dpr);
    if (onSize) onSize({ scale: scale, dpr: dpr, canvas: cv });
  }
  fit();
  const ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(holder);
  return {
    box: box,
    canvas: cv,
    ctx: ctx,
    scale: function () {
      return scale;
    },
    dpr: function () {
      return dpr;
    },
    // draw in the drawing's own W×H units
    begin: function (c) {
      (c || ctx).setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    },
    stop: function () {
      if (ro) ro.disconnect();
    },
  };
}

// Projector-readable x–y graph: 18 px bold numbers, 16 px titles, an 11 px tracking dot with a glow.
//   g.draw({ xMax, yMax, xLabel, yLabel, ticks: 4, lines: [{ from: [x, y], to: [x, y], color }],
//            point: { x, y, color } or points: [{ x, y, color }, …], note: "I = V ÷ R with R = 6 Ω",
//            labels: [{ x, y, text, color }] })
function graph(cv) {
  const g = cv.getContext("2d");
  let w = 0,
    h = 0,
    dpr = 1;
  function size() {
    dpr = lowSpec() ? 1 : Math.min(2, window.devicePixelRatio || 1);
    w = cv.clientWidth;
    h = cv.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  size();
  const ro = window.ResizeObserver ? new ResizeObserver(size) : null;
  if (ro) ro.observe(cv);
  function draw(o) {
    if (!w || !h) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const L = 58,
      B = h - 44,
      R = w - 16,
      T = 14,
      n = o.ticks || 4;
    const X = function (v) {
        return L + (v / o.xMax) * (R - L);
      },
      Y = function (v) {
        return B - (v / o.yMax) * (B - T);
      };
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(X((o.xMax * i) / n), T);
      g.lineTo(X((o.xMax * i) / n), B);
      g.moveTo(L, Y((o.yMax * i) / n));
      g.lineTo(R, Y((o.yMax * i) / n));
      g.stroke();
    }
    g.strokeStyle = PALETTE.plumDark;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(L, T);
    g.lineTo(L, B);
    g.lineTo(R, B);
    g.stroke();
    g.fillStyle = PALETTE.plumDark;
    g.font = "700 18px " + FONT;
    g.textAlign = "center";
    g.textBaseline = "top";
    for (let i = 0; i <= n; i++) g.fillText(String(Math.round((o.xMax * i) / n)), X((o.xMax * i) / n), B + 5);
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (let i = 0; i <= n; i++) g.fillText(String(Math.round((o.yMax * i) / n)), L - 8, Y((o.yMax * i) / n));
    g.fillStyle = PALETTE.mute;
    g.font = "700 16px " + FONT;
    g.textAlign = "center";
    g.textBaseline = "top";
    if (o.xLabel) g.fillText(o.xLabel, (L + R) / 2, B + 25);
    if (o.yLabel) {
      g.save();
      g.translate(14, (T + B) / 2);
      g.rotate(-Math.PI / 2);
      g.textBaseline = "middle";
      g.fillText(o.yLabel, 0, 0);
      g.restore();
    }
    g.save();
    g.beginPath();
    g.rect(L, T, R - L, B - T);
    g.clip();
    (o.lines || []).forEach(function (ln) {
      g.strokeStyle = ln.color || PALETTE.orange;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(X(ln.from[0]), Y(ln.from[1]));
      g.lineTo(X(ln.to[0]), Y(ln.to[1]));
      g.stroke();
    });
    g.restore();
    // one tracking dot (point) or several (points), each with dashed drop lines to the axes
    (o.points || (o.point ? [o.point] : [])).forEach(function (pt) {
      const px = X(clamp(pt.x, 0, o.xMax)),
        py = Y(clamp(pt.y, 0, o.yMax)),
        col = pt.color || PALETTE.magenta;
      g.setLineDash([4, 4]);
      g.strokeStyle = "rgba(99,22,84,.45)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px, B);
      g.lineTo(px, py);
      g.lineTo(L, py);
      g.stroke();
      g.setLineDash([]);
      g.save();
      g.globalAlpha = 0.45;
      const gl = g.createRadialGradient(px, py, 0, px, py, 24);
      gl.addColorStop(0, col);
      gl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gl;
      g.beginPath();
      g.arc(px, py, 24, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = col;
      g.strokeStyle = PALETTE.white;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(px, py, 11, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });
    (o.labels || []).forEach(function (lb) {
      g.fillStyle = lb.color || PALETTE.plum;
      g.font = "700 16px " + FONT;
      g.textAlign = lb.align || "left";
      g.textBaseline = "middle";
      g.fillText(lb.text, X(lb.x), Y(lb.y));
    });
    if (o.note) {
      g.fillStyle = PALETTE.orange;
      g.font = "700 17px " + FONT;
      g.textAlign = "left";
      g.textBaseline = "top";
      g.fillText(o.note, L + 8, T + 4);
    }
  }
  return {
    draw: draw,
    stop: function () {
      if (ro) ro.disconnect();
    },
  };
}

// ── controls ─────────────────────────────────────────────────────────────
// spec: {id, label, min, max, step, value, unit, fmt(v, raw)}. onChange(v, user) after every change.
// The returned set(v, raw, user): raw = show in-between values (animations), user = a person moved it.
function slider(host, spec, onChange) {
  const box = document.createElement("div");
  box.className = "st-slider";
  box.innerHTML =
    '<div class="st-slider-h"><span></span><span class="v"></span></div>' +
    '<div class="st-slider-r"><button type="button" class="st-step minus" aria-label="Less">−</button>' +
    '<div class="trk"><div class="rail"></div><div class="knob"></div></div>' +
    '<button type="button" class="st-step plus" aria-label="More">+</button></div>';
  box.querySelector(".st-slider-h span").textContent = spec.label;
  host.appendChild(box);
  const trk = box.querySelector(".trk"),
    knob = box.querySelector(".knob"),
    vEl = box.querySelector(".v");
  let val = null,
    locked = false,
    active = false;
  const fmt =
    spec.fmt ||
    function (v, raw) {
      return (raw ? v.toFixed(1) : String(+v.toFixed(4))) + (spec.unit ? " " + spec.unit : "");
    };
  function place() {
    knob.style.transform = "translateX(" + ((val - spec.min) / (spec.max - spec.min)) * trk.clientWidth + "px)";
  }
  function set(v, raw, user) {
    v = clamp(v, spec.min, spec.max);
    if (!raw) v = +(Math.round((v - spec.min) / spec.step) * spec.step + spec.min).toFixed(4);
    const same = v === val;
    val = v;
    place();
    vEl.textContent = fmt(v, raw);
    if (same) return;
    if (user) sound.pitch((v - spec.min) / (spec.max - spec.min));
    if (onChange) onChange(v, !!user);
  }
  function fromX(x) {
    const r = trk.getBoundingClientRect();
    set(spec.min + ((x - r.left) / r.width) * (spec.max - spec.min), false, true);
  }
  trk.addEventListener("pointerdown", function (e) {
    if (locked) return;
    active = true;
    box.classList.add("drag");
    fromX(e.clientX);
  });
  const mv = function (e) {
      if (active) fromX(e.clientX);
    },
    up = function () {
      active = false;
      box.classList.remove("drag");
    };
  document.addEventListener("pointermove", mv);
  document.addEventListener("pointerup", up);
  box.querySelector(".minus").addEventListener("click", function () {
    if (!locked) set(val - spec.step, false, true);
  });
  box.querySelector(".plus").addEventListener("click", function () {
    if (!locked) set(val + spec.step, false, true);
  });
  const ro = window.ResizeObserver ? new ResizeObserver(place) : null;
  if (ro) ro.observe(trk);
  val = clamp(spec.value, spec.min, spec.max);
  vEl.textContent = fmt(val);
  place();
  return {
    el: box,
    set: set,
    get: function () {
      return val;
    },
    // while locked a person cannot move it (the app still can)
    lock: function (on) {
      locked = !!on;
    },
    // turn the knob's spring off while the app moves it frame by frame
    moving: function (on) {
      box.classList.toggle("drag", !!on);
    },
    stop: function () {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
      if (ro) ro.disconnect();
    },
  };
}
// options: [{id, label}]. onChange(id) when a person picks another one.
function toggle(host, options, current, onChange) {
  const el = document.createElement("div");
  el.className = "st-toggle";
  el.setAttribute("role", "radiogroup");
  options.forEach(function (o) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = o.id;
    b.setAttribute("role", "radio");
    b.textContent = o.label;
    el.appendChild(b);
  });
  host.appendChild(el);
  function show(id) {
    current = id;
    [].forEach.call(el.children, function (b) {
      b.setAttribute("aria-checked", String(b.dataset.id === id));
    });
  }
  el.addEventListener("click", function (e) {
    const b = e.target.closest("[data-id]");
    if (!b || b.dataset.id === current) return;
    show(b.dataset.id);
    sound.tap();
    if (onChange) onChange(current);
  });
  show(current);
  return { el: el, set: show };
}
function soundButton(host) {
  const b = document.createElement("button");
  b.className = "st-sound";
  b.type = "button";
  function show() {
    const on = sound.on();
    b.setAttribute("aria-pressed", String(!on));
    b.setAttribute("aria-label", on ? "Sound on. Tap to mute." : "Sound off. Tap to turn on.");
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
      (on
        ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') +
      "</svg>";
  }
  b.addEventListener("click", function () {
    sound.set(!sound.on());
    show();
    sound.tap();
  });
  show();
  host.appendChild(b);
  return b;
}

export const ME = {
  PALETTE: PALETTE,
  FONT: FONT,
  lowSpec: lowSpec,
  calm: calm,
  clamp: clamp,
  loop: loop,
  ease: ease,
  spring: spring,
  burst: burst,
  sound: sound,
  layer: layer,
  track: track,
  pill: pill,
  stage: stage,
  graph: graph,
  slider: slider,
  toggle: toggle,
  soundButton: soundButton,
};

// ── Early years and games (group D: arcade games, piano, conductor, puppets, sorter, trace, 3D) ──
//   ME.counter(render, rate)     a rolling counter: set(n) eases the shown value to n, render(int) each frame
//   (squash-and-stretch: ME.squash from the Early years delight section below)
//   ME.celebrate(el)             the Gold Standard win: green pulse on el (.st-solved), 1.2 s confetti, chime
//   ME.hudSound(row)             puts the global sound switch in a top bar once (no duplicates)
//   ME.backdrop(ctx, w, h, t, o) a lit Studio scene for canvas games: white-to-plum-tint ground, a soft key
//                                light, a floor line and slow drifting light motes (none when calm or low-spec)
//   ME.shadow(ctx, x, y, rx, k)  a soft ground shadow under a picture (k 0…1 = how close it is to the ground)
//   ME.gloss(ctx, x, y, r, col)  a layered, lit ball: base colour, rim shade, key-light highlight, sheen
function counter(render, rate) {
  let shown = 0,
    target = 0,
    stopper = null;
  function run() {
    if (stopper) return;
    stopper = loop(null, function (dt) {
      shown = ease(shown, target, dt, rate || 9);
      if (Math.abs(target - shown) < 0.02) {
        shown = target;
        stopper();
        stopper = null;
      }
      render(Math.round(shown));
    });
  }
  return {
    set: function (n) {
      target = n;
      if (calm() || n < shown) {
        shown = n;
        render(n);
        return;
      }
      run();
    },
    get: function () {
      return target;
    },
  };
}
function celebrate(el) {
  if (!el) return;
  el.classList.remove("st-solved");
  void el.offsetWidth;
  el.classList.add("st-solved");
  sound.win();
  burst(el);
}
function hudSound(row) {
  if (!row || row.querySelector(".st-sound")) return null;
  return soundButton(row);
}
const motes = [];
for (let i = 0; i < 12; i++)
  motes.push({
    x: Math.random(),
    y: Math.random(),
    r: 3 + Math.random() * 6,
    v: 0.01 + Math.random() * 0.02,
    p: Math.random() * 6,
  });
function backdrop(c, w, h, t, o) {
  o = o || {};
  const floor = h * (o.floor || 0.86);
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, o.top || PALETTE.white);
  bg.addColorStop(0.7, o.mid || "#FCF8FB");
  bg.addColorStop(1, o.bottom || PALETTE.tint);
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  // the key light, top left, like the reference's lit bench
  const key = c.createRadialGradient(w * 0.3, h * 0.1, 0, w * 0.3, h * 0.1, Math.max(w, h) * 0.7);
  key.addColorStop(0, o.light || "rgba(251,208,100,.16)");
  key.addColorStop(1, "rgba(251,208,100,0)");
  c.fillStyle = key;
  c.fillRect(0, 0, w, h);
  if (o.floor !== 0) {
    const fl = c.createLinearGradient(0, floor, 0, h);
    fl.addColorStop(0, "rgba(99,22,84,.07)");
    fl.addColorStop(1, "rgba(99,22,84,.02)");
    c.fillStyle = fl;
    c.fillRect(0, floor, w, h - floor);
    c.fillStyle = "rgba(99,22,84,.12)";
    c.fillRect(0, floor, w, 2);
  }
  if (calm() || lowSpec() || o.motes === false) return;
  // ambient life: slow light motes drifting up
  for (const m of motes) {
    const y = ((((m.y - (t || 0) * m.v) % 1) + 1) % 1) * h;
    const x = m.x * w + Math.sin((t || 0) * 0.6 + m.p) * 18;
    c.fillStyle = "rgba(243,163,40," + (0.1 + 0.08 * Math.sin((t || 0) + m.p)) + ")";
    c.beginPath();
    c.arc(x, y, m.r, 0, Math.PI * 2);
    c.fill();
  }
}
function shadow(c, x, y, rx, k) {
  k = k === undefined ? 1 : clamp(k, 0, 1);
  const r = rx * (0.6 + 0.4 * k);
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(61,14,55," + 0.26 * k + ")");
  g.addColorStop(1, "rgba(61,14,55,0)");
  c.save();
  c.translate(x, y);
  c.scale(1, 0.24);
  c.translate(-x, -y);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function gloss(c, x, y, r, col) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.22, col);
  g.addColorStop(0.85, col);
  g.addColorStop(1, "rgba(61,14,55,.85)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(255,255,255,.4)";
  c.beginPath();
  c.ellipse(x - r * 0.34, y - r * 0.46, r * 0.26, r * 0.14, -0.6, 0, Math.PI * 2);
  c.fill();
}
Object.assign(ME, {
  counter: counter,
  celebrate: celebrate,
  hudSound: hudSound,
  backdrop: backdrop,
  shadow: shadow,
  gloss: gloss,
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// CLASS ACTIVITIES KIT (appended 2026-11-27). Shared by the card and picture templates: quiz, order,
// sort, match, explore, label, reveal, map and pack. Same look and motion as the reference; nothing
// above this line changes. Styles: the "Class activities" section at the end of studio-base.css.
//
//   ME.split(area, {goal})        the reference's split screen: {wrap, left, holder, panel, toolbar, goal}
//                                 (picture left, sound switch + yellow challenge card right)
//   ME.reads(host, [{id, k, unit, accent}])   .st-reads whose numbers roll: r.set(id, value, of)
//   ME.roll(el, to, {dp, of})     rolls the number shown in el to `to` ("3 / 5" when `of` is given)
//   ME.pop(el)                    squash-and-stretch bounce on a tap or a correct drop
//   ME.nudge(el)                  a short shake for a wrong drop (transform only)
//   ME.fly(el, move)              FLIP: move() re-parents el, then el glides from where it was
//   ME.solved(el)                 the 1.2 s celebration: green pulse on el plus the confetti burst
//   ME.links(host)                a canvas over host that draws curved links between elements, with
//                                 beads flowing along them (≤ 40 beads, 16 low-spec, still when calm):
//                                 l.set([{a, b, color, flow, arrow, dim, side: "x" | "y"}]); l.stop()
//                                 ME.links(host, {under: true}) draws below the host's other children
//   ME.dots(host, n)              a row of progress dots: d.set(i, "on" | "ok" | "no" | "")
//   ME.swap(el, html)             cross-fades el's content to new HTML (the Real | Diagram fade)
//   ME.info(host, {tag, title, body})   .st-info card; i.set({tag, title, body, html}) cross-fades to new
//                                 text (body is plain text unless html is true)
// ════════════════════════════════════════════════════════════════════════════════════════════════
function split(area, opt) {
  opt = opt || {};
  const wrap = document.createElement("div");
  wrap.className = "st-split st-class";
  const left = document.createElement("div");
  left.className = "st-split-stage";
  const holder = document.createElement("div");
  holder.className = "st-stage-holder";
  left.appendChild(holder);
  const panel = document.createElement("div");
  panel.className = "st-panel";
  const toolbar = document.createElement("div");
  toolbar.className = "st-toolbar";
  panel.appendChild(toolbar);
  soundButton(toolbar);
  const goal = document.createElement("div");
  goal.className = "st-goal";
  if (opt.goal) goal.innerHTML = opt.goal;
  else goal.hidden = true;
  panel.appendChild(goal);
  wrap.appendChild(left);
  wrap.appendChild(panel);
  area.appendChild(wrap);
  return { wrap: wrap, left: left, holder: holder, panel: panel, toolbar: toolbar, goal: goal };
}
function rollText(v, dp, of) {
  return (dp ? v.toFixed(dp) : String(Math.round(v))) + (of != null ? "<small> / " + of + "</small>" : "");
}
function roll(el, to, opt) {
  opt = opt || {};
  const dp = opt.dp || 0;
  if (el._rollStop) el._rollStop();
  const from = el._rollV == null ? to : el._rollV;
  el._rollV = to;
  if (calm() || from === to) {
    el.innerHTML = rollText(to, dp, opt.of);
    return;
  }
  let cur = from;
  el._rollStop = loop(el, function (dt) {
    cur = ease(cur, to, dt, 9);
    if (Math.abs(to - cur) < (dp ? Math.pow(10, -dp) / 2 : 0.02)) cur = to;
    el.innerHTML = rollText(cur, dp, opt.of);
    if (cur === to) {
      el._rollStop();
      el._rollStop = null;
    }
  });
}
function reads(host, list) {
  const box = document.createElement("div");
  box.className = "st-reads";
  const map = {};
  list.forEach(function (r) {
    const d = document.createElement("div");
    d.className = "st-read" + (r.accent ? " st-read--accent" : "");
    d.innerHTML = '<span class="k"></span><span class="n"><b></b> <span class="u"></span></span>';
    d.querySelector(".k").textContent = r.k;
    d.querySelector(".u").textContent = r.unit || "";
    box.appendChild(d);
    map[r.id] = d.querySelector("b");
  });
  host.appendChild(box);
  return {
    el: box,
    set: function (id, v, of) {
      if (map[id]) roll(map[id], v, { of: of, dp: 0 });
    },
  };
}
function anim(el, frames, ms) {
  if (calm() || !el || !el.animate) return null;
  return el.animate(frames, { duration: ms, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
}
function pop(el) {
  anim(
    el,
    [
      { transform: "scale(1)" },
      { transform: "scale(1.12, 0.88)", offset: 0.25 },
      { transform: "scale(0.94, 1.06)", offset: 0.55 },
      { transform: "scale(1)" },
    ],
    480,
  );
}
function nudge(el) {
  if (calm() || !el || !el.animate) return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-12px)" },
      { transform: "translateX(10px)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 380, easing: "ease-out" },
  );
}
function fly(el, move) {
  const a = el.getBoundingClientRect();
  move();
  const b = el.getBoundingClientRect();
  if (!b.width) return;
  anim(
    el,
    [
      {
        transform: "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + a.width / b.width + ")",
        transformOrigin: "0 0",
      },
      { transform: "translate(0,0) scale(1)", transformOrigin: "0 0" },
    ],
    520,
  );
}
function solved(el) {
  if (!el) return;
  el.classList.remove("st-solved");
  void el.offsetWidth; // restart the pulse
  el.classList.add("st-solved");
  burst(el);
  setTimeout(function () {
    el.classList.remove("st-solved");
  }, 1250);
}
function swap(el, html) {
  if (calm() || !el.animate) {
    el.innerHTML = html;
    return;
  }
  const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
  out.onfinish = function () {
    el.innerHTML = html;
    out.cancel();
    el.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 260, easing: "ease-out" },
    );
  };
}
function info(host, first) {
  const el = document.createElement("div");
  el.className = "st-info";
  host.appendChild(el);
  function fill(o) {
    el.innerHTML = "";
    if (o.tag) {
      const t = document.createElement("div");
      t.className = "st-info-tag";
      t.textContent = o.tag;
      el.appendChild(t);
    }
    const h = document.createElement("div");
    h.className = "st-info-t";
    h.textContent = o.title || "";
    el.appendChild(h);
    const b = document.createElement("div");
    b.className = "st-info-b";
    if (o.html) b.innerHTML = o.body || "";
    else b.textContent = o.body || "";
    el.appendChild(b);
    return b;
  }
  if (first) fill(first);
  return {
    el: el,
    set: function (o) {
      if (calm() || !el.animate) return fill(o);
      const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
      out.onfinish = function () {
        fill(o);
        out.cancel();
        el.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 260, easing: "ease-out" },
        );
      };
    },
  };
}
function dots(host, n) {
  const box = document.createElement("div");
  box.className = "st-dots";
  for (let i = 0; i < n; i++) box.appendChild(document.createElement("span"));
  host.appendChild(box);
  return {
    el: box,
    set: function (i, state) {
      const s = box.children[i];
      if (!s) return;
      s.className = state || "";
      if (state === "ok" || state === "no") pop(s);
    },
  };
}
// Links between elements (match pairs, the steps of an order chain, a hotspot and its card).
// Beads flow from a to b; their speed is steady, so a link reads as "this leads to that".
function links(host, opt) {
  const cv = document.createElement("canvas");
  cv.className = "st-links" + (opt && opt.under ? " st-links--under" : "");
  host.appendChild(cv);
  const c = cv.getContext("2d");
  let list = [],
    w = 0,
    h = 0,
    dpr = 1;
  const low = lowSpec();
  function anchor(r, o, toward, side) {
    const cx = r.left + r.width / 2 - o.left,
      cy = r.top + r.height / 2 - o.top;
    const dx = toward[0] - cx,
      dy = toward[1] - cy;
    if (side === "x" || (side !== "y" && Math.abs(dx) / (r.width / 2 + 1) > Math.abs(dy) / (r.height / 2 + 1)))
      return { x: cx + Math.sign(dx) * (r.width / 2), y: cy, nx: Math.sign(dx), ny: 0 };
    return { x: cx, y: cy + Math.sign(dy) * (r.height / 2), nx: 0, ny: Math.sign(dy) };
  }
  function bez(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  }
  const stop = loop(cv, function (dt, now) {
    const o = host.getBoundingClientRect();
    if (Math.round(o.width) !== w || Math.round(o.height) !== h) {
      w = Math.round(o.width);
      h = Math.round(o.height);
      dpr = low ? 1 : Math.min(2, window.devicePixelRatio || 1);
      cv.width = w * dpr;
      cv.height = h * dpr;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    if (!list.length) return;
    const flowing = list.filter(function (l) {
      return l.flow && !l.dim;
    }).length;
    const per = flowing ? Math.max(1, Math.min(5, Math.floor((low ? 16 : 40) / flowing))) : 0;
    list.forEach(function (l) {
      if (!l.a.isConnected || !l.b.isConnected) return;
      const ra = l.a.getBoundingClientRect(),
        rb = l.b.getBoundingClientRect();
      if (!ra.width || !rb.width) return;
      const pa = anchor(ra, o, [rb.left + rb.width / 2 - o.left, rb.top + rb.height / 2 - o.top], l.side),
        pb = anchor(rb, o, [ra.left + ra.width / 2 - o.left, ra.top + ra.height / 2 - o.top], l.side);
      const k = Math.max(30, Math.hypot(pb.x - pa.x, pb.y - pa.y) * 0.4);
      const P0 = [pa.x, pa.y],
        P1 = [pa.x + pa.nx * k, pa.y + pa.ny * k],
        P2 = [pb.x + pb.nx * k, pb.y + pb.ny * k],
        P3 = [pb.x, pb.y];
      l.grow = calm() ? 1 : Math.min(1, (l.grow || 0) + dt * 2.6);
      const g = 1 - Math.pow(1 - l.grow, 3);
      const col = l.color || PALETTE.green;
      c.globalAlpha = l.dim ? 0.35 : 1;
      c.strokeStyle = col;
      c.lineWidth = l.dim ? 3 : 5;
      c.lineCap = "round";
      c.setLineDash(l.dim ? [6, 9] : []);
      c.beginPath();
      c.moveTo(P0[0], P0[1]);
      const steps = 28;
      for (let i = 1; i <= steps * g; i++) {
        const p = bez(P0, P1, P2, P3, i / steps);
        c.lineTo(p[0], p[1]);
      }
      c.stroke();
      c.setLineDash([]);
      if (l.arrow && g >= 1) {
        const q = bez(P0, P1, P2, P3, 0.93),
          ang = Math.atan2(P3[1] - q[1], P3[0] - q[0]);
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(P3[0], P3[1]);
        c.lineTo(P3[0] - 16 * Math.cos(ang - 0.45), P3[1] - 16 * Math.sin(ang - 0.45));
        c.lineTo(P3[0] - 16 * Math.cos(ang + 0.45), P3[1] - 16 * Math.sin(ang + 0.45));
        c.closePath();
        c.fill();
      }
      if (l.flow && !l.dim && g >= 1) {
        const span = Math.hypot(P3[0] - P0[0], P3[1] - P0[1]),
          beads = Math.max(1, Math.min(per, Math.floor(span / 48))),
          speed = 70 / Math.max(70, span); // about 70 px a second, whatever the length
        for (let i = 0; i < beads; i++) {
          const f = calm() ? (i + 0.5) / beads : (now * speed + i / beads) % 1;
          const p = bez(P0, P1, P2, P3, f);
          if (!low) {
            const gl = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], 12);
            gl.addColorStop(0, "rgba(255,255,255,.9)");
            gl.addColorStop(1, "rgba(255,255,255,0)");
            c.fillStyle = gl;
            c.beginPath();
            c.arc(p[0], p[1], 12, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = PALETTE.white;
          c.strokeStyle = col;
          c.lineWidth = 2.5;
          c.beginPath();
          c.arc(p[0], p[1], 5.5, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      }
      c.globalAlpha = 1;
    });
  });
  return {
    canvas: cv,
    set: function (next) {
      // keep the grown state of links that stay
      next.forEach(function (n) {
        const old = list.find(function (l) {
          return l.a === n.a && l.b === n.b;
        });
        if (old) n.grow = old.grow;
      });
      list = next;
    },
    stop: function () {
      stop();
      cv.remove();
    },
  };
}
Object.assign(ME, {
  split: split,
  reads: reads,
  roll: roll,
  pop: pop,
  nudge: nudge,
  fly: fly,
  solved: solved,
  swap: swap,
  info: info,
  dots: dots,
  links: links,
});
// ═══════════════════════════════ end of CLASS ACTIVITIES KIT ═══════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// EARLY YEARS DELIGHT (added 2026-11-27 for the early-years templates: emoji quiz, picture quiz,
// picture reveal, word wheel, picture chart, picture spotter, count and pick, sound poster).
// Khan Academy Kids / Duolingo patterns on the Gold Standard. Styles: the "Early years" section of
// /shared/studio-base.css. Nothing above this line changes, so the reference page is untouched.
//
//   ME.squash(el)                   squash-and-stretch tap bounce (transform only, adds to el's own)
//   ME.flood(el, x, y, {color, keep})  radial colour flood from a tap point (a scaled circle); keep
//                                   leaves the colour in place, otherwise it fades
//   ME.ripple(el, x, y, color)      a ring that spreads from a tap point
//   (rolling numbers: ME.roll from the Class activities kit above)
//   ME.tiles(host, word)            letter tiles that bounce in; returns {el, light(i)}: light(i) lifts
//                                   tile i while it is spoken, light(-1) lifts every tile (whole word)
//   ME.ambient(host, {grass, stars, hills})  ambient life behind a stage: drifting sparkles, rolling
//                                   hills and swaying grass on a canvas; ≤ 16 sparkles (6 low-spec),
//                                   still with reduced motion; pauses when hidden. Returns stop()
// ═════════════════════════════════════════════════════════════════════════
const SQUASH = [
  { transform: "scale(1, 1)" },
  { transform: "scale(1.12, 0.88)", offset: 0.3 },
  { transform: "scale(0.94, 1.08)", offset: 0.6 },
  { transform: "scale(1, 1)" },
];
function squash(el) {
  if (!el || calm() || !el.animate) return;
  el.animate(SQUASH, { duration: 450, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", composite: "add" });
}
function tapPoint(el, x, y) {
  const r = el.getBoundingClientRect();
  return {
    x: x === undefined || x === null ? r.width / 2 : x - r.left,
    y: y === undefined || y === null ? r.height / 2 : y - r.top,
    w: r.width,
    h: r.height,
  };
}
function flood(el, x, y, opt) {
  if (!el) return null;
  opt = opt || {};
  const p = tapPoint(el, x, y),
    rad = Math.ceil(Math.hypot(Math.max(p.x, p.w - p.x), Math.max(p.y, p.h - p.y))) + 4;
  const f = document.createElement("span");
  f.className = "st-flood";
  f.style.cssText =
    "width:" +
    rad * 2 +
    "px;height:" +
    rad * 2 +
    "px;left:" +
    (p.x - rad) +
    "px;top:" +
    (p.y - rad) +
    "px;" +
    "background:" +
    (opt.color || PALETTE.green);
  el.prepend(f);
  if (calm() || !f.animate) {
    if (!opt.keep) f.remove();
    return f;
  }
  const a = f.animate(
    opt.keep
      ? [{ transform: "scale(0)" }, { transform: "scale(1)" }]
      : [
          { transform: "scale(0)", opacity: 0.55 },
          { transform: "scale(1)", opacity: 0 },
        ],
    { duration: opt.keep ? 700 : 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
  );
  if (!opt.keep) a.onfinish = () => f.remove();
  return f;
}
function ripple(el, x, y, color) {
  if (!el || calm()) return;
  const p = tapPoint(el, x, y);
  const r = document.createElement("span");
  r.className = "st-ripple";
  r.style.cssText = "left:" + (p.x - 40) + "px;top:" + (p.y - 40) + "px;border-color:" + (color || PALETTE.magenta);
  el.appendChild(r);
  const a = r.animate(
    [
      { transform: "scale(0.2)", opacity: 0.8 },
      { transform: "scale(3.2)", opacity: 0 },
    ],
    { duration: 800, easing: "ease-out", fill: "forwards" },
  );
  a.onfinish = () => r.remove();
}
function tiles(host, word) {
  const el = document.createElement("div");
  el.className = "st-letters";
  [...word].forEach(function (ch, i) {
    const t = document.createElement("span");
    t.className = ch.trim() ? "st-letter" : "st-letter gap";
    t.textContent = ch;
    t.style.animationDelay = i * 40 + "ms";
    el.appendChild(t);
  });
  if (host) host.replaceChildren(el);
  return {
    el: el,
    light: function (i) {
      [].forEach.call(el.children, function (t, k) {
        t.classList.toggle("on", k === i || i < 0);
      });
    },
    clear: function () {
      [].forEach.call(el.children, function (t) {
        t.classList.remove("on");
      });
    },
  };
}
// Ambient life drawn on one canvas behind a stage (host must be position: relative).
function ambient(host, opt) {
  opt = Object.assign({ grass: true, stars: true, hills: true }, opt || {});
  const low = lowSpec(),
    still = calm();
  const cv = document.createElement("canvas");
  cv.className = "st-ambient";
  cv.setAttribute("aria-hidden", "true");
  host.prepend(cv);
  const c = cv.getContext("2d");
  let w = 0,
    h = 0,
    dpr = 1,
    hills = null;
  const cols = [PALETTE.amber, PALETTE.magenta, PALETTE.plum, PALETTE.orange, PALETTE.green];
  const sparks = [];
  const n = opt.stars ? (low ? 6 : 16) : 0;
  for (let i = 0; i < n; i++)
    sparks.push({
      x: Math.random(),
      y: Math.random() * 0.8,
      r: 5 + Math.random() * 7,
      v: 0.008 + Math.random() * 0.014,
      ph: Math.random() * 6.28,
      col: cols[i % cols.length],
    });
  const blades = [];
  const nb = opt.grass ? (low ? 22 : 48) : 0;
  for (let i = 0; i < nb; i++)
    blades.push({ x: (i + Math.random() * 0.8) / nb, h: 16 + Math.random() * 22, ph: Math.random() * 6.28 });
  function size() {
    dpr = low ? 1 : Math.min(2, window.devicePixelRatio || 1);
    w = host.clientWidth;
    h = host.clientHeight;
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    hills = null;
    if (still) draw(0);
  }
  function paintHills() {
    hills = layer(cv.width, cv.height);
    const g = hills.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!opt.hills) return;
    const base = h - 6;
    g.fillStyle = "rgba(47,168,106,0.10)";
    g.beginPath();
    g.moveTo(0, base);
    g.quadraticCurveTo(w * 0.22, base - 70, w * 0.5, base - 18);
    g.quadraticCurveTo(w * 0.78, base - 64, w, base - 10);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.fillStyle = "rgba(47,168,106,0.16)";
    g.beginPath();
    g.moveTo(0, base + 2);
    g.quadraticCurveTo(w * 0.35, base - 34, w * 0.62, base - 4);
    g.quadraticCurveTo(w * 0.86, base - 26, w, base);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
  }
  function star(x, y, r) {
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        rr = k % 2 ? r * 0.38 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  }
  function draw(t) {
    if (!w || !h) return;
    if (!hills) paintHills();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(hills, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    sparks.forEach(function (s) {
      c.globalAlpha = 0.16 + 0.14 * Math.sin(t * 1.6 + s.ph);
      c.fillStyle = s.col;
      star(s.x * w + Math.sin(t * 0.4 + s.ph) * 14, s.y * h, s.r);
    });
    c.globalAlpha = 1;
    if (nb) {
      c.strokeStyle = "rgba(47,168,106,0.38)";
      c.lineWidth = 2.5;
      c.lineCap = "round";
      c.beginPath();
      blades.forEach(function (b) {
        const x = b.x * w,
          sway = Math.sin(t * 1.3 + b.ph + b.x * 4) * 6;
        c.moveTo(x, h);
        c.quadraticCurveTo(x + sway * 0.4, h - b.h * 0.6, x + sway, h - b.h);
      });
      c.stroke();
    }
  }
  const ro = window.ResizeObserver ? new ResizeObserver(size) : null;
  if (ro) ro.observe(host);
  size();
  const stopLoop = still
    ? function () {}
    : loop(cv, function (dt, t) {
        sparks.forEach(function (s) {
          s.y -= s.v * dt;
          if (s.y < -0.05) {
            s.y = 0.85;
            s.x = Math.random();
          }
        });
        draw(t);
      });
  return function stop() {
    stopLoop();
    if (ro) ro.disconnect();
  };
}
Object.assign(ME, { squash: squash, flood: flood, ripple: ripple, tiles: tiles, ambient: ambient });
