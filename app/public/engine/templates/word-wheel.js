// Word wheel (early years): one picture and its word in three languages. Touch a language to
// hear the word; Back and Next move through the pictures.
// Gold Standard layout (studioFrame): the picture stands on the living stage on the left and rings
// out in the language's colour when it is spoken; the language cards are on the right.
// Activity data:
//   items: [{ word: "Rhino", photo: "images/rhino.jpg", media?: { type: "mp4", src },
//             says: [{ lang: "English", text: "Rhino", code: "en-IN" },
//                    { lang: "Hindi", text: "गैंडा", code: "hi-IN", audio: "audio/rhino_hi.mp3" }, ...] }]
//   A recorded "audio" file is used when there is one; otherwise MagicAudio speaks it in "code"
//   (a pre-generated clip, or the best offline voice).
import { MT } from "../js/kit.js";
import { studioFrame, studioButton, picture } from "../js/early.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, styles: ["early", "word-wheel"] };

const RING = ["--mt-plum", "--mt-orange", "--mt-green", "--mt-magenta"];
const RING_HEX = [ME.PALETTE.plum, ME.PALETTE.orange, ME.PALETTE.green, ME.PALETTE.magenta];

export default function wordWheel(area, d, ctx) {
  const f = studioFrame(area, { icon: d.icon, title: d.title });
  const hub = document.createElement("div");
  hub.className = "ww-hub";
  hub.innerHTML = '<div class="ww-name"></div><div class="ww-centre st-hero"></div>';
  f.stage.appendChild(hub);
  const name = hub.querySelector(".ww-name");
  const centre = hub.querySelector(".ww-centre");
  const langs = document.createElement("div");
  langs.className = "ww-langs";
  const nav = document.createElement("div");
  nav.className = "ww-nav";
  nav.append(
    studioButton("← Back", true, () => {
      ME.sound.tap();
      show(at - 1);
    }),
    studioButton("Next →", false, () => {
      ME.sound.tap();
      show(at + 1);
    }),
  );
  f.panel.append(langs, nav);
  let at = 0;

  function show(i) {
    at = (i + d.items.length) % d.items.length;
    const item = d.items[at];
    f.progress(at + 1, d.items.length, "Picture");
    f.goal("🔊 Touch a language to hear the word.");
    f.say("");
    ME.tiles(name, item.word.toUpperCase());
    centre.replaceChildren(picture(item, ctx.base));
    centre.classList.remove("ww-in");
    void centre.offsetWidth;
    centre.classList.add("ww-in");
    langs.replaceChildren();
    item.says.forEach((s, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ww-lang st-pick";
      b.style.setProperty("--c", `var(${RING[k % RING.length]})`);
      b.innerHTML = '<span class="ww-lang-name"></span><span class="ww-text"></span><span class="ww-play">🔊</span>';
      b.querySelector(".ww-lang-name").textContent = s.lang;
      b.querySelector(".ww-text").textContent = s.text;
      b.lang = (s.code || "").split("-")[0] || "en";
      b.style.animationDelay = `${k * 80}ms`;
      b.addEventListener("click", (e) => say(s, b, k, e));
      langs.appendChild(b);
    });
  }

  function say(s, button, k, e) {
    langs.querySelectorAll(".ww-lang").forEach((x) => x.classList.toggle("on", x === button));
    ME.squash(button);
    ME.flood(button, e.clientX, e.clientY, { color: RING_HEX[k % RING_HEX.length] });
    ME.squash(centre);
    ME.ripple(f.stage, null, null, RING_HEX[k % RING_HEX.length]);
    f.say(`${s.lang}: ${s.text}`);
    ME.sound.pop();
    MT.speak({ text: s.text, lang: s.code, src: s.audio ? ctx.base + s.audio : undefined });
  }

  show(0);
  return () => {
    MT.stopSpeech();
    f.stop();
  };
}
