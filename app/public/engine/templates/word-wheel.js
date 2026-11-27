// Word wheel (early years): one picture in the middle and its word in three languages
// around it. Touch a language to hear the word; Back and Next move through the pictures.
// Activity data:
//   items: [{ word: "Rhino", photo: "images/rhino.jpg",
//             says: [{ lang: "English", text: "Rhino", code: "en-IN" },
//                    { lang: "Hindi", text: "गैंडा", code: "hi-IN", audio: "audio/rhino_hi.mp3" }, ...] }]
//   A recorded "audio" file is used when there is one; otherwise the browser's voice for "code".
import { MT } from "../js/kit.js";
import { frame, picture } from "../js/early.js";

export const meta = { fullscreen: true, styles: ["early", "word-wheel"] };

const RING = ["--mt-plum", "--mt-orange", "--mt-green", "--mt-magenta"];

export default function wordWheel(area, d, ctx) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const wheel = document.createElement("div");
  wheel.className = "ww";
  wheel.innerHTML =
    '<button class="ey-btn alt ww-nav ww-prev" type="button">← Back</button>' +
    '<div class="ww-hub"><div class="ww-name"></div><div class="ww-centre"></div>' +
    '<svg class="ww-lines" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true"></svg><div class="ww-langs"></div></div>' +
    '<button class="ey-btn ww-nav ww-next" type="button">Next →</button>' +
    '<p class="ww-tip">🔊 Touch a language to hear it spoken</p>';
  f.stage.appendChild(wheel);
  const name = wheel.querySelector(".ww-name");
  const centre = wheel.querySelector(".ww-centre");
  const langs = wheel.querySelector(".ww-langs");
  const lines = wheel.querySelector(".ww-lines");
  let at = 0;
  let audio = null;

  function show(i) {
    at = (i + d.items.length) % d.items.length;
    const item = d.items[at];
    f.progress(`${at + 1} / ${d.items.length}`);
    name.textContent = item.word;
    centre.innerHTML = "";
    centre.appendChild(picture(item, ctx.base));
    centre.classList.remove("ww-in");
    void centre.offsetWidth;
    centre.classList.add("ww-in");
    langs.innerHTML = "";
    const n = item.says.length;
    lines.innerHTML = item.says
      .map(
        (_, k) =>
          `<line x1="300" y1="0" x2="${((k + 0.5) / n) * 600}" y2="200" style="stroke:var(${RING[k % RING.length]})"/>`,
      )
      .join("");
    item.says.forEach((s, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ww-lang";
      b.style.setProperty("--c", `var(${RING[k % RING.length]})`);
      b.innerHTML = '<span class="ww-lang-name"></span><span class="ww-text"></span>';
      b.querySelector(".ww-lang-name").textContent = s.lang;
      b.querySelector(".ww-text").textContent = s.text;
      b.lang = (s.code || "").split("-")[0] || "en";
      b.addEventListener("click", () => say(s, b));
      langs.appendChild(b);
    });
  }

  function say(s, button) {
    langs.querySelectorAll(".ww-lang").forEach((x) => x.classList.toggle("on", x === button));
    button.classList.remove("ey-tap");
    void button.offsetWidth;
    button.classList.add("ey-tap");
    if (audio) audio.pause();
    if (s.audio) {
      audio = new Audio(ctx.base + s.audio);
      audio.play().catch(() => MT.speak(s.text, s.code));
    } else MT.speak(s.text, s.code);
  }

  wheel.querySelector(".ww-prev").addEventListener("click", () => {
    MT.sfx.tap();
    show(at - 1);
  });
  wheel.querySelector(".ww-next").addEventListener("click", () => {
    MT.sfx.tap();
    show(at + 1);
  });
  show(0);
  return () => audio && audio.pause();
}
