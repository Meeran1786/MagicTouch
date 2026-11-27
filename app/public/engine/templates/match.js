// T2 Match pairs: move each left card onto its partner on the right (drag, or tap then tap).
// Gold Standard layout (CLAUDE.md §7): both columns sit on the elevated board on the left; a matched
// pair is joined by a link with beads flowing along it, and the panel on the right explains the pair,
// so the picture and the read-outs change in the same frame.
// Activity data:
//   pairs: [[left, right, say]]   left/right are faces: {icon, text} | {fraction:[n,d]} | {dots} | {svg}
//   goal       optional challenge text (default: "Join each card to its partner.")
//   doneText   message at the end
import { MT } from "../js/kit.js";
import { MTDrag } from "../js/drag.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

const LINK = ["green", "orange", "magenta", "plum", "amber"].map(function (k) {
  return ME.PALETTE[k];
});

export default function match(area, d, ctx) {
  const n = d.pairs.length;
  let matched = 0,
    tries = 0;
  const ui = ME.split(area, { goal: d.goal || "Join each card to its partner." });
  const board = document.createElement("div");
  board.className = "st-board";
  board.style.flexDirection = "row";
  board.style.justifyContent = "space-between";
  ui.holder.appendChild(board);
  function col() {
    const c = document.createElement("div");
    c.style.cssText =
      "display:grid;grid-auto-rows:minmax(0,1fr);gap:14px;flex:0 0 36%;min-height:0;max-height:" +
      n * 150 +
      "px;align-self:center;height:100%;";
    board.appendChild(c);
    return c;
  }
  const links = ME.links(board, { under: true });
  const L = col(),
    R = col();
  const lefts = {},
    rights = {};
  MT.shuffle(
    d.pairs.map(function (p, i) {
      return i;
    }),
  ).forEach(function (i) {
    const c = document.createElement("div");
    c.className = "st-tile";
    c.dataset.item = i;
    c.innerHTML = MT.face(d.pairs[i][0]);
    L.appendChild(c);
    lefts[i] = c;
  });
  MT.shuffle(
    d.pairs.map(function (p, i) {
      return i;
    }),
  ).forEach(function (i) {
    const c = document.createElement("div");
    c.className = "st-tile st-drop";
    c.dataset.drop = i;
    c.innerHTML = MT.face(d.pairs[i][1]);
    R.appendChild(c);
    rights[i] = c;
  });
  const reads = ME.reads(ui.panel, [
    { id: "m", k: "Matched" },
    { id: "t", k: "Tries", accent: true },
  ]);
  const info = ME.info(ui.panel, {
    title: "Find the partners",
    body: "Move a card from the left onto its partner on the right, or tap one and then the other.",
  });
  reads.set("m", 0, n);
  reads.set("t", 0);
  MT.score("0 / " + n);
  const joined = [];
  function text(face) {
    return (
      face.text || (face.fraction ? face.fraction[0] + "/" + face.fraction[1] : face.dots ? String(face.dots) : "")
    );
  }
  const dr = MTDrag(area, function (it, t) {
    if (t.classList.contains("correct")) return;
    tries++;
    reads.set("t", tries);
    if (it.dataset.item === t.dataset.drop) {
      const i = +it.dataset.item,
        p = d.pairs[i];
      it.classList.add("correct", "placed");
      t.classList.add("correct");
      ME.pop(it);
      ME.pop(t);
      joined.push({ a: lefts[i], b: rights[i], color: LINK[joined.length % LINK.length], flow: true, side: "x" });
      links.set(joined.slice());
      matched++;
      reads.set("m", matched, n);
      MT.score(matched + " / " + n);
      info.set({ tag: "Pair " + matched, title: text(p[0]) + " → " + text(p[1]), body: p[2] || "" });
      MT.good("Correct!", p[2] || "");
      if (matched === n) {
        ui.goal.textContent = d.doneText || "All matched!";
        ME.solved(ui.goal);
        MT.later(function () {
          MT.done(area, d.doneText || "All matched!", ctx.again);
        }, 1400);
      }
    } else {
      ME.nudge(it);
      ME.nudge(t);
      MT.bad("Not a match, try again");
    }
  });
  return function () {
    dr.destroy();
    links.stop();
  };
}
