// T12 Lesson pack: a whole chapter as a row of steps (explore → simulate → order → quiz …), each step
// any other template. Steps are data:
//   {label:"Explore", activity:{template:"explore", instruction:"…", …}}   the step written in place
//   {label:"Practise", ref:"c10-science-ohms-law"}                         reuse an existing activity by id
// A step's own fields override the referenced activity's (e.g. a different instruction).
// Gold Standard (CLAUDE.md §7): the stepper uses the shared .st-steps chips (spring press, green when
// done); every step is a Gold Standard template itself, so the split screen and motion carry through.
import { MT } from "../js/kit.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function pack(area, d, ctx) {
  const instr = document.getElementById("mt-instr");
  const steps = d.steps.map(function (s) {
    let a = s.activity || {};
    if (s.ref) {
      const base = ctx.activity(s.ref);
      if (!base) return { label: s.label, missing: s.ref };
      const m = {};
      let k;
      for (k in base) m[k] = base[k];
      for (k in a) m[k] = a[k];
      a = m;
    }
    return { label: s.label || a.title || "Step", act: a };
  });
  const wrap = document.createElement("div");
  wrap.className = "pk-wrap";
  const bar = document.createElement("div");
  bar.className = "st-steps";
  const body = document.createElement("div");
  body.className = "pk-body";
  wrap.appendChild(bar);
  wrap.appendChild(body);
  area.appendChild(wrap);
  let cur = -1,
    stepClean = null,
    done = {},
    results = {};
  steps.forEach(function (s, i) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "st-step-chip";
    c.innerHTML = '<span class="n">' + (i + 1) + "</span><span></span>";
    c.lastChild.textContent = s.label;
    c.addEventListener("click", function () {
      if (i !== cur) run(i);
    });
    bar.appendChild(c);
  });
  function chips() {
    [].forEach.call(bar.children, function (c, i) {
      const was = c.classList.contains("on");
      c.classList.toggle("on", i === cur);
      c.classList.toggle("done", !!done[i]);
      c.querySelector(".n").textContent = done[i] && i !== cur ? "✓" : i + 1;
      if (i === cur && !was) ME.pop(c);
    });
  }
  function stop() {
    if (stepClean) {
      try {
        stepClean();
      } catch {
        /* the step was already gone */
      }
      stepClean = null;
    }
    MT.clearLater();
    MT.stopSpeech();
    body.innerHTML = "";
  }
  function run(i) {
    stop();
    cur = i;
    chips();
    const s = steps[i];
    if (s.missing) {
      body.textContent = 'This step points to "' + s.missing + '", which is not in the activity list.';
      return;
    }
    if (s.act.template === "pack") {
      body.textContent = "A lesson pack cannot hold another lesson pack.";
      return;
    }
    ctx.loadTemplate(s.act.template).then(
      function (tpl) {
        if (cur !== i) return;
        start(i, s, tpl);
      },
      function () {
        body.textContent = "Unknown template: " + s.act.template;
      },
    );
  }
  function start(i, s, tpl) {
    instr.textContent = s.act.instruction || "";
    MT.nextLabel = i + 1 < steps.length ? "Next: " + steps[i + 1].label + " →" : "Finish the chapter →";
    MT.next = function () {
      done[i] = 1;
      ME.sound.tap();
      if (i + 1 < steps.length) run(i + 1);
      else summary();
    };
    stepClean =
      tpl(
        body,
        s.act,
        Object.assign({}, ctx, {
          again: function () {
            run(i);
          },
          report: function (r) {
            results[i] = r;
          },
        }),
      ) || null;
    if (s.act.intro) MT.speak(s.act.intro);
  }
  function summary() {
    stop();
    cur = -1;
    chips();
    MT.next = null;
    instr.textContent = d.title || "";
    MT.score("");
    const list = steps
      .map(function (s, i) {
        const r = results[i];
        return (
          '<div class="qz-rev ' +
          (done[i] ? "ok" : "no") +
          '"><span>' +
          (done[i] ? "✓" : "–") +
          "</span>" +
          (i + 1) +
          ". " +
          s.label +
          (r ? ": " + r.score + " / " + r.total + " marks" : "") +
          "</div>"
        );
      })
      .join("");
    MT.done(
      body,
      d.doneText || "Chapter complete!",
      function () {
        done = {};
        results = {};
        run(0);
      },
      list,
    );
  }
  run(0);
  return function () {
    stop();
    MT.next = null;
    MT.nextLabel = null;
  };
}
