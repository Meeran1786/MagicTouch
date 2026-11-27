// T5 Label the diagram: move each label onto its spot on the picture (drag, or tap then tap).
// Gold Standard layout (CLAUDE.md §7): the diagram is an elevated, softly lit stage on the left with
// dashed label places; the labels wait in the panel on the right with the challenge card and the
// read-outs. A right label glides onto the picture and the panel explains that part in the same frame.
// Activity data:
//   scene     "<svg viewBox=…>"                  the diagram (code-drawn SVG)
//   targets   [{x, y, label, say, part, px, py}]  x, y in % of the picture (where the label goes);
//             part: optional data-part id of the SVG shapes that light up when the label is placed;
//             px, py: optional point on the part (in %), joined to the label by a dotted leader line
//   look      "diagram": the Ohm's law Diagram view's engineering grid behind a technical drawing
//   goal      optional challenge text (default: "Put all N labels on the diagram.")
//   doneText  message at the end
import { MT } from "../js/kit.js";
import { MTDrag } from "../js/drag.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function label(area, d, ctx) {
  const n = d.targets.length;
  let done = 0,
    tries = 0;
  const ui = ME.split(area, { goal: d.goal || "Put all " + n + " labels on the diagram." });
  const scene = MT.sceneBox(ui.holder, d.scene);
  scene.classList.add("st-scene");
  const pic = ME.parts(scene, { grid: d.look === "diagram" });
  d.targets.forEach(function (t) {
    if (t.px != null && t.py != null) pic.leader(t.px, t.py, t.x, t.y);
  });
  d.targets.forEach(function (t, i) {
    const z = document.createElement("div");
    z.className = "st-slot";
    z.dataset.drop = i;
    z.style.cssText =
      "position:absolute;left:" +
      t.x +
      "%;top:" +
      t.y +
      "%;transform:translate(-50%,-50%);min-width:150px;min-height:56px;padding:0 14px;font-size:24px;";
    z.textContent = "?";
    scene.appendChild(z);
  });
  const pool = document.createElement("div");
  pool.className = "st-pool" + (n > 4 ? "" : " one");
  ui.panel.appendChild(pool);
  MT.shuffle(
    d.targets.map(function (x, i) {
      return i;
    }),
  ).forEach(function (i) {
    const c = document.createElement("div");
    c.className = "st-tile";
    c.dataset.item = i;
    c.innerHTML = '<div class="txt"></div>';
    c.firstChild.textContent = d.targets[i].label;
    pool.appendChild(c);
  });
  const reads = ME.reads(ui.panel, [
    { id: "l", k: "Labelled" },
    { id: "t", k: "Tries", accent: true },
  ]);
  const info = ME.info(ui.panel, {
    title: "Read the diagram",
    body: "Each label you place tells you what that part does.",
  });
  reads.set("l", 0, n);
  reads.set("t", 0);
  MT.score("0 / " + n);
  const dr = MTDrag(area, function (it, z) {
    if (z.classList.contains("filled") || !z.classList.contains("st-slot")) return;
    tries++;
    reads.set("t", tries);
    if (it.dataset.item === z.dataset.drop) {
      const t = d.targets[+z.dataset.drop];
      it.classList.add("correct", "placed");
      ME.fly(it, function () {
        z.textContent = "";
        z.classList.add("filled");
        it.style.minHeight = "52px";
        it.style.padding = "6px 16px";
        it.style.whiteSpace = "nowrap";
        z.appendChild(it);
      });
      pic.select(t.part);
      pic.hit(t.part);
      done++;
      reads.set("l", done, n);
      MT.score(done + " / " + n);
      info.set({ tag: "Part " + done + " of " + n, title: t.label, body: t.say || "" });
      MT.good("Correct!", t.label + ". " + (t.say || ""));
      if (done === n) {
        ui.goal.textContent = d.doneText || "Diagram complete!";
        ME.solved(ui.goal);
        MT.later(function () {
          MT.done(area, d.doneText || "Diagram complete!", ctx.again);
        }, 1600);
      }
    } else {
      ME.nudge(it);
      MT.bad("Not that spot");
    }
  });
  return dr.destroy;
}
