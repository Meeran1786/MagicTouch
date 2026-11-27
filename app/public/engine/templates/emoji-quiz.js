// Emoji quiz (early years): hear a word, find its picture among four.
// Gold Standard layout (studioFrame): the four pictures stand on the living stage on the left;
// the word, its letter tiles, the feedback and the rolling stars are on the right.
// Activity data:
//   items: [{ emoji: "🚗", word: "Car", media?: { type: "mp4", src } }, ...]   at least 4
//   questions: 8                                   optional, how many per round
import { MT } from "../js/kit.js";
import { studioFrame, studioResult, studioButton, pickCard, markPick, picture, sayWord } from "../js/early.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "emoji-quiz"] };

const CHOICES = 4;
const NEXT_AFTER_MS = 3200;

export default function emojiQuiz(area, d, ctx) {
  const f = studioFrame(area, { icon: d.icon, title: d.title });
  const grid = document.createElement("div");
  grid.className = "ey-grid4";
  f.stage.appendChild(grid);
  const ask = document.createElement("div");
  ask.className = "st-card eq-ask";
  ask.innerHTML = '<div class="eq-find">Find the</div><div class="eq-word"></div>';
  const wordBox = ask.querySelector(".eq-word");
  ask.appendChild(studioButton("🔊 Hear it again", true, () => round[at] && speakIt()));
  f.panel.appendChild(ask);
  let round = [];
  let at = 0;
  let score = 0;
  let timer = 0;
  let tiles = null;

  function speakIt() {
    sayWord(round[at].word, tiles);
  }

  function start() {
    round = MT.shuffle(d.items).slice(0, Math.min(d.questions || 8, d.items.length));
    at = 0;
    score = 0;
    f.score(0);
    next();
  }

  function next() {
    if (at >= round.length) {
      f.goal("");
      studioResult(f, { score, total: round.length, onAgain: start });
      return;
    }
    const q = round[at];
    f.goal(`Question ${at + 1} of ${round.length}: touch the right picture.`);
    f.progress(at + 1, round.length);
    f.say("");
    tiles = ME.tiles(wordBox, q.word);
    speakIt();
    const others = MT.shuffle(d.items.filter((i) => i.word !== q.word)).slice(0, CHOICES - 1);
    grid.replaceChildren();
    MT.shuffle([q, ...others]).forEach((item, k) => {
      const pic = picture(item, ctx.base);
      pic.classList.add("st-hero");
      const b = pickCard(pic, item.word, (e) => answer(item, q, b, e));
      b.dataset.word = item.word;
      b.classList.add("st-float");
      b.style.setProperty("--st-delay", `${-k * 0.9}s`);
      b.style.animationDelay = `${k * 70}ms, var(--st-delay)`;
      grid.appendChild(b);
    });
  }

  function answer(chosen, q, button, e) {
    const all = [...grid.children];
    if (all.some((b) => b.disabled)) return;
    all.forEach((b) => (b.disabled = true));
    const right = all.find((b) => b.dataset.word === q.word);
    if (chosen.word === q.word) {
      score++;
      f.score(score);
      markPick(button, true, e);
      all.forEach((b) => b !== button && b.classList.add("is-dim"));
      f.say(`🎉 Yes! The ${q.word}!`, "good");
      f.solved();
      f.celebrate(button);
      ME.sound.good();
      MT.speak(["Yes!", q.word]);
      tiles.light(-1);
    } else {
      markPick(button, false, e);
      markPick(right, true);
      f.say(`That's the ${chosen.word}. The answer is ${q.word}.`, "bad");
      ME.sound.bad();
      MT.speak(["That's the", chosen.word, "The answer is", q.word]);
    }
    timer = setTimeout(() => {
      at++;
      next();
    }, NEXT_AFTER_MS);
  }

  start();
  return () => {
    clearTimeout(timer);
    f.stop();
  };
}
