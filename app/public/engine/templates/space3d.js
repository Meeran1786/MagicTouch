// T7 3D space: a real-time 3D scene you turn with the pen (drag) and explore (tap).
// scene "solar": tap planets to visit them.  scene "satellite": change the height of a satellite's orbit and meet challenges.
//
// Gold Standard layout (reference: /engine/templates/reference-ohms-law.html): the 3D scene on an
// elevated stage on the left (.st-split-stage, dark inside), the Studio panel on the right
// (.st-panel): sound switch, yellow challenge card that pulses green when solved, IR-pen sliders
// (ME.slider), rolling read-outs (.st-read) and, for the satellite, a live graph (ME.graph) whose dot
// moves in the same frame as the satellite.
import { MT } from "../js/kit.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false, styles: ["space3d"] };

const H_MIN = 300;
const H_MAX = 40000;
const STEPS = 400; // slider positions (log scale): fine enough for every challenge window

export default function space3d(area, d, ctx) {
  let dead = false;
  let stage = null;
  const offs = [];
  const wrap = document.createElement("div");
  wrap.className = "st-split sp-wrap";
  wrap.innerHTML =
    '<div class="st-split-stage"><div class="st-stage-holder"><div class="st-stage st-stage--space st-stage--fill sp-stage">' +
    '<div class="sp-host"></div><div class="sp-labels"></div><div class="sp-loading">Loading 3D…</div></div></div></div>' +
    '<div class="st-panel sp-panel"><div class="st-toolbar"></div></div>';
  area.appendChild(wrap);
  const host = wrap.querySelector(".sp-host");
  const labels = wrap.querySelector(".sp-labels");
  const loading = wrap.querySelector(".sp-loading");
  const panel = wrap.querySelector(".sp-panel");
  const toolbar = panel.querySelector(".st-toolbar");
  ME.soundButton(toolbar);

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function btn(row, txt, fn, cls) {
    const b = el("button", "sp-b " + (cls || ""), txt);
    b.type = "button";
    b.addEventListener("click", function () {
      ME.squash(b);
      MT.sfx.tap();
      fn(b);
    });
    row.appendChild(b);
    return b;
  }
  function holoBtn(row, scene) {
    btn(
      row,
      "✨ Hologram view",
      function () {
        window.open("/engine/holo.html?scene=" + scene, "mt_holo");
      },
      "alt",
    );
  }
  // a read-out whose number rolls (Brilliant-style) to the value it is given
  function readout(host, label, unit, accent) {
    const r = el("div", "st-read" + (accent ? " st-read--accent" : ""));
    r.innerHTML = '<span class="k"></span><span class="n"><b></b> <span class="u"></span></span>';
    r.querySelector(".k").textContent = label;
    r.querySelector(".u").textContent = unit;
    host.appendChild(r);
    const b = r.querySelector("b");
    let shown = null;
    return {
      el: r,
      unit: r.querySelector(".u"),
      // target, dt, format(value) → text
      step: function (target, dt, fmt) {
        shown = shown === null || ME.calm() ? target : ME.ease(shown, target, dt, 9);
        b.textContent = fmt(shown);
      },
    };
  }

  import("../js/space/space.js")
    .then(function (SP) {
      if (dead) return;
      stage = SP.createStage(host, { bloom: d.scene === "solar" ? 1.0 : 0.6 });
      loading.remove();
      if (d.scene === "satellite") satellite(SP);
      else solar(SP);
    })
    .catch(function (e) {
      loading.textContent = "3D could not start: " + e.message;
    });

  // ---------------- solar system ----------------
  function solar(SP) {
    const S = SP.buildSolar(stage, {});
    const seen = {},
      total = SP.PLANETS.length - 1;
    MT.score("0 / " + total);
    const card = el("div", "st-card sp-info");
    panel.appendChild(card);
    const reads = el("div", "st-reads");
    panel.appendChild(reads);
    const rSeen = readout(reads, "Planets visited", "/ " + total, false);
    const rYear = readout(reads, "One Earth year takes", "seconds", true);
    const sliders = el("div", "st-sliders");
    panel.appendChild(sliders);
    // orbit speed: ×¼ … ×16, doubling at each step
    const speed = ME.slider(
      sliders,
      {
        label: "Orbit speed",
        min: -2,
        max: 4,
        step: 1,
        value: 0,
        fmt: function (v) {
          const k = Math.pow(2, Math.round(v));
          return "× " + (k < 1 ? (k === 0.5 ? "½" : "¼") : k);
        },
      },
      function (v) {
        S.speed = Math.pow(2, v);
      },
    );
    offs.push(speed.stop);
    const row = el("div", "sp-row");
    panel.appendChild(row);
    let visited = 0;
    const tags = S.bodies.map(function (b) {
      const t = el("div", "sp-tag");
      t.textContent = b.p.name.replace("The ", "");
      t.addEventListener("click", function () {
        visit(b);
      });
      labels.appendChild(t);
      return t;
    });
    function showCard(b) {
      if (!b) {
        card.innerHTML =
          '<h3>Our solar system</h3><p>Drag to turn the view.<br>Tap a planet (or its name) to fly to it.</p><p class="sp-note">Sizes and distances are not to scale.</p>';
      } else {
        card.innerHTML =
          "<h3>" +
          b.p.name +
          "</h3><ul>" +
          b.p.facts
            .map(function (f) {
              return "<li>" + f + "</li>";
            })
            .join("") +
          "</ul>";
      }
      ME.squash(card);
    }
    function visit(b) {
      S.setFocus(b);
      showCard(b);
      MT.speak(b.p.say);
      if (b.p.id !== "sun" && !seen[b.p.id]) {
        seen[b.p.id] = 1;
        visited = Object.keys(seen).length;
        MT.score(visited + " / " + total);
        ME.squash(rSeen.el);
        if (visited === total) {
          ME.celebrate(rSeen.el);
          MT.later(function () {
            MT.done(area, d.doneText || "You visited every planet!", ctx.again);
          }, 4000);
        }
      }
    }
    stage.onTap = function (nx, ny) {
      const b = S.pickAt(nx, ny);
      if (b) visit(b);
    };
    btn(row, "☀ Whole system", function () {
      S.setFocus(null);
      showCard(null);
    });
    btn(row, "⏸ Pause", function (b) {
      S.paused = !S.paused;
      b.innerHTML = S.paused ? "▶ Play" : "⏸ Pause";
    });
    holoBtn(row, "solar");
    showCard(null);
    stage.tick = function (dt) {
      S.update(dt);
      rSeen.step(visited, dt, function (v) {
        return String(Math.round(v));
      });
      rYear.step(S.paused ? 0 : 10 / S.speed, dt, function (v) {
        return S.paused ? "—" : v < 1 ? v.toFixed(2) : v.toFixed(1);
      });
      S.bodies.forEach(function (b, i) {
        const w = S.worldPos(b),
          p = stage.project(w),
          t = tags[i];
        if (p.behind) {
          t.style.display = "none";
          return;
        }
        const low = stage.project(w.clone().addScaledVector(stage.camera.up, -b.p.r * (b.p.ring ? 1.6 : 1.15)));
        t.style.display = "";
        t.style.transform = "translate(" + (p.x - t.offsetWidth / 2) + "px," + Math.max(p.y + 14, low.y + 6) + "px)";
        t.classList.toggle("on", S.focus === b);
      });
    };
  }

  // ---------------- satellite orbit ----------------
  function satellite(SP) {
    const S = SP.buildSatellite(stage, {});
    const goals = d.goals || [];
    let gi = 0;
    let timer = null;
    MT.score("0 / " + goals.length);
    const LMIN = Math.log(H_MIN),
      LMAX = Math.log(H_MAX);
    const toV = function (h) {
      return ((Math.log(h) - LMIN) / (LMAX - LMIN)) * STEPS;
    };
    const fromV = function (v) {
      return Math.exp(LMIN + (v / STEPS) * (LMAX - LMIN));
    };
    // heights a person reads: 10 km steps low down, 50 km steps higher up
    const nice = function (h) {
      const st = h < 2000 ? 10 : 50;
      return Math.max(H_MIN, Math.min(H_MAX, Math.round(h / st) * st));
    };
    const fmtH = function (h) {
      return Math.round(h).toLocaleString("en-IN");
    };

    const goal = el("div", "st-goal sp-goal");
    panel.appendChild(goal);
    const sliders = el("div", "st-sliders");
    panel.appendChild(sliders);
    const slide = ME.slider(
      sliders,
      {
        label: "Height above Earth",
        min: 0,
        max: STEPS,
        step: 1,
        value: toV(d.start || 2000),
        fmt: function (v) {
          return fmtH(nice(fromV(v))) + " km";
        },
      },
      function (v) {
        set(nice(fromV(v)));
      },
    );
    offs.push(slide.stop);
    // − and + move by round amounts (50 km low down, 200 km higher up), like a real control desk
    slide.el.addEventListener(
      "click",
      function (e) {
        const b = e.target.closest(".st-step");
        if (!b) return;
        e.stopPropagation();
        const dir = b.classList.contains("plus") ? 1 : -1;
        const h = S.h,
          st = h < 2000 ? 50 : 200;
        const next = Math.max(H_MIN, Math.min(H_MAX, Math.round((h + dir * st) / st) * st));
        slide.set(toV(next), true, true);
        set(next);
      },
      true,
    );
    const reads = el("div", "st-reads");
    panel.appendChild(reads);
    const rV = readout(reads, "Speed", "km/s", false);
    const rT = readout(reads, "One trip around Earth", "hours", true);
    const meter = el("div", "st-card st-meter");
    const gcv = el("canvas", "st-graph");
    meter.appendChild(gcv);
    panel.appendChild(meter);
    const graph = ME.graph(gcv);
    offs.push(graph.stop);
    const note = el(
      "p",
      "sp-note",
      "Earth is drawn to scale; the satellite is drawn much bigger. 1 second here = 1 hour in space. The yellow dot is over India.",
    );
    panel.appendChild(note);
    const row = el("div", "sp-row");
    panel.appendChild(row);

    // the orbit-time curve, T grows as (R + h)^1.5: drawn as short straight pieces
    const curve = [];
    for (let k = 0; k <= 40; k++) {
      const h = Math.max(H_MIN, k * 1000);
      curve.push([h / 1000, SP.orbit(h).T / 3600]);
    }
    const lines = [];
    for (let k = 1; k < curve.length; k++) lines.push({ from: curve[k - 1], to: curve[k] });

    function showGoal() {
      if (gi < goals.length)
        goal.innerHTML = "Challenge " + (gi + 1) + " of " + goals.length + ":<br>" + goals[gi].text;
      else goal.innerHTML = "All challenges done! Keep exploring.";
    }
    function met(g, o) {
      if (g.height) return Math.abs(S.h - g.height[0]) <= g.height[1];
      if (g.hours) return Math.abs(o.T / 3600 - g.hours[0]) <= g.hours[1];
      return false;
    }
    function set(h) {
      h = Math.max(H_MIN, Math.min(H_MAX, h));
      if (h === S.h) return;
      S.setHeight(h);
      const o = S.info();
      clearTimeout(timer);
      if (gi < goals.length && met(goals[gi], o))
        timer = setTimeout(function () {
          if (!met(goals[gi], S.info())) return;
          MT.speak(goals[gi].say || "");
          ME.celebrate(goal);
          goal.innerHTML = "Challenge solved!";
          gi++;
          MT.score(gi + " / " + goals.length);
          MT.later(function () {
            goal.classList.remove("st-solved");
            showGoal();
            if (gi >= goals.length)
              MT.later(function () {
                MT.done(area, d.doneText || "You are a space engineer!", ctx.again);
              }, 1500);
          }, 2200);
        }, 900);
    }
    offs.push(function () {
      clearTimeout(timer);
    });
    btn(row, "🔭 Zoom out", function () {
      stage.view.want = { target: new stage.THREE.Vector3(), dist: Math.min(140, stage.view.dist * 1.4) };
    });
    btn(row, "🔍 Zoom in", function () {
      stage.view.want = { target: new stage.THREE.Vector3(), dist: Math.max(9, stage.view.dist / 1.4) };
    });
    holoBtn(row, "satellite");
    set(nice(d.start || 2000));
    showGoal();
    // the 3D orbit, the read-outs and the graph move in the same frame (Gizmos coupling)
    stage.tick = function (dt) {
      S.update(dt);
      const o = S.info();
      const hours = o.T / 3600;
      rV.step(o.v, dt, function (v) {
        return v.toFixed(2);
      });
      rT.step(hours, dt, function (v) {
        return v < 2 ? (v * 60).toFixed(0) : v.toFixed(1);
      });
      rT.unit.textContent = hours < 2 ? "minutes" : "hours";
      graph.draw({
        xMax: 40,
        yMax: 28,
        ticks: 4,
        xLabel: "Height (thousand km)",
        yLabel: "Trip (hours)",
        lines: lines,
        point: { x: S.h / 1000, y: hours },
        note: "Higher orbit → slower and longer trip",
      });
    };
  }
  return function () {
    dead = true;
    offs.forEach(function (f) {
      f();
    });
    if (stage) stage.dispose();
  };
}
