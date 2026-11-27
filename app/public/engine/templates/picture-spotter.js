// Picture spotter (early years): six pictures pinned to the wall; find the one asked for.
// Rounds go on until the class stops; the score counts correct finds.
// Activity data:
//   items: [{ word: "Ginger", photo: "images/Allam.jpg" }]   photo or emoji, at least 6
//   choices: 6                                              optional, pictures per round
import { MT } from "../js/kit.js";
import { frame, picture } from "../js/early.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "picture-spotter"] };

const ASK = [
  (w) => `Where is the <b></b>?`,
  (w) => `Find the <b></b>!`,
  (w) => `Can you spot the <b></b>?`,
  (w) => `Which one is the <b></b>?`,
];
const NEXT_AFTER_MS = 2300;

export default function pictureSpotter(area, d, ctx) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const wrap = document.createElement("div");
  wrap.className = "ps-wrap";
  wrap.innerHTML =
    '<div class="ey-panel ps-ask"><div class="ps-q"></div><div class="ps-hint">Touch the picture that matches!</div></div><div class="ps-field"></div><div class="ey-feedback"></div>';
  f.stage.appendChild(wrap);
  const q = wrap.querySelector(".ps-q");
  const field = wrap.querySelector(".ps-field");
  const feedback = wrap.querySelector(".ey-feedback");
  let target = null;
  let score = 0;
  let done = false;
  let timer = 0;
  f.score(0);

  function round() {
    done = false;
    feedback.textContent = "";
    feedback.className = "ey-feedback";
    const prev = target;
    const pool = d.items.filter((i) => i !== prev);
    target = pool[Math.floor(Math.random() * pool.length)];
    q.innerHTML = ASK[Math.floor(Math.random() * ASK.length)]();
    q.querySelector("b").textContent = target.word;
    MT.speak(q.textContent);
    const n = Math.min(d.choices || 6, d.items.length);
    const others = MT.shuffle(d.items.filter((i) => i !== target)).slice(0, n - 1);
    field.innerHTML = "";
    MT.shuffle([target, ...others]).forEach((item, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ps-card";
      card.style.setProperty("--tilt", `${(i % 2 ? 1 : -1) * (3 + Math.random() * 5)}deg`);
      card.style.animationDelay = `${i * 0.07}s`;
      card.setAttribute("aria-label", item.word);
      card.appendChild(picture(item, ctx.base));
      card.addEventListener("click", () => pick(item, card));
      field.appendChild(card);
    });
  }

  function pick(item, card) {
    if (done) return;
    if (item === target) {
      done = true;
      score++;
      f.score(score);
      card.classList.add("is-right");
      feedback.textContent = MT.shuffle(["Amazing!", "Brilliant!", "You got it!", "Superstar!", "Well done!"])[0];
      feedback.className = "ey-feedback good";
      MT.sfx.good();
      MT.confetti();
      MT.speak(feedback.textContent);
      timer = setTimeout(round, NEXT_AFTER_MS);
    } else {
      card.classList.remove("is-wrong");
      void card.offsetWidth;
      card.classList.add("is-wrong");
      feedback.textContent = `That's not the ${target.word}. Try again!`;
      feedback.className = "ey-feedback bad";
      MT.sfx.bad();
      MT.speak(feedback.textContent);
    }
  }

  round();
  return () => clearTimeout(timer);
}
