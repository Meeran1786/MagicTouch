// T5 Label the diagram: move each label onto its spot on the picture.
import { MT } from "../js/kit.js";
import { MTDrag } from "../js/drag.js";

export default function label(area, d, ctx) {
  const n = d.targets.length;
  let done = 0;
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;gap:24px;height:100%;";
  let scene = document.createElement("div");
  scene.style.cssText = "position:relative;flex:1.5;";
  const holder = scene;
  const pool = document.createElement("div");
  pool.style.cssText = "flex:0 0 260px;display:flex;flex-direction:column;gap:12px;justify-content:center;";
  wrap.appendChild(scene);
  scene = MT.sceneBox(holder, d.scene);
  wrap.appendChild(pool);
  area.appendChild(wrap);
  d.targets.forEach(function (t, i) {
    const z = document.createElement("div");
    z.className = "mt-drop";
    z.dataset.drop = i;
    z.style.cssText =
      "position:absolute;left:" +
      t.x +
      "%;top:" +
      t.y +
      "%;transform:translate(-50%,-50%);min-width:150px;height:56px;background:rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#C9B8BC;";
    z.textContent = "?";
    scene.appendChild(z);
  });
  MT.shuffle(
    d.targets.map(function (x, i) {
      return i;
    }),
  ).forEach(function (i) {
    const c = document.createElement("div");
    c.className = "mt-card";
    c.dataset.item = i;
    c.style.cssText = "height:62px;";
    c.innerHTML = '<div class="txt">' + d.targets[i].label + "</div>";
    pool.appendChild(c);
  });
  MT.score("0 / " + n);
  const dr = MTDrag(area, function (it, z) {
    if (z.dataset.filled) return;
    if (it.dataset.item === z.dataset.drop) {
      z.dataset.filled = 1;
      z.textContent = d.targets[+z.dataset.drop].label;
      z.style.color = "#2E7D46";
      z.style.borderColor = "#2E7D46";
      z.style.borderStyle = "solid";
      it.remove();
      done++;
      MT.score(done + " / " + n);
      const t = d.targets[+z.dataset.drop];
      MT.good("Correct!", t.label + ". " + (t.say || ""));
      if (done === n)
        MT.later(function () {
          MT.done(area, d.doneText || "Diagram complete!", ctx.again);
        }, 1200);
    } else {
      it.classList.add("wrong");
      setTimeout(function () {
        it.classList.remove("wrong");
      }, 450);
      MT.bad("Not that spot");
    }
  });
  return dr.destroy;
}
