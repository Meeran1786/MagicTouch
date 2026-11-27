// Building blocks shared by the early-years templates: the page frame with its top bar,
// soft background life and the end-of-round result card. Styles: templates/early.css.
import { MT } from "./kit.js";
import { emojiImg } from "/shared/studio/emoji.js";

const AMBIENT = ["--mt-amber", "--mt-magenta", "--mt-plum", "--mt-green", "--mt-orange"];

/**
 * Builds the frame inside `area`: top bar (icon, title, progress and score pills),
 * a stage for the activity and drifting background shapes.
 * @returns {{root: HTMLElement, stage: HTMLElement, progress(text: string): void, score(n: number): void}}
 */
export function frame(area, { icon, title }) {
  const root = document.createElement("div");
  root.className = "ey";
  const ambient = document.createElement("div");
  ambient.className = "ey-ambient";
  const shapes = MT.lowSpec() ? 2 : 5;
  for (let i = 0; i < shapes; i++) {
    const s = document.createElement("span");
    const size = 110 + ((i * 53) % 120);
    s.style.cssText = `width:${size}px;height:${size}px;left:${(i * 23 + 4) % 96}%;top:${(i * 37 + 8) % 88}%;background:var(${AMBIENT[i]});animation-delay:${-i * 2.7}s`;
    ambient.appendChild(s);
  }
  root.appendChild(ambient);

  const hud = document.createElement("div");
  hud.className = "ey-hud";
  const brand = document.createElement("div");
  brand.className = "ey-brand";
  if (icon) brand.appendChild(emojiImg(icon));
  brand.appendChild(document.createTextNode(title || ""));
  const pills = document.createElement("div");
  pills.className = "ey-pills";
  const progress = document.createElement("div");
  progress.className = "ey-pill";
  const score = document.createElement("div");
  score.className = "ey-pill score";
  pills.append(progress, score);
  hud.append(brand, pills);

  const stage = document.createElement("div");
  stage.className = "ey-stage";
  root.append(hud, stage);
  area.appendChild(root);
  progress.hidden = score.hidden = true;
  return {
    root,
    stage,
    progress(text) {
      progress.hidden = !text;
      progress.textContent = text || "";
    },
    score(n) {
      score.hidden = n === null || n === undefined;
      score.textContent = "⭐ " + n;
    },
  };
}

/** The result card: stars for the score, and Play again. */
export function result(root, { score, total, onAgain }) {
  const pct = total ? score / total : 0;
  const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1;
  const box = document.createElement("div");
  box.className = "ey-result";
  box.innerHTML =
    '<div class="ey-panel ey-result-card"><div class="big">🏆</div><h2></h2><p class="line"></p><div class="stars"></div>' +
    '<button class="ey-btn" type="button">Play again</button></div>';
  box.querySelector("h2").textContent = pct >= 0.6 ? "Great job!" : "Good try!";
  box.querySelector(".line").textContent = `You scored ${score} out of ${total}`;
  box.querySelector(".stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  box.querySelector("button").addEventListener("click", () => {
    box.remove();
    onAgain();
  });
  root.appendChild(box);
  MT.sfx.win();
  MT.confetti();
  MT.speak(`${pct >= 0.6 ? "Great job!" : "Good try!"} You scored ${score} out of ${total}.`);
}

/** Speaks a word for little ones: a little slower. */
export function say(word, lang) {
  MT.speak(word, lang);
}

const SHAPES = {
  circle: '<circle cx="50" cy="50" r="44"/>',
  square: '<rect x="8" y="8" width="84" height="84" rx="6"/>',
  rectangle: '<rect x="4" y="24" width="92" height="52" rx="6"/>',
  triangle: '<path d="M50 6 94 90H6Z"/>',
  star: '<path d="m50 4 13.5 29 31.5 3.6-23.4 21.4 6.6 31.2L50 73.4 21.8 89.2l6.6-31.2L5 36.6l31.5-3.6Z"/>',
  heart: '<path d="M50 90S6 62 6 32a21 21 0 0 1 44-9 21 21 0 0 1 44 9c0 30-44 58-44 58Z"/>',
  diamond: '<path d="M50 4 92 50 50 96 8 50Z"/>',
  oval: '<ellipse cx="50" cy="50" rx="46" ry="32"/>',
  hexagon: '<path d="M27 8h46l23 42-23 42H27L4 50Z"/>',
  pentagon: '<path d="M50 5 95 38 78 92H22L5 38Z"/>',
};

/** An SVG of a named shape filled with a colour (charts and shape games). */
export function shapeSvg(name, color) {
  const body = SHAPES[name] || SHAPES.circle;
  return `<svg class="ey-shape" viewBox="0 0 100 100" fill="${color}" aria-hidden="true">${body}</svg>`;
}

/** A picture for an item: {emoji} (one or a row of several), {swatch}, {shape, color}, {photo}. */
export function picture(item, base = "") {
  const box = document.createElement("span");
  box.className = "ey-pic";
  if (item.swatch) {
    box.innerHTML = `<span class="ey-swatch" style="background:${item.swatch}"></span>`;
  } else if (item.shape) {
    box.innerHTML = shapeSvg(item.shape, item.color || "var(--mt-plum)");
  } else if (item.photo) {
    const img = document.createElement("img");
    img.className = "ey-photo";
    img.src = base + item.photo;
    img.alt = item.word || "";
    img.draggable = false;
    box.appendChild(img);
  } else if (item.emoji) {
    const parts = Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(item.emoji), (s) => s.segment);
    if (parts.length > 1) box.classList.add("many");
    for (const e of parts) box.appendChild(emojiImg(e, item.word || ""));
  }
  return box;
}
