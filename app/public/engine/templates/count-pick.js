// Count and pick (early years): a tree full of one kind of fruit. Tap a fruit and it flies
// into the basket; the big counter rolls up and says the number. When the tree is empty the
// total is read back and a new tree grows with another fruit and another count.
// Gold Standard layout (studioFrame): the tree stands on the living stage on the left; the fruit
// flies across into the basket on the right, and the counter rolls in the same frame.
// Activity data:
//   fruits: [{ emoji: "🍎", one: "apple", many: "apples" }, ...]
//   count: [3, 10]   optional, the smallest and largest number of fruit on a tree
import { MT } from "../js/kit.js";
import { studioFrame } from "../js/early.js";
import { emojiImg } from "/shared/studio/emoji.js";
import { ME } from "/shared/motion-engine.js";

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
// a lit tree: light from the top left, a darker underside on every leaf cluster, a soft ground shadow
const TREE =
  '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<defs><radialGradient id="cp-leaf" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#7ddba3"/>' +
  '<stop offset=".55" stop-color="#3fb878"/><stop offset="1" stop-color="#258a56"/></radialGradient>' +
  '<radialGradient id="cp-shade" cx="50%" cy="20%" r="80%"><stop offset=".6" stop-color="#000" stop-opacity="0"/>' +
  '<stop offset="1" stop-color="#1b5e3b" stop-opacity=".22"/></radialGradient>' +
  '<linearGradient id="cp-bark" x1="0" x2="1"><stop offset="0" stop-color="#9a6a45"/><stop offset=".6" stop-color="#7a4f31"/>' +
  '<stop offset="1" stop-color="#5e3b23"/></linearGradient>' +
  '<radialGradient id="cp-ground" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3d0e37" stop-opacity=".25"/>' +
  '<stop offset="1" stop-color="#3d0e37" stop-opacity="0"/></radialGradient></defs>' +
  '<ellipse cx="50" cy="97" rx="34" ry="3.2" fill="url(#cp-ground)"/>' +
  '<path d="M44 96 46 66 38 56 43 54 48 62 50 50 53 62 60 54 63 57 54 66 56 96Z" fill="url(#cp-bark)"/>' +
  '<g class="cp-canopy"><g fill="url(#cp-leaf)"><circle cx="50" cy="30" r="24"/><circle cx="28" cy="42" r="18"/><circle cx="72" cy="42" r="18"/>' +
  '<circle cx="38" cy="58" r="15"/><circle cx="62" cy="58" r="15"/><circle cx="50" cy="48" r="20"/></g>' +
  '<g fill="url(#cp-shade)"><circle cx="28" cy="42" r="18"/><circle cx="72" cy="42" r="18"/>' +
  '<circle cx="38" cy="58" r="15"/><circle cx="62" cy="58" r="15"/></g>' +
  '<g fill="#fff" opacity=".22"><ellipse cx="42" cy="18" rx="8" ry="4"/><ellipse cx="22" cy="34" rx="5" ry="2.5"/></g></g></svg>';

export default function countPick(area, d) {
  const f = studioFrame(area, { icon: d.icon, title: d.title });
  const tree = document.createElement("div");
  tree.className = "cp-tree";
  tree.innerHTML = `${TREE}<div class="cp-fruit"></div>`;
  f.stage.appendChild(tree);
  const side = document.createElement("div");
  side.className = "st-card cp-side";
  side.innerHTML =
    '<div class="cp-count">0</div><div class="cp-word"></div>' +
    '<div class="cp-basket"><span class="cp-in"></span><span class="cp-weave"></span></div>';
  f.panel.appendChild(side);
  const fruitBox = tree.querySelector(".cp-fruit");
  const countEl = side.querySelector(".cp-count");
  const wordEl = side.querySelector(".cp-word");
  const basket = side.querySelector(".cp-basket");
  const inside = side.querySelector(".cp-in");
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
    countEl._rollV = 0;
    countEl.textContent = "0";
    f.goal(`Pick the ${fruit.many} and count them!`);
    f.say("");
    wordEl.textContent = `0 ${fruit.many}`;
    inside.replaceChildren();
    fruitBox.replaceChildren();
    for (const [x, y] of MT.shuffle(SPOTS).slice(0, total)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cp-one";
      b.style.left = x + "%";
      b.style.top = y + "%";
      b.style.animationDelay = `${Math.random() * 0.4}s, ${-Math.random() * 3}s`;
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
    // an arc: up first, then down into the basket
    const fly = b.animate(
      [
        { transform: "translate(-50%,-50%) scale(1)" },
        {
          transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 120}px)) scale(1.15)`,
          offset: 0.45,
        },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)` },
      ],
      { duration: MT.calm() ? 1 : 650, easing: "ease-in-out", fill: "forwards" },
    );
    fly.onfinish = () => {
      b.remove();
      inside.appendChild(emojiImg(fruit.emoji, ""));
      ME.squash(basket);
    };
    ME.roll(countEl, picked);
    ME.squash(countEl);
    wordEl.textContent = `${picked} ${picked === 1 ? fruit.one : fruit.many}`;
    ME.sound.tap();
    MT.speak(String(picked));
    if (picked === total) {
      trees++;
      const line = `You picked ${total} ${total === 1 ? fruit.one : fruit.many}!`;
      timer = setTimeout(() => {
        f.score(trees);
        f.say(`🎉 ${line}`, "good");
        f.solved();
        f.celebrate(side);
        ME.sound.win();
        MT.speak(line);
        timer = setTimeout(grow, 3200);
      }, 700);
    }
  }

  f.score(0);
  grow();
  return () => {
    clearTimeout(timer);
    f.stop();
  };
}
