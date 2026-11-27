// T1 Explore & reveal: tap parts of a picture to hear and read about them.
import { MT } from "../js/kit.js";

export default function explore(area, d, ctx) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;gap:24px;height:100%;align-items:stretch;";
  let scene = document.createElement("div");
  scene.style.cssText = "position:relative;flex:1.6;";
  const holder = scene;
  const info = document.createElement("div");
  info.style.cssText =
    "flex:1;background:#fff;border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 3px 10px rgba(61,14,55,.08);";
  info.innerHTML =
    '<div style="font-size:30px;font-weight:800;color:#631654" id="ex-t">Tap a glowing circle</div><div style="font-size:23px;line-height:1.4" id="ex-b">Each one tells part of the story.</div>';
  wrap.appendChild(scene);
  scene = MT.sceneBox(holder, d.scene);
  wrap.appendChild(info);
  area.appendChild(wrap);
  const seen = {};
  d.hotspots.forEach(function (h, i) {
    const b = document.createElement("div");
    b.style.cssText =
      "position:absolute;left:" +
      h.x +
      "%;top:" +
      h.y +
      "%;width:74px;height:74px;margin:-37px 0 0 -37px;border-radius:50%;border:5px solid #F3A328;background:rgba(243,163,40,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#3D0E37;";
    b.textContent = i + 1;
    b.addEventListener("click", function () {
      document.getElementById("ex-t").textContent = h.label;
      document.getElementById("ex-b").textContent = h.text;
      MT.speak(h.label + ". " + h.text);
      b.style.borderColor = "#2E7D46";
      b.style.background = "rgba(46,125,70,.25)";
      seen[i] = 1;
      const n = Object.keys(seen).length;
      MT.score(n + " / " + d.hotspots.length);
      if (n === d.hotspots.length && !seen.done) {
        seen.done = 1;
        MT.later(function () {
          MT.done(area, d.doneText || "You explored everything!", ctx.again);
        }, 1500);
      }
    });
    scene.appendChild(b);
  });
  MT.score("0 / " + d.hotspots.length);
}
