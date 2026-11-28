// T11 Map explorer: tap places (regions) on a map drawing to learn about them, then a "find it" round.
// The map is plain SVG data: every tappable shape carries data-region="id".
//   d.regions [{id, label, text}]          what each place is (tap to read and hear it)
//   d.find    [{text, region, say}]        optional: "Tap the place north of the school"
// India rule: maps of India (or anything showing its borders) must use an official Survey of India
// outline. Leave them out until one is in hand; fictional or local maps are fine.
//   d.goal, d.exploreText, d.doneText       optional texts
// Gold Standard layout (CLAUDE.md §7): the map is an elevated, softly lit stage on the left; the panel
// on the right holds the challenge card (it becomes the "find it" question), the read-outs and the
// place card, which cross-fades as the tapped place lights up; a right find gets the 1.2 s green pulse
// and confetti.
import { MT } from "../js/kit.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function map(area, d, ctx) {
  const byId = {};
  d.regions.forEach(function (r) {
    byId[r.id] = r;
  });
  const finds = d.find || [];
  const ui = ME.split(area, {
    goal: d.goal || "Tap every place on the map" + (finds.length ? ", then find the places." : "."),
  });
  ui.wrap.classList.add("mp-wrap");
  ui.holder.classList.add("mp-map");
  const box = MT.sceneBox(ui.holder, d.scene);
  box.classList.add("st-scene");
  let phase = "explore";
  const seen = {};
  let fi = 0;
  let lock = false;
  const reads = ME.reads(ui.panel, [
    { id: "e", k: "Explored" },
    { id: "f", k: "Found", accent: true },
  ]);
  if (!finds.length) reads.el.lastChild.hidden = true;
  reads.set("e", 0, d.regions.length);
  reads.set("f", 0, finds.length);
  const info = ME.info(ui.panel, {
    tag: "Explore",
    title: "Tap a place on the map",
    body: d.exploreText || "Each place tells you something.",
  });
  const xEl = document.createElement("div");
  ui.panel.appendChild(xEl);
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
    b.type = "button";
    b.className = "st-btn";
    b.style.width = "100%";
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
    ask();
  }
  function ask() {
    const f = finds[fi];
    MT.score(fi + " / " + finds.length);
    ui.goal.textContent = f.text;
    info.set({ tag: "Find it", title: "Question " + (fi + 1) + " of " + finds.length, body: f.text });
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
      info.set({ tag: "Explore", title: r.label, body: r.text || "" });
      MT.speak([r.label, r.text || ""]);
      MT.sfx.tap();
      MT.theme(r.sfx); // the place's own sound ("sfx": "train"), after the voice
      if (!seen[id]) {
        seen[id] = 1;
        mark(id, "mp-seen", true);
      }
      MT.score(seenCount() + " / " + d.regions.length);
      reads.set("e", seenCount(), d.regions.length);
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
        reads.set("f", fi, finds.length);
        ME.solved(ui.goal);
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
