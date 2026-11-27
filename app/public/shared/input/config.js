// ═══════════════════════════════════════════════════════════════
//  shared/input/config.js — which pointing device the wall uses.
//
//    "irpen" (default) → IR pen seen by an IR webcam (ir-pen-tracker.js)
//    "hand"            → original MediaPipe fingertip tracking
//    "mouse"           → no camera: mouse, touch screen or interactive panel
//                        (input/pointer.js then leaves the browser's own events alone)
//
//  Switch any time by opening the wall once with  ?input=hand  or
//  ?input=irpen  (also works on the launcher page — the choice is
//  remembered in localStorage and shared by every app, including the
//  ones running inside the launcher's iframe).
//
//  The two modes keep SEPARATE calibrations, because a calibration is
//  specific to the camera + device it was captured with.
// ═══════════════════════════════════════════════════════════════
const MODE_KEY = "wallInputMode";
const IR_SETTINGS_KEY = "wallIrPenSettings";

export const IR_DEFAULTS = {
  threshold: 220, // pixel brightness (0-255) a pen dot must reach
  minThreshold: 150, // never go below this, even for a dim pen
  minArea: 3, // px — ignore single hot pixels (core + halo)
  maxArea: 2500, // px — ignore lamps / windows / big bright areas
  mirror: false, // true = flip x like a selfie view
  cameraId: "", // "" = auto (prefers a camera named "IR"/"infrared")
  debug: false, // live camera preview with detected dot
};

function readParam(name) {
  const wins = [window];
  try {
    if (window.top && window.top !== window) wins.push(window.top);
  } catch (e) {
    /* cross-origin */
  }
  for (const w of wins) {
    try {
      const v = new URLSearchParams(w.location.search).get(name);
      if (v) return v;
    } catch (e) {
      /* ignore */
    }
  }
  return null;
}

export function getInputMode() {
  try {
    const p = (readParam("input") || "").toLowerCase();
    if (p === "hand" || p === "irpen" || p === "mouse") {
      localStorage.setItem(MODE_KEY, p);
      return p;
    }
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "hand" || saved === "irpen" || saved === "mouse") return saved;
  } catch (e) {
    /* ignore */
  }
  return "irpen";
}

/** localStorage key for the camera→screen calibration of the active device. */
export function calStorageKey() {
  const m = getInputMode();
  return m === "hand"
    ? "wallSharedCalibration"
    : m === "mouse"
      ? "wallSharedCalibrationMouse"
      : "wallSharedCalibrationIR";
}

export function getIrSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(IR_SETTINGS_KEY) || "{}") || {};
  } catch (e) {
    /* ignore */
  }
  const s = { ...IR_DEFAULTS, ...saved };
  const mirror = readParam("mirror");
  if (mirror !== null) s.mirror = mirror === "1" || mirror === "true";
  return s;
}

export function saveIrSettings(patch) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(IR_SETTINGS_KEY) || "{}") || {};
  } catch (e) {
    /* ignore */
  }
  try {
    localStorage.setItem(IR_SETTINGS_KEY, JSON.stringify({ ...saved, ...patch }));
  } catch (e) {
    /* ignore */
  }
}

/**
 * Builds the tracker for the active mode. Both trackers expose the same contract:
 * init(statusCb), update(), release(), finger_x, finger_y, finger_conf (camera pixels,
 * camW x camH) and fingers[] (every point seen this frame). Imports are dynamic so
 * IR pen mode never downloads MediaPipe.
 */
export async function createTracker({ camW = 640, camH = 480, maxHands = 1 } = {}) {
  if (getInputMode() === "hand") {
    const { HandTracker } = await import("./hand-tracker.js");
    return new HandTracker({ camW, camH, maxHands });
  }
  const { IRPenTracker } = await import("./ir-pen-tracker.js");
  return new IRPenTracker({ camW, camH, maxHands });
}
