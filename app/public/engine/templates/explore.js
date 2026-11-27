// T1 Explore & reveal: tap parts of a picture to hear and read about them.
// Gold Standard layout (CLAUDE.md §7): the picture is an elevated, softly lit stage on the left with
// pulsing hotspots; the panel on the right shows the part you tapped, so the picture (the hotspot
// springs and turns plum) and the panel (the card cross-fades, the count rolls up) move in the same frame.
// Activity data:
//   scene     "<svg viewBox=…>"                      the picture (code-drawn SVG)
//   hotspots  [{x, y, label, text, part, bx, by, media}]
//             x, y      the part, in % of the picture
//             bx, by    optional: put the badge here instead (in %), joined to the part by a dotted
//                       leader line, so the badge never covers the symbol
//             part      optional: the data-part id of the SVG shapes that light up and bump on tap
//                       (a part with data-glow, such as a bulb, glows)
//             media     optional {type:"mp4"|"webm"|"lottie"|"rive", src, caption}, a local clip shown
//                       with the card (the activity is complete without it)
//   look      "diagram": the Ohm's law Diagram view's engineering grid behind a technical drawing
//             (draw the SVG without a background fill so the grid shows)
//   goal      optional challenge text (default: "Tap all N glowing circles.")
//   doneText  message at the end
import { MT } from "../js/kit.js";
import { ME } from "/shared/motion-engine.js";
import { mountMedia } from "../js/media.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function explore(area, d, ctx) {
  const n = d.hotspots.length;
  const ui = ME.split(area, { goal: d.goal || "Tap all " + n + " glowing circles." });
  const scene = MT.sceneBox(ui.holder, d.scene);
  scene.classList.add("st-scene");
  const pic = ME.parts(scene, { grid: d.look === "diagram" });
  const reads = ME.reads(ui.panel, [{ id: "e", k: "Explored" }]);
  const dots = ME.dots(reads.el.firstChild, n);
  dots.el.style.marginTop = "6px";
  const info = ME.info(ui.panel, { title: "Tap a glowing circle", body: "Each one tells part of the story." });
  const slot = document.createElement("div");
  slot.className = "sim-media";
  slot.style.display = "none";
  ui.panel.appendChild(slot);
  reads.set("e", 0, n);
  MT.score("0 / " + n);
  const seen = {};
  let media = null,
    finished = false,
    ask = 0;
  const hots = d.hotspots.map(function (h, i) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "st-hot";
    const away = h.bx != null && h.by != null;
    if (away) pic.leader(h.x, h.y, h.bx, h.by);
    b.style.left = (away ? h.bx : h.x) + "%";
    b.style.top = (away ? h.by : h.y) + "%";
    b.textContent = i + 1;
    b.setAttribute("aria-label", h.label);
    b.addEventListener("click", function () {
      tap(i);
    });
    scene.appendChild(b);
    return b;
  });
  function tap(i) {
    const h = d.hotspots[i];
    hots.forEach(function (x, j) {
      x.classList.toggle("on", j === i);
    });
    ME.pop(hots[i]);
    MT.sfx.pop();
    MT.theme(h.sfx);
    pic.select(h.part);
    pic.hit(h.part);
    info.set({ tag: "Part " + (i + 1) + " of " + n, title: h.label, body: h.text });
    MT.speak([h.label, h.text]);
    showMedia(h.media);
    if (!seen[i]) {
      seen[i] = 1;
      hots[i].classList.add("seen");
      dots.set(i, "ok");
    }
    const k = Object.keys(seen).length;
    reads.set("e", k, n);
    MT.score(k + " / " + n);
    if (k === n && !finished) {
      finished = true;
      ui.goal.textContent = d.doneText || "You explored everything!";
      ME.solved(ui.goal);
      MT.later(function () {
        MT.done(area, d.doneText || "You explored everything!", ctx.again);
      }, 2200);
    }
  }
  function showMedia(m) {
    const my = ++ask;
    if (media) media.stop();
    media = null;
    slot.innerHTML = "";
    slot.style.display = "none";
    if (!m) return;
    mountMedia(slot, m, ctx.base).then(function (r) {
      if (my !== ask) {
        if (r) r.stop();
        return;
      }
      media = r;
      slot.style.display = r ? "" : "none"; // no file or no runtime: keep the code-drawn picture only
      if (r && m.caption) {
        const c = document.createElement("figcaption");
        c.textContent = m.caption;
        slot.appendChild(c);
      }
    });
  }
  return function () {
    if (media) media.stop();
  };
}
