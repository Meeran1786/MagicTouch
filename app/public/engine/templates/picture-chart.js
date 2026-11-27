// Picture chart (early years): a wall chart of cards; touch one to see it big and hear it.
// Gold Standard layout (studioFrame): the chart stands on the living stage on the left; the chosen
// card grows big on the right in the same frame, with its word in letter tiles.
// Activity data:
//   items: [{ word: "Lion", emoji: "🦁" }]  a picture per card: emoji (or a row "🍎🍎"),
//          swatch: "#E63946", shape: "star" + color, or photo: "images/x.jpg";
//          glyph: "A" adds a big letter or number above the word; say: "A for Apple" is spoken
//          instead of the word; media?: { type: "mp4", src } plays in the big view
import { MT } from "../js/kit.js";
import { studioFrame, picture, sayWord } from "../js/early.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "picture-chart"] };

const COLOURS = ["--mt-magenta", "--mt-orange", "--mt-amber", "--mt-green", "--mt-plum"];
const HEX = [ME.PALETTE.magenta, ME.PALETTE.orange, ME.PALETTE.amber, ME.PALETTE.green, ME.PALETTE.plum];

export default function pictureChart(area, d, ctx) {
  const f = studioFrame(area, { icon: d.icon, title: d.title, grass: false });
  const grid = document.createElement("div");
  grid.className = "pc-grid";
  f.stage.appendChild(grid);
  const show = document.createElement("div");
  show.className = "st-card pc-show";
  show.innerHTML = '<p class="pc-hint">👈 Touch a card!</p>';
  f.panel.appendChild(show);
  f.goal("Touch a card to see it big and hear it.");
  const cols = Math.ceil(Math.sqrt(d.items.length * 1.1));
  grid.style.setProperty("--cols", String(cols));
  const seen = new Set();
  let finished = false;
  f.progress(0, d.items.length, "Cards seen");

  d.items.forEach((item, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "pc-card st-pick";
    card.style.setProperty("--c", `var(${COLOURS[i % COLOURS.length]})`);
    card.style.animationDelay = `${Math.min(i, 30) * 25}ms`;
    card.appendChild(picture({ ...item, media: undefined }, ctx.base));
    if (item.glyph) card.insertAdjacentHTML("beforeend", '<span class="pc-glyph"></span>');
    card.insertAdjacentHTML("beforeend", '<span class="pc-word"></span>');
    if (item.glyph) card.querySelector(".pc-glyph").textContent = item.glyph;
    card.querySelector(".pc-word").textContent = item.word;
    card.addEventListener("click", (e) => select(i, card, e));
    grid.appendChild(card);
  });

  function select(i, card, e) {
    const item = d.items[i];
    const hex = HEX[i % HEX.length];
    grid.querySelectorAll(".pc-card").forEach((c) => c.classList.toggle("on", c === card));
    ME.squash(card);
    ME.flood(card, e.clientX, e.clientY, { color: hex });
    seen.add(i);
    f.progress(seen.size, d.items.length, "Cards seen");
    show.style.setProperty("--c", `var(${COLOURS[i % COLOURS.length]})`);
    show.replaceChildren();
    const big = picture(item, ctx.base);
    big.classList.add("pc-big", "st-hero");
    show.appendChild(big);
    if (item.glyph) show.insertAdjacentHTML("beforeend", '<div class="pc-glyph-big"></div>');
    if (item.glyph) show.querySelector(".pc-glyph-big").textContent = item.glyph;
    const word = document.createElement("div");
    word.className = "pc-word-big";
    show.appendChild(word);
    const tiles = ME.tiles(word, item.word.toUpperCase());
    show.insertAdjacentHTML("beforeend", '<div class="pc-again">🔊 touch the card again to hear it</div>');
    ME.ripple(show, null, null, hex);
    ME.sound.tap();
    if (item.say) MT.speak(item.say);
    else sayWord(item.word, tiles);
    if (seen.size === d.items.length && !finished) {
      finished = true;
      f.say("🎉 You looked at every card!", "good");
      f.solved();
      f.celebrate(show);
      ME.sound.win();
    }
  }
  return () => f.stop();
}
