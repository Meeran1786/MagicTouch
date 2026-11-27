// T10 Quiz (board-style MCQ): one question at a time, big answer cards, instant feedback with the reason,
// score and a review at the end. Question kinds, all data:
//   {q, options:["…","…"], answer:1, explain, marks, figure:"<svg…>"}        multiple choice (2–4 options)
//   {type:"truefalse", q, answer:true, explain}                                true / false
//   {type:"assertion", assertion, reason, answer:0, explain}                  assertion–reason, standard 4 choices
// d.shuffleOptions (default true) mixes the choices of plain MCQs; d.passPercent (default 60) sets the cheer.
import { MT } from "../js/kit.js";

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
  const wrap = document.createElement("div");
  wrap.className = "qz-wrap";
  area.appendChild(wrap);
  function show() {
    const q = qs[qi];
    wrap.innerHTML = "";
    MT.score(got + " / " + total + " marks");
    const card = document.createElement("div");
    card.className = "qz-card";
    card.innerHTML =
      '<div class="qz-n">Question ' +
      (qi + 1) +
      " of " +
      qs.length +
      " · " +
      q.marks +
      " mark" +
      (q.marks > 1 ? "s" : "") +
      '</div><div class="qz-q">' +
      q.html +
      "</div>" +
      (q.figure ? '<div class="qz-fig">' + q.figure + "</div>" : "");
    wrap.appendChild(card);
    const long =
      q.choices.some(function (c) {
        return c.text.length > 34;
      }) || q.choices.length < 3;
    const grid = document.createElement("div");
    grid.className = "qz-opts" + (long ? " one" : "");
    wrap.appendChild(grid);
    const fb = document.createElement("div");
    fb.className = "qz-fb";
    wrap.appendChild(fb);
    let answered = false;
    q.choices.forEach(function (c, i) {
      const b = document.createElement("button");
      b.className = "qz-opt";
      b.innerHTML = '<span class="qz-l">' + LET[i] + "</span><span>" + c.text + "</span>";
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
        } else {
          b.classList.add("wrong");
          MT.bad("Not this one");
        }
        log.push({ ok: ok, q: q.short });
        MT.score(got + " / " + total + " marks");
        fb.innerHTML =
          '<div class="qz-why"><b>' +
          (ok
            ? "Correct."
            : "The answer is " +
              LET[
                q.choices.findIndex(function (x) {
                  return x.orig === q.answer;
                })
              ] +
              ".") +
          "</b> " +
          q.explain +
          "</div>";
        const nx = document.createElement("button");
        nx.className = "mt-btn qz-next";
        nx.textContent = qi + 1 < qs.length ? "Next question →" : "See my score →";
        nx.addEventListener("click", function () {
          qi++;
          if (qi < qs.length) show();
          else end();
        });
        fb.appendChild(nx);
        nx.scrollIntoView({ block: "nearest" });
        if (q.explain) MT.speak((ok ? "Correct. " : "") + q.explain.replace(/<[^>]+>/g, ""));
      });
    });
  }
  function end() {
    wrap.innerHTML = "";
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
    MT.done(
      area,
      (pass ? d.doneText || "Well done!" : "Good try!") + " " + got + " / " + total + " (" + pct + "%)",
      ctx.again,
      rev,
    );
  }
  show();
}
