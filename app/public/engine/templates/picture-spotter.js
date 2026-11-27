// Picture spotter (early years): six pictures pinned to the wall; find the one asked for.
// Rounds go on until the class stops; the score counts correct finds.
// Gold Standard layout (studioFrame): the pinned pictures on the living stage on the left; the
// question, feedback and rolling read-outs on the right.
// Activity data:
//   items: [{ word: "Ginger", photo: "images/Allam.jpg", media?: { type: "mp4", src } }]   photo or emoji, at least 6
//   choices: 6                                              optional, pictures per round
import { MT } from "../js/kit.js";
import { studioFrame, studioButton, picture, markPick, sayWord } from "../js/early.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "picture-spotter"] };

const ASK = ["Where is the", "Find the", "Can you spot the", "Which one is the"];
const NEXT_AFTER_MS = 2400;

export default function pictureSpotter(area, d, ctx) {
  const f = studioFrame(area, { icon: d.icon, title: d.title });
  const field = document.createElement("div");
  field.className = "ps-field";
  f.stage.appendChild(field);
  const ask = document.createElement("div");
  ask.className = "st-card ps-ask";
  ask.innerHTML = '<div class="ps-q"></div><div class="ps-word"></div>';
  ask.appendChild(studioButton("🔊 Hear it", true, () => target && speakIt()));
  f.panel.appendChild(ask);
  const q = ask.querySelector(".ps-q");
  const wordBox = ask.querySelector(".ps-word");
  let target = null;
  let line = "";
  let tiles = null;
  let score = 0;
  let rounds = 0;
  let done = false;
  let timer = 0;
  f.score(0);

  function speakIt() {
    sayWord(line, null);
    tiles.light(-1);
    setTimeout(() => tiles && tiles.clear(), 900);
  }

  function round() {
    done = false;
    rounds++;
    f.say("");
    f.goal("Touch the picture that matches!");
    f.progress(rounds, 0, "Round");
    const prev = target;
    const pool = d.items.filter((i) => i !== prev);
    target = pool[Math.floor(Math.random() * pool.length)];
    const lead = ASK[Math.floor(Math.random() * ASK.length)];
    q.textContent = lead;
    line = `${lead} ${target.word}?`;
    tiles = ME.tiles(wordBox, target.word);
    speakIt();
    const n = Math.min(d.choices || 6, d.items.length);
    const others = MT.shuffle(d.items.filter((i) => i !== target)).slice(0, n - 1);
    field.replaceChildren();
    MT.shuffle([target, ...others]).forEach((item, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ps-card st-pick";
      card.style.setProperty("--tilt", `${(i % 2 ? 1 : -1) * (2 + Math.random() * 4)}deg`);
      card.style.animationDelay = `${i * 0.07}s`;
      card.setAttribute("aria-label", item.word);
      const pic = picture(item, ctx.base);
      pic.classList.add("st-hero");
      card.appendChild(pic);
      card.addEventListener("click", (e) => pick(item, card, e));
      field.appendChild(card);
    });
  }

  function pick(item, card, e) {
    if (done) return;
    ME.squash(card);
    if (item === target) {
      done = true;
      score++;
      f.score(score);
      markPick(card, true, e);
      field.querySelectorAll(".ps-card").forEach((c) => c !== card && c.classList.add("is-dim"));
      const cheer = MT.shuffle(["Amazing!", "Brilliant!", "You got it!", "Superstar!", "Well done!"])[0];
      f.say(`🎉 ${cheer} The ${target.word}!`, "good");
      f.solved();
      f.celebrate(card);
      ME.sound.good();
      tiles.light(-1);
      MT.speak(cheer);
      timer = setTimeout(round, NEXT_AFTER_MS);
    } else {
      markPick(card, false, e);
      f.say(`That's not the ${target.word}. Try again!`, "bad");
      ME.sound.bad();
      MT.speak(`That's not the ${target.word}. Try again!`);
    }
  }

  round();
  return () => {
    clearTimeout(timer);
    f.stop();
  };
}
