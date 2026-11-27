// T11 Map explorer: tap places (regions) on a map drawing to learn about them, then a "find it" round.
// The map is plain SVG data: every tappable shape carries data-region="id".
//   d.regions [{id, label, text}]          what each place is (tap to read and hear it)
//   d.find    [{text, region, say}]        optional: "Tap the place north of the school"
// India rule: maps of India (or anything showing its borders) must use an official Survey of India
// outline. Leave them out until one is in hand; fictional or local maps are fine.
import { MT } from "../js/kit.js";

export default function map(area, d, ctx) {
  const byId = {};
  d.regions.forEach(function (r) {
    byId[r.id] = r;
  });
  const wrap = document.createElement("div");
  wrap.className = "mp-wrap";
  const holder = document.createElement("div");
  holder.className = "mp-map";
  const info = document.createElement("div");
  info.className = "mp-info";
  wrap.appendChild(holder);
  wrap.appendChild(info);
  area.appendChild(wrap);
  const box = MT.sceneBox(holder, d.scene);
  const finds = d.find || [];
  let phase = "explore";
  const seen = {};
  let fi = 0;
  let lock = false;
  info.innerHTML =
    '<div class="mp-tag">Explore</div><div class="mp-t">Tap a place on the map</div><div class="mp-b">' +
    (d.exploreText || "Each place tells you something.") +
    '</div><div class="mp-x"></div>';
  const tEl = info.querySelector(".mp-t"),
    bEl = info.querySelector(".mp-b"),
    tag = info.querySelector(".mp-tag"),
    xEl = info.querySelector(".mp-x");
  function shapes(id) {
    return box.querySelectorAll('[data-region="' + id + '"]');
  }
  function mark(id, cls, on) {
    [].forEach.call(shapes(id), function (s) {
      s.classList.toggle(cls, on);
    });
  }
  function seenCount() {
    return Object.keys(seen).length;
  }
  function readyBtn() {
    if (!finds.length || phase !== "explore" || xEl.firstChild) return;
    const b = document.createElement("button");
    b.className = "mt-btn";
    b.textContent = "Find the places →";
    b.addEventListener("click", startFind);
    xEl.appendChild(b);
  }
  function startFind() {
    phase = "find";
    fi = 0;
    xEl.innerHTML = "";
    d.regions.forEach(function (r) {
      mark(r.id, "mp-on", false);
      mark(r.id, "mp-seen", false);
    });
    tag.textContent = "Find it";
    ask();
  }
  function ask() {
    const f = finds[fi];
    MT.score(fi + " / " + finds.length);
    tEl.textContent = "Question " + (fi + 1) + " of " + finds.length;
    bEl.textContent = f.text;
    MT.speak(f.text);
  }
  function tap(id) {
    if (lock) return;
    const r = byId[id];
    if (!r) return;
    if (phase === "explore") {
      d.regions.forEach(function (x) {
        mark(x.id, "mp-on", x.id === id);
      });
      tEl.textContent = r.label;
      bEl.textContent = r.text || "";
      MT.speak(r.label + ". " + (r.text || ""));
      MT.sfx.tap();
      if (!seen[id]) {
        seen[id] = 1;
        mark(id, "mp-seen", true);
      }
      MT.score(seenCount() + " / " + d.regions.length);
      if (seenCount() === d.regions.length) {
        if (finds.length) readyBtn();
        else {
          lock = true;
          MT.later(function () {
            MT.done(area, d.doneText || "You explored the whole map!", ctx.again);
          }, 1500);
        }
      } else if (seenCount() >= Math.ceil(d.regions.length / 2)) readyBtn();
      return;
    }
    if (phase === "find") {
      const f = finds[fi];
      if (id === f.region) {
        mark(id, "mp-seen", true);
        MT.good("Yes! " + r.label, f.say || r.label);
        fi++;
        lock = true;
        MT.later(function () {
          lock = false;
          if (fi < finds.length) ask();
          else {
            MT.score(finds.length + " / " + finds.length);
            MT.done(area, d.doneText || "Map expert!", ctx.again);
          }
        }, 1100);
      } else {
        mark(id, "mp-no", true);
        MT.bad("That is " + r.label + ". Try again");
        MT.later(function () {
          mark(id, "mp-no", false);
        }, 700);
      }
    }
  }
  const onClick = function (e) {
    const s = e.target.closest && e.target.closest("[data-region]");
    if (s && box.contains(s)) tap(s.getAttribute("data-region"));
  };
  box.addEventListener("click", onClick);
  MT.score("0 / " + d.regions.length);
}
