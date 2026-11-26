// Feeds our JSON activity engine (/engine/poc/) from the wall's shared input:
// the same IR pen (or hand) tracker and the same 9-dot calibration every
// preschool activity uses, so a teacher calibrates once for the whole wall.
// The engine turns these screen points into real pointer events (press, drag, lift).
import { createTracker, getInputMode, calStorageKey } from "/shared/inputConfig.js";
import { applyHomography } from "/shared/homography.js";

const mode = getInputMode();
if (mode !== "mouse" && window.__wt) start().catch(e => console.warn("[wall input] camera not started:", e && e.message));

function loadH() {
  try { const d = JSON.parse(localStorage.getItem(calStorageKey()) || "null"); return d && d.screen ? d.homography : null; }
  catch (e) { return null; }
}

async function start() {
  let H = loadH();
  window.addEventListener("storage", e => { if (e.key === calStorageKey()) H = loadH(); });
  const tracker = await createTracker({ camW: 640, camH: 480, maxHands: 1, domClicker: false });
  await tracker.init(() => {});
  const engineMode = mode === "hand" ? "hand" : "pen";
  function frame() {
    tracker.update();
    let s = null;
    if (H && tracker.finger_x >= 0) {
      const p = applyHomography(H, [tracker.finger_x, tracker.finger_y]);
      if (p && p[0] > -0.05 && p[0] < 1.05 && p[1] > -0.05 && p[1] < 1.05) s = [p[0] * innerWidth, p[1] * innerHeight];
    }
    window.__wt.screen(s, engineMode);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener("pagehide", () => { try { tracker.release(); } catch (e) { /* ignore */ } });
}
