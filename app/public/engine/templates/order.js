// T4 Put in order: move cards into numbered places in the right sequence (drag, or tap then tap).
// Gold Standard layout (CLAUDE.md §7): the chain of numbered places is the picture on the left; the
// cards wait in the panel on the right with the challenge card, the read-outs and what each step means.
// When two neighbours are in place a link grows between them and beads flow along it (the sequence
// "runs"), so the picture and the panel change in the same frame.
// Activity data:
//   items: [{icon, text, say} | {fraction} | {dots} | {svg}]   in the right order (shuffled on screen)
//   goal       optional challenge text (default: "Put the N cards in order.")
//   hintWrong  optional message for a wrong place
//   arrows     false: no links between the places
//   doneText   message at the end
import { MT } from "../js/kit.js";
import { MTDrag } from "../js/drag.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function order(area, d, ctx) {
  const n = d.items.length;
  let placed = 0,
    tries = 0;
  const ui = ME.split(area, { goal: d.goal || "Put the " + n + " cards in order." });
  const board = document.createElement("div");
  board.className = "st-board";
  ui.holder.appendChild(board);
  // places in a snake (left to right, then right to left), so each link is short
  const cols = n <= 4 ? n : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const grid = document.createElement("div");
  grid.style.cssText =
    "flex:1;display:grid;gap:70px 96px;padding:18px;align-content:center;grid-template-columns:repeat(" +
    cols +
    ",minmax(0,1fr));grid-template-rows:repeat(" +
    rows +
    ",minmax(0,210px));";
  board.appendChild(grid);
  const slots = d.items.map(function (it, i) {
    const s = document.createElement("div");
    s.className = "st-slot";
    s.dataset.drop = i;
    const r = Math.floor(i / cols),
      c = r % 2 ? cols - 1 - (i % cols) : i % cols;
    s.style.gridRow = String(r + 1);
    s.style.gridColumn = String(c + 1);
    s.innerHTML = '<span class="st-slot-n">' + (i + 1) + "</span>";
    grid.appendChild(s);
    return s;
  });
  const pool = document.createElement("div");
  pool.className = "st-pool" + (n <= 3 ? " one" : "");
  ui.panel.appendChild(pool);
  MT.shuffle(
    d.items.map(function (x, i) {
      return i;
    }),
  ).forEach(function (i) {
    const c = document.createElement("div");
    c.className = "st-tile";
    c.dataset.item = i;
    c.innerHTML = MT.face(d.items[i]);
    pool.appendChild(c);
  });
  const reads = ME.reads(ui.panel, [
    { id: "p", k: "In place" },
    { id: "t", k: "Tries", accent: true },
  ]);
  const info = ME.info(ui.panel, {
    title: "Step by step",
    body: "Each card you place tells you what happens at that step.",
  });
  reads.set("p", 0, n);
  reads.set("t", 0);
  MT.score("0 / " + n);
  const links = ME.links(board);
  function relink() {
    if (d.arrows === false) return;
    const ls = [];
    for (let i = 0; i < n - 1; i++) {
      const both = slots[i].classList.contains("filled") && slots[i + 1].classList.contains("filled");
      ls.push({ a: slots[i], b: slots[i + 1], color: ME.PALETTE.green, flow: both, arrow: true, dim: !both });
    }
    links.set(ls);
  }
  relink();
  const dr = MTDrag(area, function (it, t) {
    if (t.classList.contains("filled") || !t.classList.contains("st-slot")) return;
    tries++;
    reads.set("t", tries);
    if (it.dataset.item === t.dataset.drop) {
      const item = d.items[+it.dataset.item];
      it.classList.add("correct", "placed");
      ME.fly(it, function () {
        t.classList.add("filled");
        t.appendChild(it);
      });
      ME.pop(t);
      placed++;
      reads.set("p", placed, n);
      MT.score(placed + " / " + n);
      info.set({ tag: "Step " + (+t.dataset.drop + 1), title: item.text || "", body: item.say || "" });
      relink();
      MT.good("Right place!", item.say || "");
      if (placed === n) {
        ui.goal.textContent = d.doneText || "Perfect order!";
        ME.solved(ui.goal);
        MT.later(function () {
          MT.done(area, d.doneText || "Perfect order!", ctx.again);
        }, 1400);
      }
    } else {
      ME.nudge(it);
      ME.nudge(t);
      MT.bad(d.hintWrong || "Not this position");
    }
  });
  return function () {
    dr.destroy();
    links.stop();
  };
}
