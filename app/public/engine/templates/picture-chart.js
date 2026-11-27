// Picture chart (early years): a wall chart of cards; touch one to see it big and hear it.
// Activity data:
//   items: [{ word: "Lion", emoji: "🦁" }]  a picture per card: emoji (or a row "🍎🍎"),
//          swatch: "#E63946", shape: "star" + color, or photo: "images/x.jpg";
//          glyph: "A" adds a big letter or number above the word; say: "A for Apple" is spoken
//          instead of the word
import { MT } from "../js/kit.js";
import { frame, picture } from "../js/early.js";

export const meta = { fullscreen: true, styles: ["early", "picture-chart"] };

const COLOURS = ["--mt-magenta", "--mt-orange", "--mt-amber", "--mt-green", "--mt-plum"];

export default function pictureChart(area, d, ctx) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const body = document.createElement("div");
  body.className = "pc-body";
  body.innerHTML = '<div class="pc-grid"></div><div class="ey-panel pc-show"><p class="pc-hint">Touch a card!</p></div>';
  f.stage.appendChild(body);
  const grid = body.querySelector(".pc-grid");
  const show = body.querySelector(".pc-show");
  const cols = Math.ceil(Math.sqrt(d.items.length * 1.4));
  grid.style.setProperty("--cols", String(cols));

  d.items.forEach((item, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "pc-card";
    card.style.setProperty("--c", `var(${COLOURS[i % COLOURS.length]})`);
    card.appendChild(picture(item, ctx.base));
    if (item.glyph) card.insertAdjacentHTML("beforeend", '<span class="pc-glyph"></span>');
    card.insertAdjacentHTML("beforeend", '<span class="pc-word"></span>');
    if (item.glyph) card.querySelector(".pc-glyph").textContent = item.glyph;
    card.querySelector(".pc-word").textContent = item.word;
    card.addEventListener("click", () => select(i, card));
    grid.appendChild(card);
  });

  function select(i, card) {
    const item = d.items[i];
    grid.querySelectorAll(".pc-card").forEach((c) => c.classList.toggle("on", c === card));
    card.classList.remove("ey-tap");
    void card.offsetWidth;
    card.classList.add("ey-tap");
    show.style.setProperty("--c", `var(${COLOURS[i % COLOURS.length]})`);
    show.innerHTML = '<div class="pc-rings"></div>';
    const big = picture(item, ctx.base);
    big.classList.add("pc-big");
    show.appendChild(big);
    if (item.glyph) show.insertAdjacentHTML("beforeend", '<div class="pc-glyph-big"></div>');
    show.insertAdjacentHTML("beforeend", '<div class="pc-word-big"></div><div class="pc-again">🔊 touch again to hear it</div>');
    if (item.glyph) show.querySelector(".pc-glyph-big").textContent = item.glyph;
    show.querySelector(".pc-word-big").textContent = item.word;
    MT.sfx.tap();
    MT.speak(item.say || item.word);
  }
}
