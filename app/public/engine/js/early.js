// Building blocks shared by the early-years templates: the page frame with its top bar,
// soft background life and the end-of-round result card. Styles: templates/early.css.
//
// The Gold Standard frame for picture activities is studioFrame() + studioResult() (bottom of this
// file): the split screen of the reference page (/engine/templates/reference-ohms-law.html) with a
// living stage on the left and the question, answers and rolling read-outs on the right. Its motion
// comes from /shared/motion-engine.js (ME) and its look from /shared/studio-base.css.
import { MT } from "./kit.js";
import { ME } from "/shared/motion-engine.js";
import { mountMedia } from "./media.js";
import { emojiImg } from "/shared/studio/emoji.js";
import { musicWanted, setMusicWanted } from "/shared/studio/music.js";

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
  if (document.documentElement.dataset.music) {
    const tune = document.createElement("button");
    tune.type = "button";
    tune.className = "ey-pill ey-music";
    const draw = () => {
      tune.textContent = musicWanted() ? "🎵 Music" : "🔇 Music";
      tune.setAttribute("aria-pressed", String(musicWanted()));
    };
    tune.addEventListener("click", () => {
      setMusicWanted(!musicWanted());
      draw();
    });
    draw();
    pills.append(tune);
  }
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
  MT.speak([pct >= 0.6 ? "Great job!" : "Good try!", "You scored", score, "out of", total]);
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

// media loops mounted by picture(); stopped once their picture has left the page
const live = new Set();
function sweepMedia(all) {
  for (const m of live) {
    if (all || !m.el.isConnected) {
      m.stop();
      live.delete(m);
    }
  }
}

/**
 * A picture for an item: {emoji} (one or a row of several), {swatch}, {shape, color}, {photo}, {number}.
 * With item.media ({type: "mp4" | "webm" | "lottie" | "rive", src}) the local loop replaces the picture
 * once it has loaded; without it, or if the file is missing, the code-drawn picture stays.
 */
export function picture(item, base = "") {
  const box = document.createElement("span");
  box.className = "ey-pic";
  if (item.media) {
    sweepMedia(false);
    mountMedia(box, item.media, base).then((m) => {
      if (!m) return;
      if (!box.isConnected) return m.stop();
      [...box.children].forEach((c) => c !== m.el && c.remove());
      box.classList.add("has-media");
      live.add(m);
    });
  }
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
  } else if (item.number !== undefined) {
    box.classList.add("number");
    box.innerHTML = '<b class="ey-digit"></b><span class="ey-dots"></span>';
    box.querySelector(".ey-digit").textContent = String(item.number);
    box.querySelector(".ey-dots").innerHTML = "<i></i>".repeat(Math.min(20, item.number));
  } else if (item.emoji) {
    const parts = Array.from(
      new Intl.Segmenter("en", { granularity: "grapheme" }).segment(item.emoji),
      (s) => s.segment,
    );
    if (parts.length > 1) box.classList.add("many");
    for (const e of parts) box.appendChild(emojiImg(e, item.word || ""));
  }
  return box;
}

/**
 * Spells a word letter by letter, then says it whole. onLetter(i) fires as letter i is
 * spoken (spaces are skipped), onLetter(-1) when the whole word starts. Returns a stop function.
 */
export function spell(word, onLetter = () => {}) {
  // one letter at a time: each letter clip (A … Z) waits for the one before it to end, then a
  // 120 ms gap, and its tile bounces the moment it starts; then the whole word. A letter with no
  // clip (or a silent one) is said by the fallback voice, so no letter is ever skipped.
  const parts = [...word].map((ch, i) => ({ text: ch.toUpperCase(), i })).filter((p) => p.text.trim());
  parts.push({ text: word, i: -1 });
  let stopped = false;
  MT.speakSequence(
    parts.map((p) => p.text),
    { lang: "en-IN", gap: 120, onPart: (k) => !stopped && onLetter(parts[k].i) },
  );
  return () => {
    stopped = true;
    MT.stopSpeech();
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Gold Standard frame for early-years picture activities
// ═════════════════════════════════════════════════════════════════════════

/**
 * The split-screen frame of the Gold Standard, for little ones:
 *   top bar      title pill, background-music toggle, the sound switch (ME.soundButton)
 *   left         an elevated living stage (ME.ambient: sparkles, hills, swaying grass)
 *   right        the panel: a yellow goal card, the template's own content, a feedback line and
 *                rolling read-outs (stars and question number)
 * With split: false there is only the stage (a poster, a big chart).
 * @returns {{root, stage, panel, body, goal(text), progress(at, total, label), score(n), say(text, kind),
 *            celebrate(el), stop()}}
 */
export function studioFrame(area, { icon, title, split = true, grass = true, stars = true } = {}) {
  document.documentElement.classList.toggle("st-low", ME.lowSpec());
  const root = document.createElement("div");
  root.className = "ey ey-studio";

  const hud = document.createElement("div");
  hud.className = "ey-hud";
  const brand = document.createElement("div");
  brand.className = "ey-brand";
  if (icon) brand.appendChild(emojiImg(icon));
  brand.appendChild(document.createTextNode(title || ""));
  const tools = document.createElement("div");
  tools.className = "ey-pills";
  if (document.documentElement.dataset.music) {
    const tune = document.createElement("button");
    tune.type = "button";
    tune.className = "ey-pill ey-music";
    const draw = () => {
      tune.textContent = musicWanted() ? "🎵 Music" : "🔇 Music";
      tune.setAttribute("aria-pressed", String(musicWanted()));
    };
    tune.addEventListener("click", () => {
      setMusicWanted(!musicWanted());
      draw();
    });
    draw();
    tools.append(tune);
  }
  ME.soundButton(tools);
  hud.append(brand, tools);

  const body = document.createElement("div");
  body.className = "st-split ey-split" + (split ? "" : " ey-solo");
  const left = document.createElement("div");
  left.className = "st-split-stage";
  const holder = document.createElement("div");
  holder.className = "st-stage-holder";
  const stage = document.createElement("div");
  stage.className = "st-stage st-stage--live ey-live";
  holder.appendChild(stage);
  left.appendChild(holder);
  body.appendChild(left);

  let panel = null;
  let goalEl = null;
  let content = null;
  let sayEl = null;
  let readsEl = null;
  if (split) {
    panel = document.createElement("div");
    panel.className = "st-panel ey-panel-r";
    goalEl = document.createElement("div");
    goalEl.className = "st-goal";
    goalEl.hidden = true;
    content = document.createElement("div");
    content.className = "ey-content";
    sayEl = document.createElement("div");
    sayEl.className = "st-say";
    sayEl.setAttribute("aria-live", "polite");
    readsEl = document.createElement("div");
    readsEl.className = "st-reads ey-reads";
    panel.append(goalEl, content, sayEl, readsEl);
    body.appendChild(panel);
  }
  root.append(hud, body);
  area.appendChild(root);
  const stopAmbient = ME.ambient(stage, { grass, stars });

  const reads = {};
  function read(key, label, accent) {
    if (!reads[key]) {
      const r = document.createElement("div");
      r.className = "st-read" + (accent ? " st-read--accent" : "");
      r.innerHTML = '<span class="k"></span><span class="n"><b>0</b><span class="u"></span></span>';
      (readsEl || tools).prepend(r);
      reads[key] = r;
    }
    reads[key].querySelector(".k").textContent = label;
    return reads[key];
  }

  return {
    root,
    stage,
    panel: content,
    body,
    goal(text) {
      if (!goalEl) return;
      goalEl.hidden = !text;
      goalEl.textContent = text || "";
      goalEl.classList.remove("st-solved");
    },
    solved() {
      if (goalEl) {
        goalEl.classList.remove("st-solved");
        void goalEl.offsetWidth;
        goalEl.classList.add("st-solved");
      }
    },
    progress(at, total, label = "Question") {
      const r = read("progress", label);
      rollPop(r.querySelector("b"), at);
      r.querySelector(".u").textContent = total ? ` / ${total}` : "";
    },
    score(n) {
      const r = read("score", "Stars ⭐", true);
      rollPop(r.querySelector("b"), n);
    },
    say(text, kind) {
      if (!sayEl) return;
      sayEl.textContent = text || "";
      sayEl.className = "st-say" + (kind ? " " + kind : "");
    },
    celebrate(el) {
      ME.burst(el || stage);
    },
    stop() {
      stopAmbient();
      sweepMedia(true);
    },
  };
}

/** Rolls a read-out number (ME.roll) and bounces it when it changes. */
function rollPop(el, to) {
  const changed = el._rollV !== undefined && el._rollV !== to;
  ME.roll(el, to);
  if (changed) ME.squash(el);
}

/** Big pill button for the Studio frame. */
export function studioButton(text, alt, fn) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "st-btn" + (alt ? " st-btn--alt" : "");
  b.textContent = text;
  b.addEventListener("click", (e) => {
    ME.squash(b);
    fn(e);
  });
  return b;
}

/** A big answer card (.st-pick) that squashes when touched. onPick(event) runs on the touch. */
export function pickCard(content, label, onPick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "st-pick ey-card";
  if (label) b.setAttribute("aria-label", label);
  if (typeof content === "string") b.textContent = content;
  else if (content) b.appendChild(content);
  b.addEventListener("click", (e) => {
    if (b.disabled) return;
    ME.squash(b);
    onPick(e);
  });
  return b;
}

/** Marks an answer: the right card floods green from the touch point, a wrong one shakes. */
export function markPick(card, ok, e) {
  if (ok) {
    card.classList.add("is-right");
    ME.flood(card, e && e.clientX, e && e.clientY, { color: ME.PALETTE.green, keep: true });
  } else {
    card.classList.remove("is-wrong");
    void card.offsetWidth;
    card.classList.add("is-wrong");
  }
}

/** The end-of-round card for the Studio frame: the score rolls up, stars pop, confetti bursts. */
export function studioResult(f, { score, total, onAgain }) {
  const pct = total ? score / total : 0;
  const stars = pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1;
  const box = document.createElement("div");
  box.className = "st-result";
  box.innerHTML =
    '<div class="st-card"><h2></h2><p class="line">You scored <b>0</b> out of <span></span></p>' +
    '<div class="stars"></div></div>';
  const head = pct >= 0.6 ? "Great job!" : "Good try!";
  box.querySelector("h2").textContent = head;
  box.querySelector(".line span").textContent = String(total);
  const row = box.querySelector(".stars");
  for (let i = 0; i < 3; i++) {
    const s = document.createElement("span");
    s.textContent = "★";
    s.className = i < stars ? "on" : "";
    s.style.animationDelay = `${0.25 + i * 0.18}s`;
    row.appendChild(s);
  }
  box.querySelector(".st-card").appendChild(
    studioButton("Play again", false, () => {
      box.remove();
      onAgain();
    }),
  );
  f.root.appendChild(box);
  const num = box.querySelector(".line b");
  num._rollV = 0;
  ME.roll(num, score);
  ME.sound.win();
  ME.burst(box.querySelector(".st-card"));
  MT.speak([head, "You scored", score, "out of", total]);
}

/**
 * Says a word and runs a bounce along its letter tiles (from ME.tiles) in time with the voice:
 * each letter lifts in turn, then the whole word. Returns a stop function.
 */
export function sayWord(word, tiles, lang) {
  if (!tiles) {
    MT.speak(word, lang);
    return () => {};
  }
  // the tiles light up in a sweep as the voice starts the word (not on a guess of when it starts)
  const n = [...word].length;
  const timers = [];
  let stopped = false;
  MT.speak({
    text: word,
    lang,
    onPart: () => {
      if (stopped) return;
      for (let i = 0; i < n; i++) timers.push(setTimeout(() => tiles.light(i), i * 85));
      timers.push(setTimeout(() => tiles.light(-1), 40 + n * 85));
      timers.push(setTimeout(() => tiles.clear(), 780 + n * 85));
    },
  });
  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
  };
}
