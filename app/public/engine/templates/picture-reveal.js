// Picture reveal (early years): a grey picture floods into colour from the spot the child
// taps, then its word is spelled letter by letter and said. Back and Next move through the set.
// Gold Standard layout (studioFrame): the picture fills the living stage on the left; the letter
// tiles (voice-synced), Back / Hear / Next and the card read-out are on the right.
// Activity data:
//   items: [{ word: "Apple", photo: "assets/photos/apple.jpg" }]  or emoji, number, swatch, shape
//   cover: "assets/A.png"   optional per item, shown in place of the grey picture (a letter card)
//   audio: "assets/apple.mp3" optional per item, played instead of spelling the word
//   media: optional { type: "mp4" | "webm" | "lottie" | "rive", src } per item, played in place of
//          the colour picture once revealed (the code picture stays if the file is missing)
import { studioFrame, studioButton, picture, spell } from "../js/early.js";
import { mountMedia } from "../js/media.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "picture-reveal"] };

export default function pictureReveal(area, d, ctx) {
  const f = studioFrame(area, { icon: d.icon, title: d.title, stars: true, grass: false });
  const card = document.createElement("button");
  card.type = "button";
  card.className = "pr-card";
  card.innerHTML =
    '<span class="pr-layer pr-grey"></span><span class="pr-layer pr-colour"></span>' +
    '<span class="pr-hint">👆 Tap me to bring me to life!</span>';
  f.stage.appendChild(card);
  const grey = card.querySelector(".pr-grey");
  const colour = card.querySelector(".pr-colour");
  const side = document.createElement("div");
  side.className = "st-card pr-side";
  side.innerHTML = '<div class="pr-tiles" aria-live="polite"></div><div class="pr-actions"></div>';
  f.panel.appendChild(side);
  const tilesBox = side.querySelector(".pr-tiles");
  const hear = studioButton("🔊 Hear it", true, () => shown && say());
  side.querySelector(".pr-actions").append(
    studioButton("← Back", true, () => show(at - 1)),
    hear,
    studioButton("Next →", false, () => show(at + 1)),
  );
  const items = d.items;
  let at = 0;
  let shown = false;
  let tiles = null;
  let media = null;
  let stopSpeech = () => {};

  function show(i) {
    at = (i + items.length) % items.length;
    shown = false;
    stopSpeech();
    if (media) media.stop();
    media = null;
    const item = items[at];
    f.progress(at + 1, items.length, "Card");
    f.goal("Touch the picture to bring it to life!");
    f.say("");
    grey.replaceChildren(picture(item.cover ? { photo: item.cover, word: item.word } : item, ctx.base));
    grey.classList.toggle("cover", !!item.cover);
    colour.replaceChildren(picture(item, ctx.base));
    card.classList.remove("is-shown");
    card.setAttribute("aria-label", "Show the colour picture");
    tilesBox.replaceChildren();
    tiles = null;
    hear.disabled = true;
    grey.animate &&
      !ME.calm() &&
      grey.animate(
        [
          { transform: "scale(0.85)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        {
          duration: 450,
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        },
      );
  }

  function reveal(x, y) {
    if (shown) return;
    shown = true;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${x ? x - r.left : r.width / 2}px`);
    card.style.setProperty("--y", `${y ? y - r.top : r.height / 2}px`);
    card.classList.add("is-shown");
    ME.squash(card);
    ME.ripple(card, x, y, ME.PALETTE.amber);
    card.setAttribute("aria-label", items[at].word);
    const item = items[at];
    if (item.media) {
      const was = at;
      mountMedia(colour, item.media, ctx.base).then((m) => {
        if (!m) return;
        if (was !== at || !shown) return m.stop();
        [...colour.children].forEach((c) => c !== m.el && c.remove());
        media = m;
      });
    }
    ME.sound.good();
    tiles = ME.tiles(tilesBox, item.word);
    hear.disabled = false;
    f.say(`✨ ${item.word}!`, "good");
    f.goal("Listen to each letter, then say the word!");
    f.solved();
    say();
  }

  function say() {
    const file = items[at].audio;
    stopSpeech();
    if (file) {
      const sound = new Audio(ctx.base + file);
      tiles.light(-1);
      sound.play().catch(() => {});
      stopSpeech = () => sound.pause();
      return;
    }
    stopSpeech = spell(items[at].word, (i) => tiles && tiles.light(i));
  }

  card.addEventListener("click", (e) => reveal(e.clientX, e.clientY));

  show(0);
  return () => {
    stopSpeech();
    if (media) media.stop();
    f.stop();
  };
}
