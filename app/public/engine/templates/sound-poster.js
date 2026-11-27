// Sound poster (early years): a grey poster of things that make sounds. Touch one and it
// lights up in colour and plays; a hand only needs to point at it, no tap needed.
// Gold Standard frame (studioFrame, stage only): the poster fills the elevated stage; a touched
// spot floods into colour with a squash and a ring that spreads from the touch.
// Activity data:
//   poster: "assets/poster.jpg", size: [1400, 700]       the background and its pixel size
//   spots: [{ word: "Drum", layer: "assets/drum.png", box: [x, y, w, h], sound: "assets/drum.wav" }]
//          or sfx: "drum" instead of sound: a theme sound from /assets/sfx/themes/
//          box is where the colour picture sits on the poster, in poster pixels
import { MT } from "../js/kit.js";
import { studioFrame } from "../js/early.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, styles: ["early", "sound-poster"], points: 2 };

const REPLAY_MS = 900; // the same spot will not restart its sound sooner than this

export default function soundPoster(area, d, ctx) {
  const f = studioFrame(area, { icon: d.icon, title: d.title, split: false, grass: false, stars: false });
  const [pw, ph] = d.size;
  const poster = document.createElement("div");
  poster.className = "sp";
  poster.style.aspectRatio = `${pw} / ${ph}`;
  poster.innerHTML = '<img class="sp-bg" alt="" draggable="false">';
  poster.querySelector("img").src = ctx.base + d.poster;
  f.stage.appendChild(poster);
  const last = new Map();
  const spots = d.spots.map((s) => {
    const [x, y, w, h] = s.box;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sp-spot";
    el.setAttribute("aria-label", s.word);
    el.style.cssText = `left:${(x / pw) * 100}%;top:${(y / ph) * 100}%;width:${(w / pw) * 100}%;height:${(h / ph) * 100}%`;
    el.innerHTML = '<img alt="" draggable="false"><span class="sp-word"></span>';
    el.querySelector("img").src = ctx.base + s.layer;
    el.querySelector(".sp-word").textContent = s.word;
    poster.appendChild(el);
    const play = (e) => {
      const now = performance.now();
      if (now - (last.get(el) || 0) < REPLAY_MS) return;
      last.set(el, now);
      el.classList.add("on");
      ME.squash(el);
      ME.ripple(poster, e && e.clientX, e && e.clientY, ME.PALETTE.amber);
      // the spot's own recording, or a theme sound by name ("sfx": "drum"), through MagicAudio
      // (so it follows the one global mute); with neither, the word is spoken
      const snd = s.sound ? MT.sound(ctx.base + s.sound, { volume: 1 }) : s.sfx ? MT.theme(s.sfx) : null;
      if (!snd) MT.speak(s.word);
      clearTimeout(el.offTimer);
      el.offTimer = setTimeout(() => el.classList.remove("on"), 1600);
    };
    // a press plays it; a pointer moving onto it plays it too (hands hover, like the poster it came from)
    el.addEventListener("pointerdown", play);
    el.addEventListener("pointermove", play);
    return el;
  });

  return () => {
    spots.forEach((el) => clearTimeout(el.offTimer));
    f.stop();
  };
}
