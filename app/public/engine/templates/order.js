// T4 Put in order: move cards into numbered slots in the right sequence.
import { MT } from "../js/kit.js";
import { MTDrag } from "../js/drag.js";

export default function order(area, d, ctx) {
  const n = d.items.length;
  let placed = 0;
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;height:100%;gap:22px;justify-content:space-around;";
  const slots = document.createElement("div");
  slots.style.cssText = "display:flex;gap:12px;justify-content:center;align-items:center;";
  const pool = document.createElement("div");
  pool.style.cssText = "display:flex;gap:12px;justify-content:center;flex-wrap:wrap;";
  wrap.appendChild(slots);
  wrap.appendChild(pool);
  area.appendChild(wrap);
  const w = "min(170px, calc((100% - " + (n - 1) * 12 + "px)/" + n + "))";
  d.items.forEach(function (it, i) {
    const s = document.createElement("div");
    s.className = "mt-drop";
    s.dataset.drop = i;
    s.style.cssText =
      "width:" +
      w +
      ";height:190px;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:#EADBD0;position:relative;";
    s.textContent = i + 1;
    slots.appendChild(s);
    if (i < n - 1 && d.arrows !== false) {
      const a = document.createElement("div");
      a.textContent = "→";
      a.style.cssText = "font-size:30px;color:#631654;";
      slots.appendChild(a);
    }
  });
  MT.shuffle(
    d.items.map(function (x, i) {
      return i;
    }),
  ).forEach(function (i) {
    const c = document.createElement("div");
    c.className = "mt-card";
    c.dataset.item = i;
    c.style.cssText = "width:" + w + ";height:170px;";
    c.innerHTML = MT.face(d.items[i]);
    pool.appendChild(c);
  });
  MT.score("0 / " + n);
  const dr = MTDrag(area, function (it, t) {
    if (t.dataset.filled) return;
    if (it.dataset.item === t.dataset.drop) {
      t.dataset.filled = 1;
      t.textContent = "";
      it.classList.add("correct", "placed");
      it.style.width = "100%";
      it.style.height = "100%";
      t.appendChild(it);
      placed++;
      MT.score(placed + " / " + n);
      MT.good("Right place!", d.items[+it.dataset.item].say || "");
      if (placed === n)
        MT.later(function () {
          MT.done(area, d.doneText || "Perfect order!", ctx.again);
        }, 900);
    } else {
      it.classList.add("wrong");
      setTimeout(function () {
        it.classList.remove("wrong");
      }, 450);
      MT.bad(d.hintWrong || "Not this position");
    }
  });
  return dr.destroy;
}
