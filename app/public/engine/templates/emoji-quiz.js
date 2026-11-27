// Emoji quiz (early years): hear a word, find its picture among four.
// Activity data:
//   items: [{ emoji: "🚗", word: "Car" }, ...]   at least 4
//   questions: 8                                   optional, how many per round
import { MT } from "../js/kit.js";
import { frame, result } from "../js/early.js";
import { emojiImg } from "/shared/studio/emoji.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "emoji-quiz"] };

const CHOICES = 4;
const NEXT_AFTER_MS = 3500;

export default function emojiQuiz(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const panel = document.createElement("div");
  panel.className = "ey-panel eq-panel";
  panel.innerHTML =
    '<div class="eq-ask"><div class="eq-word"><span>Find:</span> <b></b></div>' +
    '<button class="ey-btn alt eq-hear" type="button">🔊 Hear it again</button></div>' +
    '<div class="ey-cards eq-choices"></div><div class="ey-feedback"></div>';
  f.stage.appendChild(panel);
  const word = panel.querySelector(".eq-word b");
  const choices = panel.querySelector(".eq-choices");
  const feedback = panel.querySelector(".ey-feedback");
  let round = [];
  let at = 0;
  let score = 0;
  let timer = 0;

  panel.querySelector(".eq-hear").addEventListener("click", () => round[at] && MT.speak(round[at].word));

  function start() {
    round = MT.shuffle(d.items).slice(0, Math.min(d.questions || 8, d.items.length));
    at = 0;
    score = 0;
    f.score(0);
    ask();
  }

  function ask() {
    if (at >= round.length) {
      f.progress("");
      result(f.root, { score, total: round.length, onAgain: start });
      return;
    }
    const q = round[at];
    f.progress(`Question ${at + 1} / ${round.length}`);
    word.textContent = q.word;
    feedback.textContent = "";
    feedback.className = "ey-feedback";
    MT.speak(q.word);
    const others = MT.shuffle(d.items.filter((i) => i.word !== q.word)).slice(0, CHOICES - 1);
    choices.innerHTML = "";
    for (const item of MT.shuffle([q, ...others])) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ey-card";
      b.dataset.word = item.word;
      b.setAttribute("aria-label", item.word);
      b.appendChild(emojiImg(item.emoji, item.word));
      b.addEventListener("click", () => answer(item, q, b));
      choices.appendChild(b);
    }
  }

  function answer(chosen, q, button) {
    const all = [...choices.children];
    if (all.some((b) => b.disabled)) return;
    all.forEach((b) => (b.disabled = true));
    button.classList.add("ey-tap");
    if (chosen.word === q.word) {
      score++;
      f.score(score);
      button.classList.add("is-right");
      feedback.textContent = "🎉 Yes! Well done!";
      feedback.className = "ey-feedback good";
      MT.sfx.good();
      MT.speak("Yes! " + q.word);
    } else {
      button.classList.add("is-wrong");
      all.find((b) => b.dataset.word === q.word).classList.add("is-right");
      feedback.textContent = `That's the ${chosen.word}. The answer is ${q.word}.`;
      feedback.className = "ey-feedback bad";
      MT.sfx.bad();
      MT.speak(`That's the ${chosen.word}. The answer is ${q.word}.`);
    }
    timer = setTimeout(() => {
      at++;
      ask();
    }, NEXT_AFTER_MS);
  }

  start();
  return () => clearTimeout(timer);
}
