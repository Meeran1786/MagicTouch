// Balloon pop (early years): a sum with pictures to count ("3 + 4 = ?"); balloons carrying
// numbers float up, and the child pops the one with the answer.
// Activity data:
//   max: 9            optional, the largest number in a sum (answers go up to 2 × max)
//   op: "add" | "take" optional, add (default) or take away
//   questions: 10     optional, sums per round
//   choices: 4        optional, balloons per sum
//   emoji: "🍎🐥⭐"    optional, pictures drawn to count with
import { MT } from "../js/kit.js";
import { frame, result } from "../js/early.js";
import { emojiImg } from "/shared/studio/emoji.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "balloon-pop"] };

const COLOURS = ["#CC3054", "#E96E24", "#F3A328", "#2FA86A", "#631654", "#3A86FF"];
const balloonSvg = (c) =>
  '<svg viewBox="0 0 100 150" aria-hidden="true"><defs><radialGradient id="bp-' +
  c.slice(1) +
  '" cx="35%" cy="30%" r="75%">' +
  `<stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".3" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>` +
  '<path d="M50 104c2 14-8 22 0 44" fill="none" stroke="#9a8a96" stroke-width="2"/>' +
  `<ellipse cx="50" cy="52" rx="42" ry="50" fill="url(#bp-${c.slice(1)})"/><path d="M44 101h12l-6 7z" fill="${c}"/></svg>`;

export default function balloonPop(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const panel = document.createElement("div");
  panel.className = "bp";
  panel.innerHTML =
    '<div class="ey-panel bp-ask"><div class="bp-sum"></div><div class="bp-pics"></div></div><div class="bp-sky"></div><div class="ey-feedback"></div>';
  f.stage.appendChild(panel);
  const sumEl = panel.querySelector(".bp-sum");
  const pics = panel.querySelector(".bp-pics");
  const sky = panel.querySelector(".bp-sky");
  const feedback = panel.querySelector(".ey-feedback");
  const max = d.max || 9;
  const take = d.op === "take";
  const total = d.questions || 10;
  const emoji = Array.from(
    new Intl.Segmenter("en", { granularity: "grapheme" }).segment(d.emoji || "🍎⭐🐥🎈"),
    (s) => s.segment,
  );
  let at = 0;
  let score = 0;
  let answer = 0;
  let tries = 0;
  let timer = 0;

  function group(n, e) {
    const g = document.createElement("span");
    g.className = "bp-group";
    for (let i = 0; i < n; i++) g.appendChild(emojiImg(e, ""));
    return g;
  }

  function ask() {
    if (at >= total) {
      f.progress("");
      sky.replaceChildren();
      result(f.root, { score, total, onAgain: start });
      return;
    }
    f.progress(`Sum ${at + 1} / ${total}`);
    let a = 1 + Math.floor(Math.random() * max);
    let b = 1 + Math.floor(Math.random() * max);
    if (take && b > a) [a, b] = [b, a];
    answer = take ? a - b : a + b;
    tries = 0;
    const sign = take ? "−" : "+";
    sumEl.textContent = `${a} ${sign} ${b} = ?`;
    const e = emoji[at % emoji.length];
    pics.replaceChildren(group(a, e), Object.assign(document.createElement("b"), { textContent: sign }), group(b, e));
    if (take) pics.lastChild.classList.add("gone");
    feedback.textContent = "";
    feedback.className = "ey-feedback";
    MT.speak(`What is ${a} ${take ? "take away" : "plus"} ${b}?`);
    const wrong = new Set();
    while (wrong.size < (d.choices || 4) - 1) {
      const w = Math.max(0, answer + Math.round((Math.random() - 0.5) * 8));
      if (w !== answer) wrong.add(w);
    }
    const values = MT.shuffle([answer, ...wrong]);
    sky.style.setProperty("--lift", `${Math.max(0, sky.clientHeight - 240)}px`);
    sky.replaceChildren(
      ...values.map((v, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bp-balloon";
        btn.style.left = `${8 + (i * 84) / values.length + Math.random() * 6}%`;
        const t = 6 + Math.random() * 3;
        btn.style.setProperty("--t", `${t}s`);
        btn.style.animationDelay = `${-Math.random() * 3}s, ${-Math.random() * t}s`;
        btn.innerHTML = balloonSvg(COLOURS[(i + at) % COLOURS.length]) + "<span></span>";
        btn.querySelector("span").textContent = String(v);
        btn.setAttribute("aria-label", String(v));
        btn.addEventListener("click", () => pick(btn, v));
        return btn;
      }),
    );
  }

  function pick(btn, v) {
    if (btn.disabled || sky.classList.contains("done")) return;
    if (v === answer) {
      if (!tries) score++;
      f.score(score);
      btn.classList.add("popped");
      sky.classList.add("done");
      feedback.textContent = `🎉 Yes! ${sumEl.textContent.replace("?", answer)}`;
      feedback.className = "ey-feedback good";
      MT.sfx.good();
      MT.speak(`Yes! ${answer}!`);
      timer = setTimeout(() => {
        sky.classList.remove("done");
        at++;
        ask();
      }, 2600);
    } else {
      tries++;
      btn.disabled = true;
      btn.classList.add("popped");
      feedback.textContent = `Not ${v}. Count again!`;
      feedback.className = "ey-feedback bad";
      MT.sfx.bad();
    }
  }

  function start() {
    at = 0;
    score = 0;
    f.score(0);
    ask();
  }
  start();
  return () => clearTimeout(timer);
}
