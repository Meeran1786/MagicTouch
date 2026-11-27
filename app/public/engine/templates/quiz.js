// T10 Quiz (board-style MCQ): one question at a time, big answer cards, instant feedback with the reason,
// score and a review at the end. Question kinds, all data:
//   {q, options:["…","…"], answer:1, explain, marks, figure:"<svg…>"}        multiple choice (2–4 options)
//   {type:"truefalse", q, answer:true, explain}                                true / false
//   {type:"assertion", assertion, reason, answer:0, explain}                  assertion–reason, standard 4 choices
// d.shuffleOptions (default true) mixes the choices of plain MCQs; d.passPercent (default 60) sets the cheer.
// d.goal is an optional challenge text for the yellow card.
// Gold Standard layout (CLAUDE.md §7): the question and its answer cards are the picture on the left; the
// panel on the right holds the challenge card, the marks (they roll up), a dot per question and the
// reason, which cross-fades in with the Next button in the same frame as the answer lights up.
import { MT } from "../js/kit.js";
import { ME } from "/shared/motion-engine.js";

// Runs inside the engine page's header and instruction line (not full screen).
export const meta = { fullscreen: false };

export default function quiz(area, d, ctx) {
  const AR = [
    "Both A and R are true, and R explains A.",
    "Both A and R are true, but R does not explain A.",
    "A is true, but R is false.",
    "A is false, but R is true.",
  ];
  const LET = ["A", "B", "C", "D"];
  // turn every question into {html, choices:[{text,orig}], answer, explain, marks}
  let qs = d.questions.map(function (q) {
    const o = { explain: q.explain || "", marks: q.marks || 1, figure: q.figure || "" };
    if (q.type === "truefalse") {
      o.html = q.q;
      o.choices = [
        { text: "True", orig: 0 },
        { text: "False", orig: 1 },
      ];
      o.answer = q.answer ? 0 : 1;
    } else if (q.type === "assertion") {
      o.html =
        '<div class="qz-ar"><b>Assertion (A):</b> ' +
        q.assertion +
        '</div><div class="qz-ar"><b>Reason (R):</b> ' +
        q.reason +
        "</div>";
      o.choices = AR.map(function (t, i) {
        return { text: t, orig: i };
      });
      o.answer = q.answer;
    } else {
      o.html = q.q;
      let ch = q.options.map(function (t, i) {
        return { text: t, orig: i };
      });
      if (d.shuffleOptions !== false && !q.keepOrder) ch = MT.shuffle(ch);
      o.choices = ch;
      o.answer = q.answer;
    }
    o.short = (q.q || q.assertion || "").replace(/<[^>]+>/g, "");
    return o;
  });
  if (d.shuffleQuestions) qs = MT.shuffle(qs);
  const total = qs.reduce(function (s, q) {
    return s + q.marks;
  }, 0);
  let got = 0;
  let qi = 0;
  const log = [];
  const ui = ME.split(area, {
    goal: d.goal || "Answer " + qs.length + " questions. Aim for " + (d.passPercent || 60) + "% or more.",
  });
  const board = document.createElement("div");
  board.className = "st-board";
  board.style.overflow = "auto";
  ui.holder.appendChild(board);
  const reads = ME.reads(ui.panel, [
    { id: "m", k: "Marks" },
    { id: "q", k: "Question", accent: true },
  ]);
  const dots = ME.dots(ui.panel, qs.length);
  dots.el.classList.add("st-card");
  const info = ME.info(ui.panel, { title: "Think, then tap", body: "Tap the answer you think is right." });
  const next = document.createElement("button");
  next.type = "button";
  next.className = "st-btn";
  next.hidden = true;
  ui.panel.appendChild(next);
  next.addEventListener("click", function () {
    qi++;
    if (qi < qs.length) show();
    else end();
  });
  reads.set("m", 0, total);
  function show() {
    const q = qs[qi];
    board.innerHTML = "";
    next.hidden = true;
    MT.score(got + " / " + total + " marks");
    reads.set("q", qi + 1, qs.length);
    dots.set(qi, "on");
    info.set({ title: "Think, then tap", body: "Tap the answer you think is right." });
    const head = document.createElement("div");
    head.innerHTML =
      '<span class="st-info-tag">Question ' +
      (qi + 1) +
      " of " +
      qs.length +
      " · " +
      q.marks +
      " mark" +
      (q.marks > 1 ? "s" : "") +
      '</span><div class="qz-q">' +
      q.html +
      "</div>" +
      (q.figure ? '<div class="qz-fig">' + q.figure + "</div>" : "");
    board.appendChild(head);
    const long =
      q.choices.some(function (c) {
        return c.text.length > 34;
      }) || q.choices.length < 3;
    const grid = document.createElement("div");
    grid.className = "st-opts" + (long ? " one" : "");
    board.appendChild(grid);
    let answered = false;
    q.choices.forEach(function (c, i) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "st-opt";
      b.innerHTML = '<span class="st-opt-l">' + LET[i] + "</span><span>" + c.text + "</span>";
      grid.appendChild(b);
      b.addEventListener("click", function () {
        if (answered) return;
        answered = true;
        const ok = c.orig === q.answer;
        [].forEach.call(grid.children, function (x, j) {
          x.disabled = true;
          if (q.choices[j].orig === q.answer) x.classList.add("right");
        });
        if (ok) {
          got += q.marks;
          MT.good("Correct!");
          ME.pop(b);
          ME.solved(ui.goal);
        } else {
          b.classList.add("wrong");
          ME.nudge(b);
          MT.bad("Not this one");
        }
        dots.set(qi, ok ? "ok" : "no");
        log.push({ ok: ok, q: q.short });
        MT.score(got + " / " + total + " marks");
        reads.set("m", got, total);
        const right =
          LET[
            q.choices.findIndex(function (x) {
              return x.orig === q.answer;
            })
          ];
        info.set({
          tag: ok ? "Correct" : "The answer is " + right,
          title: ok ? "Well done!" : "Here is why",
          body: q.explain || "",
          html: true,
        });
        next.textContent = qi + 1 < qs.length ? "Next question →" : "See my score →";
        next.hidden = false;
        ME.pop(next);
        if (q.explain) MT.speak(ok ? ["Correct.", q.explain] : q.explain);
      });
    });
  }
  function end() {
    const pct = Math.round((got / total) * 100),
      pass = pct >= (d.passPercent || 60);
    if (ctx.report) ctx.report({ score: got, total: total });
    const rev = log
      .map(function (r, i) {
        return (
          '<div class="qz-rev ' +
          (r.ok ? "ok" : "no") +
          '"><span>' +
          (r.ok ? "✓" : "✗") +
          "</span>Q" +
          (i + 1) +
          ". " +
          r.q +
          "</div>"
        );
      })
      .join("");
    next.hidden = true;
    MT.done(
      area,
      (pass ? d.doneText || "Well done!" : "Good try!") + " " + got + " / " + total + " (" + pct + "%)",
      ctx.again,
      rev,
    );
  }
  show();
}
