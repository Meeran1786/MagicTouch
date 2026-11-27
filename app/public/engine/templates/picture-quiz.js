// Picture quiz (early years): a round of mixed questions about a set of pictures.
//   "What is this?"            a picture; pick its word
//   "Find the matching picture" a word; pick its picture
//   "Spell what you see!"      a picture; tap letters in order to spell its word
// Activity data:
//   items: [{ word: "Apple", photo: "assets/photos/apple.jpg" }]  or emoji, number, swatch, shape
//   kinds: ["pic2word", "word2pic", "spell"]   optional, which question kinds to use
//   labels: { word2pic: "Find the colour!" }    optional, the line above a question, per kind
import { MT } from "../js/kit.js";
import { frame, picture, result } from "../js/early.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "picture-quiz"] };

const KINDS = ["pic2word", "word2pic", "spell"];

export default function pictureQuiz(area, d, ctx) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const panel = document.createElement("div");
  panel.className = "ey-panel pq";
  panel.innerHTML =
    '<div class="pq-label"></div><div class="pq-prompt"></div><div class="pq-answer"></div>' +
    '<div class="ey-feedback"></div><div class="pq-actions"></div>';
  f.stage.appendChild(panel);
  const label = panel.querySelector(".pq-label");
  const prompt = panel.querySelector(".pq-prompt");
  const answer = panel.querySelector(".pq-answer");
  const feedback = panel.querySelector(".ey-feedback");
  const actions = panel.querySelector(".pq-actions");
  const kinds = d.kinds || KINDS;
  let questions = [];
  let at = 0;
  let score = 0;

  function start() {
    let last = null;
    questions = MT.shuffle(d.items)
      .slice(0, d.questions || d.items.length)
      .map((item) => {
        let kind = kinds[Math.floor(Math.random() * kinds.length)];
        if (kind === last && kinds.length > 1) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
        last = kind;
        const options = MT.shuffle([item, ...MT.shuffle(d.items.filter((i) => i !== item)).slice(0, 3)]);
        return { item, kind, options };
      });
    at = 0;
    score = 0;
    f.score(0);
    ask();
  }

  function button(text, cls, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = text;
    b.addEventListener("click", fn);
    return b;
  }

  function ask() {
    if (at >= questions.length) {
      f.progress("");
      result(f.root, { score, total: questions.length, onAgain: start });
      return;
    }
    const q = questions[at];
    f.progress(`Question ${at + 1} / ${questions.length}`);
    prompt.innerHTML = answer.innerHTML = actions.innerHTML = "";
    feedback.textContent = "";
    feedback.className = "ey-feedback";
    if (q.kind === "word2pic") {
      label.textContent = (d.labels && d.labels.word2pic) || "Find the matching picture";
      prompt.appendChild(tiles(q.item.word));
      MT.speak(q.item.word);
      actions.appendChild(button("🔊 Hear it", "ey-btn alt", () => MT.speak(q.item.word)));
    } else {
      label.textContent = (d.labels && d.labels[q.kind]) || (q.kind === "spell" ? "Spell what you see!" : "What is this?");
      prompt.appendChild(picture(q.item, ctx.base));
    }
    if (q.kind === "spell") spell(q);
    else choose(q);
  }

  function tiles(word) {
    const w = document.createElement("div");
    w.className = "pq-tiles";
    for (const ch of word.toUpperCase()) {
      const t = document.createElement("span");
      t.className = ch === " " ? "gap" : "";
      t.textContent = ch;
      w.appendChild(t);
    }
    return w;
  }

  function choose(q) {
    const grid = document.createElement("div");
    grid.className = "ey-cards pq-options " + q.kind;
    for (const opt of q.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ey-card";
      if (q.kind === "word2pic") b.appendChild(picture(opt, ctx.base));
      else b.textContent = opt.word;
      b.addEventListener("click", () => {
        if (grid.querySelector(":disabled")) return;
        grid.querySelectorAll("button").forEach((x, k) => {
          x.disabled = true;
          if (q.options[k] === q.item) x.classList.add("is-right");
        });
        b.classList.add("ey-tap");
        if (opt !== q.item) b.classList.add("is-wrong");
        mark(opt === q.item, q);
      });
      grid.appendChild(b);
    }
    answer.appendChild(grid);
  }

  function spell(q) {
    const letters = [...q.item.word.toUpperCase()];
    const slots = document.createElement("div");
    slots.className = "pq-slots";
    const bank = document.createElement("div");
    bank.className = "pq-bank";
    const filled = [];
    letters.forEach((ch) => {
      const s = document.createElement("button");
      s.type = "button";
      s.className = ch === " " ? "pq-slot gap" : "pq-slot";
      s.disabled = ch === " ";
      s.addEventListener("click", () => {
        const k = [...slots.children].indexOf(s);
        const from = filled[k];
        if (!from) return;
        from.hidden = false;
        filled[k] = null;
        s.textContent = "";
        check.disabled = true;
      });
      slots.appendChild(s);
    });
    MT.shuffle(letters.filter((c) => c !== " ")).forEach((ch) => {
      bank.appendChild(
        button(ch, "pq-letter", (e) => {
          const k = letters.findIndex((c, i) => c !== " " && !filled[i]);
          if (k < 0) return;
          filled[k] = e.currentTarget;
          slots.children[k].textContent = ch;
          e.currentTarget.hidden = true;
          MT.sfx.tap();
          check.disabled = letters.some((c, i) => c !== " " && !filled[i]);
        }),
      );
    });
    answer.append(slots, bank);
    const check = button("Check ✓", "ey-btn", () => {
      const ok = [...slots.children].every((s, i) => letters[i] === " " || s.textContent === letters[i]);
      [...slots.children].forEach((s, i) => s.classList.add(letters[i] === " " || s.textContent === letters[i] ? "ok" : "no"));
      bank.querySelectorAll("button").forEach((b) => (b.disabled = true));
      check.remove();
      mark(ok, q);
    });
    check.disabled = true;
    actions.append(button("🔊 Hear it", "ey-btn alt", () => MT.speak(q.item.word)), check);
  }

  function mark(ok, q) {
    if (ok) score++;
    f.score(score);
    feedback.textContent = ok ? `🎉 Yes! It's ${q.item.word}!` : `Not quite. It's ${q.item.word}.`;
    feedback.className = "ey-feedback " + (ok ? "good" : "bad");
    if (ok) MT.sfx.good();
    else MT.sfx.bad();
    MT.speak(ok ? `Yes! ${q.item.word}` : `It's ${q.item.word}`);
    actions.innerHTML = "";
    actions.appendChild(
      button(at + 1 < questions.length ? "Next →" : "See my score →", "ey-btn", () => {
        at++;
        ask();
      }),
    );
  }

  start();
}
