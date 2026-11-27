// Picture reveal (early years): a grey picture floods into colour from the spot the child
// taps, then its word is spelled letter by letter and said. Back and Next move through the set.
// Activity data:
//   items: [{ word: "Apple", photo: "assets/photos/apple.jpg" }]  or emoji, number, swatch, shape
//   cover: "assets/A.png"   optional per item, shown in place of the grey picture (a letter card)
//   audio: "assets/apple.mp3" optional per item, played instead of spelling the word
//   media: optional { type: "mp4", src } per item, played in place of the photo once revealed
import { MT } from "../js/kit.js";
import { frame, picture, spell } from "../js/early.js";

export const meta = { fullscreen: true, styles: ["early", "picture-reveal"] };

export default function pictureReveal(area, d, ctx) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const panel = document.createElement("div");
  panel.className = "ey-panel pr";
  panel.innerHTML =
    '<button class="pr-card" type="button" aria-label="Show the colour picture">' +
    '<span class="pr-layer pr-grey"></span><span class="pr-layer pr-colour"></span>' +
    '<span class="pr-hint">👆 Tap me to bring me to life!</span></button>' +
    '<div class="pr-side"><div class="pr-tiles" aria-live="polite"></div>' +
    '<div class="pr-actions">' +
    '<button class="ey-btn alt pr-prev" type="button">← Back</button>' +
    '<button class="ey-btn alt pr-hear" type="button">🔊 Hear it</button>' +
    '<button class="ey-btn pr-next" type="button">Next →</button></div></div>';
  f.stage.appendChild(panel);
  const card = panel.querySelector(".pr-card");
  const grey = panel.querySelector(".pr-grey");
  const colour = panel.querySelector(".pr-colour");
  const tiles = panel.querySelector(".pr-tiles");
  const hear = panel.querySelector(".pr-hear");
  const items = d.items;
  let at = 0;
  let shown = false;
  let stopSpeech = () => {};

  function show(i) {
    at = (i + items.length) % items.length;
    shown = false;
    stopSpeech();
    const item = items[at];
    f.progress(`${at + 1} / ${items.length}`);
    grey.replaceChildren(picture(item.cover ? { photo: item.cover, word: item.word } : item, ctx.base));
    grey.classList.toggle("cover", !!item.cover);
    colour.replaceChildren(colourPicture(item));
    card.classList.remove("is-shown");
    card.setAttribute("aria-label", "Show the colour picture");
    tiles.replaceChildren();
    hear.disabled = true;
  }

  function colourPicture(item) {
    const m = item.media;
    if (m && (m.type === "mp4" || m.type === "webm")) {
      const v = document.createElement("video");
      v.className = "ey-photo";
      v.src = ctx.base + m.src;
      v.muted = v.loop = v.playsInline = true;
      v.preload = "metadata";
      return v;
    }
    return picture(item, ctx.base);
  }

  function reveal(x, y) {
    if (shown) return;
    shown = true;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${x ? x - r.left : r.width / 2}px`);
    card.style.setProperty("--y", `${y ? y - r.top : r.height / 2}px`);
    card.classList.add("is-shown", "ey-tap");
    setTimeout(() => card.classList.remove("ey-tap"), 450);
    card.setAttribute("aria-label", items[at].word);
    const video = colour.querySelector("video");
    if (video) video.play().catch(() => {});
    MT.sfx.good();
    buildTiles(items[at].word);
    hear.disabled = false;
    say();
  }

  function buildTiles(word) {
    tiles.replaceChildren(
      ...[...word].map((ch, i) => {
        const t = document.createElement("span");
        t.className = ch.trim() ? "pr-tile" : "pr-tile gap";
        t.textContent = ch;
        t.style.animationDelay = `${i * 60}ms`;
        return t;
      }),
    );
  }

  function say() {
    const all = [...tiles.children];
    const file = items[at].audio;
    if (file) {
      stopSpeech();
      const sound = new Audio(ctx.base + file);
      all.forEach((t) => t.classList.add("on"));
      sound.play().catch(() => {});
      stopSpeech = () => sound.pause();
      return;
    }
    stopSpeech = spell(items[at].word, (i) => {
      all.forEach((t, k) => t.classList.toggle("on", k === i || i < 0));
    });
  }

  card.addEventListener("click", (e) => reveal(e.clientX, e.clientY));
  hear.addEventListener("click", () => shown && say());
  panel.querySelector(".pr-prev").addEventListener("click", () => show(at - 1));
  panel.querySelector(".pr-next").addEventListener("click", () => show(at + 1));

  // Pause a playing loop while the wall is hidden (design system: no hidden playback).
  const onVisible = () => {
    const v = colour.querySelector("video");
    if (v && shown) document.hidden ? v.pause() : v.play().catch(() => {});
  };
  document.addEventListener("visibilitychange", onVisible);

  show(0);
  return () => {
    stopSpeech();
    document.removeEventListener("visibilitychange", onVisible);
  };
}
