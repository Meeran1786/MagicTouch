// MagicTouch input: the one place where the camera becomes taps and drags.
//
// Every activity page calls startInput() once. Activities never read the camera,
// the calibration or the tracker themselves: they listen to ordinary pointer and
// click events, so the same code works with the IR pen, a hand, a mouse or a touch
// screen.
//
//   IR pen  the pen tip lights up only while it is pressed on the wall, so a lit tip
//           is a press: pointerdown, pointermove while it moves, pointerup when it
//           lifts, and a click when it lifts close to where it went down.
//   Hand    a fingertip hovers (pointermove with no button) and a tap is made by
//           holding still for DWELL_MS (pointerdown, pointerup, click).
//   Mouse   nothing to do: the browser's own events are used.
//
// Games that follow several pens or both hands at once also call onPoints(), which
// hands them every point the camera sees on each frame, in screen pixels.
import { applyHomography } from "./homography.js";
import { calStorageKey, createTracker, getInputMode } from "./config.js";

const CAM_W = 640;
const CAM_H = 480;
const PEN_DOWN_FRAMES = 2; // a lit tip must be seen this many frames in a row to count as a press
const PEN_UP_FRAMES = 6; // and missed this many in a row to count as lifted (pens flicker)
const CLICK_MOVE_PX = 40; // a press that moves less than this before lifting is also a click
const DWELL_MS = 700; // hand mode: hold still this long to tap
const DWELL_RADIUS = 0.04; // ... within this share of the screen width
const EDGE = 0.05; // points this far outside the screen still count (calibration wobble)
const POINTER_ID = 7;

let mode = "mouse";
let tracker = null;
let homography = null;
let cursor = null;
let started = false;
let paused = false;
let largeSpot = false;
let normalMaxArea = 2500;
const LARGE_SPOT_AREA = 80000;
const pointListeners = new Set();

/** The active input device: "irpen", "hand" or "mouse". */
export function inputMode() {
  return mode;
}

/** Calls fn(points, mode) on every camera frame; points = [{x, y}] in screen pixels. Returns an unsubscribe function. */
export function onPoints(fn) {
  pointListeners.add(fn);
  return () => pointListeners.delete(fn);
}

/** Stops turning camera points into events (for example while a video plays); the cursor still shows. */
export function pauseInput(value) {
  paused = !!value;
}

/**
 * Torch activities: let the IR camera follow a large bright spot (a torch beam), not only
 * a small pen tip. Turn it off again when the activity ends.
 */
export function setLargeSpot(on) {
  largeSpot = !!on;
  if (tracker && tracker.settings) tracker.settings.maxArea = largeSpot ? LARGE_SPOT_AREA : normalMaxArea;
}

/** Asks the wall to run the 9-dot calibration (the launcher does it), or opens it directly. */
export function requestCalibration() {
  try {
    localStorage.removeItem(calStorageKey());
  } catch {
    /* storage blocked */
  }
  if (window.parent !== window) {
    window.parent.postMessage({ type: "mt-calibrate" }, location.origin);
  } else {
    location.href = "/calibrate/?return=" + encodeURIComponent(location.pathname + location.search);
  }
}

/**
 * Starts the camera input for this page. Safe to call more than once.
 * @param {object} [options]
 * @param {number} [options.maxPoints=1] how many pens or hands to follow at once
 * @returns {Promise<string>} the input mode in use
 */
export async function startInput({ maxPoints = 1 } = {}) {
  if (started) return mode;
  started = true;
  mode = getInputMode();
  document.documentElement.dataset.input = mode;
  installKeys();
  if (mode === "mouse") return mode;

  homography = loadHomography();
  window.addEventListener("storage", (e) => {
    if (e.key === calStorageKey()) homography = loadHomography();
  });
  cursor = createCursor();
  if (!homography) showNotice("This wall is not calibrated yet.", "Calibrate now", requestCalibration);

  try {
    tracker = await createTracker({ camW: CAM_W, camH: CAM_H, maxHands: maxPoints });
    await tracker.init(() => {});
    if (tracker.settings) normalMaxArea = tracker.settings.maxArea;
    setLargeSpot(largeSpot);
  } catch (e) {
    showNotice("The camera did not start, so use the mouse or touch screen. " + ((e && e.message) || ""));
    return mode;
  }
  window.addEventListener("pagehide", () => {
    try {
      tracker.release();
    } catch {
      /* already released */
    }
  });
  requestAnimationFrame(frame);
  return mode;
}

function loadHomography() {
  try {
    const saved = JSON.parse(localStorage.getItem(calStorageKey()) || "null");
    return saved && saved.screen ? saved.homography : null;
  } catch {
    return null;
  }
}

function toScreen(camX, camY) {
  if (!homography || camX < 0) return null;
  const p = applyHomography(homography, [camX, camY]);
  if (!p || p[0] < -EDGE || p[0] > 1 + EDGE || p[1] < -EDGE || p[1] > 1 + EDGE) return null;
  return { x: p[0] * innerWidth, y: p[1] * innerHeight };
}

function frame() {
  tracker.update();
  const points = (tracker.fingers || []).map((f) => toScreen(f.x, f.y)).filter(Boolean);
  pointListeners.forEach((fn) => fn(points, mode));
  if (mode === "irpen") penSample(points[0] || null);
  else handSample(toScreen(tracker.finger_x, tracker.finger_y));
  requestAnimationFrame(frame);
}

// ── events ──────────────────────────────────────────────────────
function targetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el && el !== document.documentElement ? el : document.body;
}

// Fires a pointer event and, like a real browser, the matching mouse event after it,
// so code that listens to either works.
const MOUSE_FOR = { pointerdown: "mousedown", pointermove: "mousemove", pointerup: "mouseup" };
function fire(type, el, x, y, pressed) {
  if (!el || paused) return;
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    pointerId: POINTER_ID,
    pointerType: mode === "irpen" ? "pen" : "touch",
    isPrimary: true,
    button: type === "pointermove" ? -1 : 0,
    buttons: pressed ? 1 : 0,
    view: window,
  };
  if (type === "click") {
    // browsers send click as a PointerEvent too, so pointerType says pen or touch
    el.dispatchEvent(new PointerEvent("click", { ...init, button: 0 }));
    return;
  }
  el.dispatchEvent(new PointerEvent(type, init));
  if (MOUSE_FOR[type]) el.dispatchEvent(new MouseEvent(MOUSE_FOR[type], { ...init, button: Math.max(0, init.button) }));
}

// IR pen: press, move, lift.
const pen = { down: false, seen: 0, miss: 0, el: null, start: null, last: null };
function penSample(p) {
  if (p) {
    pen.miss = 0;
    pen.seen++;
    if (!pen.down && pen.seen >= PEN_DOWN_FRAMES) {
      pen.down = true;
      pen.start = pen.last = p;
      pen.el = targetAt(p.x, p.y);
      fire("pointerdown", pen.el, p.x, p.y, true);
      cursor.pulse(p);
    } else if (pen.down) {
      pen.last = p;
      fire("pointermove", targetAt(p.x, p.y) || pen.el, p.x, p.y, true);
    }
    cursor.show(p, pen.down);
    return;
  }
  if (++pen.miss >= PEN_UP_FRAMES) pen.seen = 0;
  if (pen.down && pen.miss >= PEN_UP_FRAMES) {
    const l = pen.last;
    const el = targetAt(l.x, l.y) || pen.el;
    fire("pointerup", el, l.x, l.y, false);
    if (Math.hypot(l.x - pen.start.x, l.y - pen.start.y) < CLICK_MOVE_PX) fire("click", el, l.x, l.y, false);
    pen.down = false;
    pen.el = null;
  }
  if (!pen.down) cursor.hide();
}

// Hand: hover, and hold still to tap.
const dwell = { anchor: null, since: 0, fired: false };
function handSample(p) {
  if (!p) {
    dwell.anchor = null;
    cursor.hide();
    return;
  }
  const el = targetAt(p.x, p.y);
  fire("pointermove", el, p.x, p.y, false);
  const now = performance.now();
  if (!dwell.anchor || Math.hypot(p.x - dwell.anchor.x, p.y - dwell.anchor.y) > DWELL_RADIUS * innerWidth) {
    dwell.anchor = p;
    dwell.since = now;
    dwell.fired = false;
  }
  const progress = dwell.fired ? 0 : Math.min(1, (now - dwell.since) / DWELL_MS);
  cursor.show(p, false, progress);
  if (!dwell.fired && progress >= 1) {
    dwell.fired = true;
    const a = dwell.anchor;
    const target = targetAt(a.x, a.y);
    fire("pointerdown", target, a.x, a.y, true);
    fire("pointerup", target, a.x, a.y, false);
    fire("click", target, a.x, a.y, false);
    cursor.pulse(a);
  }
}

// ── cursor, notices, keys ───────────────────────────────────────
function createCursor() {
  const style = document.createElement("style");
  style.textContent = `
.mt-cursor{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;pointer-events:none;z-index:2147483600;display:none}
.mt-cursor svg{width:100%;height:100%;overflow:visible}
.mt-cursor .dot{fill:rgba(243,163,40,.55);stroke:#F3A328;stroke-width:3}
.mt-cursor.down .dot{fill:rgba(204,48,84,.6);stroke:#CC3054}
.mt-cursor .ring{fill:none;stroke:#631654;stroke-width:4;stroke-linecap:round}
.mt-pulse{position:fixed;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:3px solid #F3A328;pointer-events:none;
  z-index:2147483599;animation:mt-pulse .4s ease-out forwards}
@keyframes mt-pulse{to{transform:scale(2.6);opacity:0}}
.mt-notice{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483601;display:flex;gap:14px;align-items:center;
  background:#3D0E37;color:#fff;font:600 17px var(--mt-font-body,Carlito,Calibri,sans-serif);padding:12px 18px;border-radius:14px;
  box-shadow:0 8px 28px rgba(36,36,48,.35)}
.mt-notice button{font:inherit;background:#F3A328;color:#3D0E37;border:0;border-radius:10px;padding:8px 14px;cursor:pointer}`;
  document.head.appendChild(style);
  const el = document.createElement("div");
  el.className = "mt-cursor";
  el.innerHTML =
    '<svg viewBox="0 0 44 44"><circle class="dot" cx="22" cy="22" r="12"/>' +
    '<circle class="ring" cx="22" cy="22" r="19" transform="rotate(-90 22 22)" stroke-dasharray="119.4" stroke-dashoffset="119.4"/></svg>';
  document.body.appendChild(el);
  const ring = el.querySelector(".ring");
  return {
    show(p, down, progress = 0) {
      el.style.display = "block";
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.classList.toggle("down", !!down);
      ring.style.strokeDashoffset = String(119.4 * (1 - progress));
    },
    hide() {
      el.style.display = "none";
    },
    pulse(p) {
      const r = document.createElement("div");
      r.className = "mt-pulse";
      r.style.left = p.x + "px";
      r.style.top = p.y + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 450);
    },
  };
}

function showNotice(text, action, onAction) {
  const box = document.createElement("div");
  box.className = "mt-notice";
  box.setAttribute("role", "status");
  box.textContent = text;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action;
    b.addEventListener("click", onAction);
    box.appendChild(b);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 12000);
}

function installKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (
      (e.key === "r" || e.key === "R") &&
      mode !== "mouse" &&
      !/INPUT|TEXTAREA/.test(document.activeElement.tagName)
    ) {
      requestCalibration();
    }
  });
}
