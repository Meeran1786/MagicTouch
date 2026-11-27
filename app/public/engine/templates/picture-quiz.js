// Picture quiz (early years): a round of mixed questions about a set of pictures.
//   "What is this?"            a picture; pick its word
//   "Find the matching picture" a word; pick its picture
//   "Spell what you see!"      a picture; tap letters in order to spell its word
// Gold Standard layout (studioFrame): the picture (or the four picture answers) on the living stage
// on the left; the question, word answers, letter bank and rolling read-outs on the right.
// Activity data:
//   items: [{ word: "Apple", photo: "assets/photos/apple.jpg", media?: { type: "mp4", src } }]
//          or emoji, number, swatch, shape
//   kinds: ["pic2word", "word2pic", "spell"]   optional, which question kinds to use
//   labels: { word2pic: "Find the colour!" }    optional, the line above a question, per kind
import { MT } from "../js/kit.js";
import { studioFrame, studioResult, studioButton, pickCard, markPick, picture, sayWord } from "../js/early.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "picture-quiz"] };

const KINDS = ["pic2word", "word2pic", "spell"];

export default function pictureQuiz(area, d, ctx) {
  const f = studioFrame(area, { icon: d.icon, title: d.title });
  const card = document.createElement("div");
  card.className = "st-card pq";
  card.innerHTML = '<div class="pq-label"></div><div class="pq-answer"></div><div class="pq-actions"></div>';
  f.panel.appendChild(card);
  const label = card.querySelector(".pq-label");
  const answer = card.querySelector(".pq-answer");
  const actions = card.querySelector(".pq-actions");
  const kinds = d.kinds || KINDS;
  let questions = [];
  let at = 0;
  let score = 0;
  let tiles = null;

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

  function hero(item) {
    const pic = picture(item, ctx.base);
    pic.classList.add("st-hero", "ey-hero");
    f.stage.querySelectorAll(":scope > :not(.st-ambient)").forEach((x) => x.remove());
    f.stage.appendChild(pic);
  }

  function ask() {
    if (at >= questions.length) {
      f.goal("");
      studioResult(f, { score, total: questions.length, onAgain: start });
      return;
    }
    const q = questions[at];
    f.progress(at + 1, questions.length);
    f.say("");
    answer.replaceChildren();
    actions.replaceChildren();
    answer.className = "pq-answer " + q.kind;
    tiles = null;
    const text =
      (d.labels && d.labels[q.kind]) ||
      (q.kind === "spell"
        ? "Spell what you see!"
        : q.kind === "word2pic"
          ? "Find the matching picture"
          : "What is this?");
    f.goal(`Question ${at + 1} of ${questions.length}: ${text}`);
    label.textContent =
      q.kind === "word2pic" ? "Find the" : q.kind === "spell" ? "Touch the letters in order" : "Touch its name";
    if (q.kind === "word2pic") {
      const w = document.createElement("div");
      answer.appendChild(w);
      tiles = ME.tiles(w, q.item.word.toUpperCase());
      sayWord(q.item.word, tiles);
      actions.appendChild(studioButton("🔊 Hear it", true, () => sayWord(q.item.word, tiles)));
      pictures(q);
    } else {
      hero(q.item);
      if (q.kind === "spell") spell(q);
      else words(q);
    }
  }

  function settle(q, grid, chosen, e) {
    const all = [...grid.children];
    all.forEach((x) => (x.disabled = true));
    const ok = chosen === q.item;
    const k = q.options.indexOf(q.item);
    markPick(all[q.options.indexOf(chosen)], ok, e);
    if (!ok) markPick(all[k], true);
    else all.forEach((x, j) => j !== k && x.classList.add("is-dim"));
    mark(ok, q, all[k]);
  }

  // word2pic: four pictures on the stage
  function pictures(q) {
    const grid = document.createElement("div");
    grid.className = "ey-grid4";
    q.options.forEach((opt, k) => {
      const pic = picture(opt, ctx.base);
      pic.classList.add("st-hero");
      const b = pickCard(pic, opt.word, (e) => settle(q, grid, opt, e));
      b.style.setProperty("--st-delay", `${-k * 0.9}s`);
      b.style.animationDelay = `${k * 70}ms, var(--st-delay)`;
      grid.appendChild(b);
    });
    f.stage.querySelectorAll(":scope > :not(.st-ambient)").forEach((x) => x.remove());
    f.stage.appendChild(grid);
  }

  // pic2word: four word cards in the panel
  function words(q) {
    const grid = document.createElement("div");
    grid.className = "pq-words";
    q.options.forEach((opt) => {
      const b = pickCard(opt.word, opt.word, (e) => settle(q, grid, opt, e));
      grid.appendChild(b);
    });
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
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pq-letter";
      b.textContent = ch;
      b.addEventListener("click", () => {
        const k = letters.findIndex((c, i) => c !== " " && !filled[i]);
        if (k < 0) return;
        filled[k] = b;
        const slot = slots.children[k];
        slot.textContent = ch;
        ME.squash(slot);
        b.hidden = true;
        ME.sound.tap();
        check.disabled = letters.some((c, i) => c !== " " && !filled[i]);
      });
      bank.appendChild(b);
    });
    answer.append(slots, bank);
    const check = studioButton("Check ✓", false, () => {
      const ok = [...slots.children].every((s, i) => letters[i] === " " || s.textContent === letters[i]);
      [...slots.children].forEach((s, i) =>
        s.classList.add(letters[i] === " " || s.textContent === letters[i] ? "ok" : "no"),
      );
      bank.querySelectorAll("button").forEach((b) => (b.disabled = true));
      check.remove();
      mark(ok, q, slots);
    });
    check.disabled = true;
    actions.append(
      studioButton("🔊 Hear it", true, () => MT.speak(q.item.word)),
      check,
    );
  }

  function mark(ok, q, el) {
    if (ok) {
      score++;
      f.solved();
      f.celebrate(el);
      ME.sound.good();
      if (tiles) tiles.light(-1);
    } else ME.sound.bad();
    f.score(score);
    f.say(ok ? `🎉 Yes! It's ${q.item.word}!` : `Not quite. It's ${q.item.word}.`, ok ? "good" : "bad");
    MT.speak(ok ? `Yes! ${q.item.word}` : `It's ${q.item.word}`);
    actions.replaceChildren(
      studioButton(at + 1 < questions.length ? "Next →" : "See my score →", false, () => {
        at++;
        ask();
      }),
    );
  }

  start();
  return () => f.stop();
}
