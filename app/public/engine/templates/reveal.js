// T8 Torch reveal: the wall shows a line drawing; the torch (IR torch, pen or mouse) lights up the colour picture underneath.
// Hold the torch still on a hidden thing to find it.
// Gold Standard layout (CLAUDE.md §7): the drawing is an elevated stage on the left; the panel on the
// right holds the challenge card, the "found" read-out (it rolls up), a card for each hidden thing that
// turns green when it is found, and what it is. The torch loop is ME.loop, so it pauses when hidden.
// Activity data:
//   scene     "<svg viewBox=…>"                the colour picture (the line drawing is made from it)
//   targets   [{x, y, r, label, say}]          hidden things, in the picture's own units
//   torch     torch radius in picture units (default 130)
//   goal      optional challenge text (default: "Find all N hidden things.")
//   doneText  message at the end
import { MT } from "../js/kit.js";
import { ME } from "/shared/motion-engine.js";
import { setLargeSpot } from "/shared/input/pointer.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function reveal(area, d, ctx) {
  const ui = ME.split(area, { goal: d.goal || "Find all " + d.targets.length + " hidden things." });
  ui.left.style.flex = "2";
  const box = MT.sceneBox(ui.holder, d.scene);
  box.classList.add("rv-box", "st-scene");
  const lineSvg = box.querySelector("svg");
  lineSvg.classList.add("rv-line");
  const col = document.createElement("div");
  col.className = "rv-col";
  col.innerHTML = d.scene;
  box.appendChild(col);
  const cs = col.querySelector("svg");
  cs.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
  const ring = document.createElement("div");
  ring.className = "rv-ring";
  box.appendChild(ring);
  let VW = 1600,
    VH = 900;
  const vb = (lineSvg.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number);
  if (vb.length === 4) {
    VW = vb[2];
    VH = vb[3];
  }
  let torch = null;
  const found = {};
  const holdT = {};
  const n = d.targets.length;
  let nf = 0;
  const R = d.torch || 130;
  let finished = false;
  const badges = d.targets.map(function (t) {
    const b = document.createElement("div");
    b.className = "rv-badge";
    b.textContent = t.label;
    b.style.left = (t.x / VW) * 100 + "%";
    b.style.top = ((t.y - t.r - 10) / VH) * 100 + "%";
    box.appendChild(b);
    return b;
  });
  const reads = ME.reads(ui.panel, [{ id: "f", k: "Found" }]);
  reads.set("f", 0, n);
  const pool = document.createElement("div");
  pool.className = "st-pool";
  ui.panel.appendChild(pool);
  const cards = d.targets.map(function () {
    const c = document.createElement("div");
    c.className = "st-tile placed";
    c.innerHTML = '<div class="txt">?</div>';
    pool.appendChild(c);
    return c;
  });
  const info = ME.info(ui.panel, {
    title: "Hold the torch still",
    body: "When something is under the light, keep still.",
  });
  MT.score("0 / " + n);
  setLargeSpot(true); // let the camera follow a big torch spot, not only a small pen dot
  function k() {
    return box.clientWidth / VW;
  }
  function mask() {
    if (finished) {
      col.style.webkitMaskImage = col.style.maskImage = "none";
      return;
    }
    const parts = [],
      s = k();
    if (torch)
      parts.push(
        "radial-gradient(circle at " +
          torch.x +
          "px " +
          torch.y +
          "px, #000 " +
          R * s * 0.82 +
          "px, transparent " +
          R * s +
          "px)",
      );
    d.targets.forEach(function (t, i) {
      if (found[i])
        parts.push(
          "radial-gradient(circle at " +
            t.x * s +
            "px " +
            t.y * s +
            "px, #000 " +
            t.r * s * 1.1 +
            "px, transparent " +
            t.r * s * 1.35 +
            "px)",
        );
    });
    const m = parts.length ? parts.join(",") : "linear-gradient(transparent,transparent)";
    col.style.webkitMaskImage = col.style.maskImage = m;
    if (torch) {
      ring.style.display = "block";
      ring.style.width = ring.style.height = R * s * 2 + "px";
      ring.style.transform = "translate(" + (torch.x - R * s) + "px," + (torch.y - R * s) + "px)";
    } else ring.style.display = "none";
  }
  function at(e) {
    const r = box.getBoundingClientRect();
    const x = e.clientX - r.left,
      y = e.clientY - r.top;
    if (x < -40 || y < -40 || x > r.width + 40 || y > r.height + 40) {
      return;
    }
    torch = { x: x, y: y, t: performance.now() };
  }
  const mv = function (e) {
    at(e);
  };
  document.addEventListener("pointermove", mv);
  document.addEventListener("pointerdown", mv);
  const stopLoop = ME.loop(box, function (dt) {
    const now = performance.now();
    if (torch && now - torch.t > 2500) torch = null; // torch switched off
    if (torch && !finished) {
      const s = k(),
        tx = torch.x / s,
        ty = torch.y / s;
      d.targets.forEach(function (t, i) {
        if (found[i]) return;
        const inside = Math.hypot(tx - t.x, ty - t.y) < t.r + R * 0.35;
        holdT[i] = inside ? (holdT[i] || 0) + dt : Math.max(0, (holdT[i] || 0) - dt * 2);
        if (holdT[i] >= 0.7) {
          found[i] = 1;
          nf++;
          badges[i].classList.add("on");
          MT.score(nf + " / " + n);
          reads.set("f", nf, n);
          cards[i].classList.add("correct");
          cards[i].firstChild.textContent = t.label;
          ME.pop(cards[i]);
          info.set({ tag: "Found " + nf + " of " + n, title: t.label, body: t.say || "" });
          if (nf === n) {
            ui.goal.textContent = d.doneText || "You found them all!";
            ME.solved(ui.goal);
          }
          MT.good("Found: " + t.label + "!", t.label + ". " + (t.say || ""));
          if (nf === n) {
            MT.later(function () {
              finished = true;
              box.classList.add("rv-done");
              mask();
            }, 2600);
            MT.later(function () {
              MT.done(area, d.doneText || "You found them all!", ctx.again);
            }, 5200);
          }
        }
      });
    }
    ring.classList.toggle(
      "hot",
      !!torch &&
        d.targets.some(function (t, i) {
          return !found[i] && holdT[i] > 0.1;
        }),
    );
    mask();
  });
  return function () {
    stopLoop();
    setLargeSpot(false);
    document.removeEventListener("pointermove", mv);
    document.removeEventListener("pointerdown", mv);
  };
}
