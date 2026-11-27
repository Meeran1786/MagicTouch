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
//            point: { x, y, color }, note: "I = V ÷ R with R = 6 Ω" })
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
    if (o.point) {
      const px = X(o.point.x),
        py = Y(clamp(o.point.y, 0, o.yMax)),
        col = o.point.color || PALETTE.magenta;
      g.setLineDash([4, 4]);
      g.strokeStyle = "rgba(99,22,84,.45)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(px, B);
      g.lineTo(px, py);
      g.lineTo(L, py);
      g.stroke();
      g.setLineDash([]);
      const gl = g.createRadialGradient(px, py, 0, px, py, 24);
      gl.addColorStop(0, "rgba(204,48,84,.45)");
      gl.addColorStop(1, "rgba(204,48,84,0)");
      g.fillStyle = gl;
      g.beginPath();
      g.arc(px, py, 24, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = col;
      g.strokeStyle = PALETTE.white;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(px, py, 11, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
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
//   ME.roll(el, to, {fmt, rate})    a number in the page that rolls up to `to` and pops
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
function roll(el, to, opt) {
  if (!el) return;
  opt = opt || {};
  const fmt =
      opt.fmt ||
      function (v) {
        return String(Math.round(v));
      },
    from = el._stV === undefined ? +to : el._stV;
  el._stV = +to;
  if (el._stStop) el._stStop();
  if (calm() || from === +to) {
    el.textContent = fmt(+to);
  } else {
    let cur = from;
    el._stStop = loop(el, function (dt) {
      cur = ease(cur, +to, dt, opt.rate || 9);
      if (Math.abs(cur - to) < 0.02) {
        cur = +to;
        el._stStop();
      }
      el.textContent = fmt(cur);
    });
  }
  if (from !== +to) squash(el);
}
function tiles(host, word) {
  const el = document.createElement("div");
  el.className = "st-tiles";
  [...word].forEach(function (ch, i) {
    const t = document.createElement("span");
    t.className = ch.trim() ? "st-tile" : "st-tile gap";
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
Object.assign(ME, { squash: squash, flood: flood, ripple: ripple, roll: roll, tiles: tiles, ambient: ambient });
