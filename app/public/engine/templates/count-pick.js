// Count and pick (early years): a tree full of one kind of fruit. Tap a fruit and it flies
// into the basket; the big counter goes up and says the number. When the tree is empty the
// total is read back and a new tree grows with another fruit and another count.
// Activity data:
//   fruits: [{ emoji: "🍎", one: "apple", many: "apples" }, ...]
//   count: [3, 10]   optional, the smallest and largest number of fruit on a tree
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { emojiImg } from "/shared/studio/emoji.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "count-pick"] };

// spots on the canopy (percent of the tree box), spread so fruit never overlap
const SPOTS = [
  [30, 22],
  [50, 14],
  [70, 22],
  [20, 38],
  [40, 32],
  [60, 32],
  [80, 38],
  [28, 52],
  [50, 46],
  [72, 52],
  [38, 62],
  [62, 62],
];
const TREE =
  '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<defs><radialGradient id="cp-leaf" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#5fcf8f"/>' +
  '<stop offset="1" stop-color="#2FA86A"/></radialGradient>' +
  '<linearGradient id="cp-bark" x1="0" x2="1"><stop offset="0" stop-color="#8B5E3C"/><stop offset="1" stop-color="#6b4429"/></linearGradient></defs>' +
  '<ellipse cx="50" cy="97" rx="30" ry="2.5" fill="rgba(61,14,55,.12)"/>' +
  '<path d="M44 96 46 66 38 56 43 54 48 62 50 50 53 62 60 54 63 57 54 66 56 96Z" fill="url(#cp-bark)"/>' +
  '<g fill="url(#cp-leaf)"><circle cx="50" cy="30" r="24"/><circle cx="28" cy="42" r="18"/><circle cx="72" cy="42" r="18"/>' +
  '<circle cx="38" cy="58" r="15"/><circle cx="62" cy="58" r="15"/><circle cx="50" cy="48" r="20"/></g></svg>';

export default function countPick(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const panel = document.createElement("div");
  panel.className = "cp";
  panel.innerHTML =
    `<div class="cp-tree">${TREE}<div class="cp-fruit"></div></div>` +
    '<div class="ey-panel cp-side"><div class="cp-count">0</div><div class="cp-word"></div>' +
    '<div class="cp-basket"><span class="cp-in"></span><span class="cp-weave"></span></div></div>';
  f.stage.appendChild(panel);
  const fruitBox = panel.querySelector(".cp-fruit");
  const countEl = panel.querySelector(".cp-count");
  const wordEl = panel.querySelector(".cp-word");
  const basket = panel.querySelector(".cp-basket");
  const inside = panel.querySelector(".cp-in");
  const [lo, hi] = d.count || [3, 10];
  let fruit = null;
  let total = 0;
  let picked = 0;
  let trees = 0;
  let timer = 0;

  function grow() {
    const pool = d.fruits.filter((x) => x !== fruit);
    fruit = pool[Math.floor(Math.random() * pool.length)] || d.fruits[0];
    total = lo + Math.floor(Math.random() * (Math.min(hi, SPOTS.length) - lo + 1));
    picked = 0;
    countEl.textContent = "0";
    wordEl.textContent = `Pick the ${fruit.many}!`;
    inside.replaceChildren();
    fruitBox.replaceChildren();
    for (const [x, y] of MT.shuffle(SPOTS).slice(0, total)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cp-one";
      b.style.left = x + "%";
      b.style.top = y + "%";
      b.style.animationDelay = Math.random() * 0.4 + "s";
      b.setAttribute("aria-label", fruit.one);
      b.appendChild(emojiImg(fruit.emoji, fruit.one));
      b.addEventListener("click", () => pick(b));
      fruitBox.appendChild(b);
    }
    MT.speak(`Let's count the ${fruit.many}!`);
  }

  function pick(b) {
    if (b.disabled) return;
    b.disabled = true;
    picked++;
    const from = b.getBoundingClientRect();
    const to = basket.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height * 0.35 - (from.top + from.height / 2);
    const fly = b.animate(
      [
        { transform: "translate(-50%,-50%)" },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)` },
      ],
      { duration: MT.calm() ? 1 : 550, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" },
    );
    fly.onfinish = () => {
      b.remove();
      const e = emojiImg(fruit.emoji, "");
      inside.appendChild(e);
    };
    countEl.textContent = String(picked);
    countEl.classList.remove("bump");
    void countEl.offsetWidth;
    countEl.classList.add("bump");
    MT.sfx.tap();
    MT.speak(String(picked));
    if (picked === total) {
      trees++;
      f.score(trees);
      const line = `You picked ${total} ${total === 1 ? fruit.one : fruit.many}!`;
      wordEl.textContent = line;
      timer = setTimeout(() => {
        MT.sfx.win();
        MT.confetti();
        MT.speak(line);
        timer = setTimeout(grow, 3200);
      }, 700);
    }
  }

  f.score(0);
  grow();
  return () => clearTimeout(timer);
}
