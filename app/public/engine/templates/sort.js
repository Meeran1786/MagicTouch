// T3 Sort into groups: move each card into the right tray (drag, or tap then tap).
// Gold Standard layout (CLAUDE.md §7): the trays are the picture on the left; the cards wait in the
// panel on the right with the challenge card and the read-outs. A card glides into its tray, the tray's
// counter rolls up and the panel says why it belongs there, all in the same frame.
// Activity data:
//   bins:  [{id, label}]                                   2 to 5 trays
//   items: [{bin, icon, text, say} | {bin, dots} | {bin, fraction}]
//   goal       optional challenge text (default: "Put each card in the right group.")
//   doneText   message at the end
import { MT } from "../js/kit.js";
import { MTDrag } from "../js/drag.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function sort(area, d, ctx) {
  const total = d.items.length;
  let done = 0,
    tries = 0;
  const ui = ME.split(area, { goal: d.goal || "Put each card in the right group." });
  const board = document.createElement("div");
  board.className = "st-board";
  ui.holder.appendChild(board);
  const cols = d.bins.length <= 3 ? d.bins.length : 3;
  const grid = document.createElement("div");
  grid.style.cssText =
    "flex:1;min-height:0;display:grid;gap:18px;grid-template-columns:repeat(" +
    cols +
    ",minmax(0,1fr));grid-auto-rows:minmax(0,1fr);";
  board.appendChild(grid);
  const counts = {};
  const bins = {};
  d.bins.forEach(function (b) {
    const e = document.createElement("div");
    e.className = "st-bin st-ground";
    e.dataset.drop = b.id;
    e.innerHTML = '<div class="st-bin-h"><span></span><b class="st-bin-c">0</b></div><div class="st-bin-in"></div>';
    e.querySelector(".st-bin-h span").textContent = b.label;
    grid.appendChild(e);
    bins[b.id] = e;
    counts[b.id] = 0;
  });
  const pool = document.createElement("div");
  pool.className = "st-pool";
  ui.panel.appendChild(pool);
  MT.shuffle(d.items).forEach(function (it) {
    const c = document.createElement("div");
    c.className = "st-tile";
    c.dataset.item = it.bin;
    c.innerHTML = MT.face(it);
    c._it = it;
    pool.appendChild(c);
  });
  const reads = ME.reads(ui.panel, [
    { id: "s", k: "Sorted" },
    { id: "t", k: "Tries", accent: true },
  ]);
  const info = ME.info(ui.panel, { title: "Why it goes there", body: "Each card you sort tells you why." });
  reads.set("s", 0, total);
  reads.set("t", 0);
  MT.score("0 / " + total);
  const dr = MTDrag(area, function (it, t) {
    if (!t.classList.contains("st-bin")) return;
    tries++;
    reads.set("t", tries);
    if (it.dataset.item === t.dataset.drop) {
      it.classList.add("correct", "placed");
      ME.fly(it, function () {
        t.querySelector(".st-bin-in").appendChild(it);
      });
      counts[t.dataset.drop]++;
      const c = t.querySelector(".st-bin-c");
      c.textContent = counts[t.dataset.drop];
      ME.pop(c);
      done++;
      reads.set("s", done, total);
      MT.score(done + " / " + total);
      const label = t.querySelector(".st-bin-h span").textContent;
      info.set({ tag: label, title: it._it.text || label, body: it._it.say || "" });
      MT.good("Yes!", it._it.say || "");
      if (done === total) {
        ui.goal.textContent = d.doneText || "All sorted!";
        ME.solved(ui.goal);
        MT.later(function () {
          MT.done(area, d.doneText || "All sorted!", ctx.again);
        }, 1400);
      }
    } else {
      ME.nudge(it);
      ME.nudge(t);
      MT.bad("Not that group");
    }
  });
  return dr.destroy;
}
