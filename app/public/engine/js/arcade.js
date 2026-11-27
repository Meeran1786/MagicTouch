// Canvas games for the early years. One call gives a template:
//   - a canvas that fills the stage, sharp on any screen (device pixel ratio),
//   - a frame loop that stops while the wall is hidden,
//   - every pointer on the wall at once (IR pens, hands, mouse, touch) as plain points,
//     each with where it was on the last frame, so games can test taps and swipes alike,
//   - particle bursts, capped by the design system (40 live, fewer on low-spec PCs),
//   - the Gold Standard look: the canvas sits in an elevated .st-stage card and g.backdrop(t) paints
//     the lit Studio scene (see /shared/motion-engine.js and /shared/studio-base.css).
import { MT } from "./kit.js";
import { ME } from "/shared/motion-engine.js";
import { inputMode, onPoints } from "/shared/input/pointer.js";
import { emojiSrc } from "/shared/studio/emoji.js";

const MAX_PARTICLES = 40;
const MATCH_PX = 220; // a camera point this close to one on the last frame is the same pointer

const images = new Map();
/** The Twemoji picture for an emoji, loaded once and shared by every game. */
export function emojiImage(ch) {
  if (!images.has(ch)) {
    const img = new Image();
    img.src = emojiSrc(ch);
    images.set(ch, img);
  }
  return images.get(ch);
}

/** A picture file (photo or drawing), loaded once. */
export function photoImage(src) {
  if (!images.has(src)) {
    const img = new Image();
    img.src = src;
    images.set(src, img);
  }
  return images.get(src);
}

/** Splits a string of emoji into single pictures: "🍎🍌" → ["🍎", "🍌"]. */
export function emojiList(s) {
  return Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s || ""), (x) => x.segment).filter(
    (x) => x.trim(),
  );
}

/**
 * @param {HTMLElement} stage  where the canvas goes (it fills it)
 * @param {{hover?: boolean}} opts  hover: a mouse counts while it only hovers (pop and steer games);
 *   otherwise a mouse or touch counts only while pressed (slice games)
 */
export function arcade(stage, { hover = false, card = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "ey-canvas";
  if (card) {
    const box = document.createElement("div");
    box.className = "st-stage st-stage--fill";
    box.appendChild(canvas);
    stage.appendChild(box);
  } else stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const g = { canvas, ctx, w: 0, h: 0, t: 0, particles: [], onTap: null };
  let camera = []; // screen points from the camera this frame
  const pointers = new Map(); // mouse and touch pointers: id -> {x, y, down}
  let last = [];
  let stopLoop = null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MT.lowSpec() ? 1 : 2);
    g.w = r.width;
    g.h = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (g.onResize) g.onResize(g.w, g.h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const local = (x, y) => {
    const r = canvas.getBoundingClientRect();
    return { x: x - r.left, y: y - r.top };
  };
  // Synthetic events come from the camera (pointer.js); those points arrive through onPoints.
  const onDown = (e) => {
    if (!e.isTrusted) return;
    const p = local(e.clientX, e.clientY);
    pointers.set(e.pointerId, { ...p, down: true });
    if (g.onTap) g.onTap(p.x, p.y);
  };
  const onMove = (e) => {
    if (!e.isTrusted) return;
    const p = local(e.clientX, e.clientY);
    const was = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { ...p, down: was ? was.down : e.buttons > 0 });
  };
  const onUp = (e) => {
    if (!e.isTrusted) return;
    const was = pointers.get(e.pointerId);
    if (e.pointerType === "mouse" && was) was.down = false;
    else pointers.delete(e.pointerId);
  };
  const onLeave = (e) => e.isTrusted && pointers.delete(e.pointerId);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  // A camera tap on the canvas (pen lift or hand dwell) is a synthetic click.
  const onClick = (e) => {
    if (e.isTrusted || !g.onTap) return;
    const p = local(e.clientX, e.clientY);
    g.onTap(p.x, p.y);
  };
  canvas.addEventListener("click", onClick);
  const offPoints = onPoints((pts) => {
    camera = pts.map((p) => local(p.x, p.y));
  });

  /** Every pointer touching the game this frame: {x, y, px, py} (px/py: last frame, or x/y if new). */
  g.points = () => {
    const now = inputMode() === "mouse" ? [] : camera.slice();
    for (const p of pointers.values()) if (p.down || hover) now.push({ x: p.x, y: p.y });
    const out = now.map((p) => {
      let best = null;
      let bestD = MATCH_PX;
      for (const q of last) {
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestD) {
          best = q;
          bestD = d;
        }
      }
      return { x: p.x, y: p.y, px: best ? best.x : p.x, py: best ? best.y : p.y };
    });
    last = now;
    return out;
  };

  /** Runs fn(dt seconds, t ms) every frame until stop() (ME.loop: paused while the page is hidden). */
  g.loop = (fn) => {
    if (stopLoop) stopLoop();
    stopLoop = ME.loop(canvas, (dt, t) => {
      g.t = t;
      fn(Math.min(0.05, dt), t * 1000);
    });
  };

  /** Paints the lit Studio scene behind the game (ME.backdrop). */
  g.backdrop = (o) => ME.backdrop(ctx, g.w, g.h, g.t, o);
  /** A soft ground shadow under something at x on the floor y (k: 0 far above … 1 on the ground). */
  g.shadow = (x, y, rx, k) => ME.shadow(ctx, x, y, rx, k);

  /** A burst of sparks at x, y. */
  g.burst = (x, y, color, n = 12) => {
    if (MT.calm()) return;
    const room = (MT.lowSpec() ? MAX_PARTICLES / 2 : MAX_PARTICLES) - g.particles.length;
    for (let i = 0; i < Math.min(n, room); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 260;
      g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, r: 4 + Math.random() * 6 });
    }
  };
  /** Moves and draws the sparks; call once per frame after drawing the scene. */
  g.drawParticles = (dt) => {
    g.particles = g.particles.filter((p) => (p.life -= dt * 1.6) > 0);
    for (const p of g.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  /** Draws an emoji centred at x, y, size pixels wide (the bundled Twemoji picture). */
  g.emoji = (ch, x, y, size) => {
    const img = emojiImage(ch);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  };

  /** Draws an image centred at x, y, fitted inside a size×size box. */
  g.image = (img, x, y, size) => {
    if (!img.complete || !img.naturalWidth) return;
    const k = size / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  };

  /** Shortest distance from point (x, y) to the segment a-b: tells if a swipe passed through. */
  g.segDist = (x, y, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  };

  g.stop = () => {
    if (stopLoop) stopLoop();
    ro.disconnect();
    offPoints();
    window.removeEventListener("pointerup", onUp);
  };
  return g;
}

/**
 * The Gold Standard top bar for an early-years frame (engine/js/early.js): adds the global sound
 * switch and makes the score roll up with a squash bounce. Returns score(n) (and f.score still works).
 */
export function hud(f) {
  const row = f.root.querySelector(".ey-pills");
  ME.hudSound(row);
  const pill = f.root.querySelector(".ey-pill.score");
  const roller = ME.counter((n) => f.score(n));
  return (n) => {
    if (n > roller.get()) ME.squash(pill);
    roller.set(n);
  };
}
