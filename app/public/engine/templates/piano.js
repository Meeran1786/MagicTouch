// Piano (early years): a big two-octave keyboard in bright colours. Every pen, hand, finger
// or mouse on a key plays it, so chords and two-handed playing work. Notes are synthesised.
// Activity data:
//   octaves: 2            optional, 1 to 3
//   start: 4              optional, the octave of the lowest C (4 = middle C)
//   names: "letters" | "sargam" | "none"   optional, what is written on the white keys
import { MT, audioCtx } from "../js/kit.js";
import { frame } from "../js/early.js";
import { onPoints } from "/shared/input/pointer.js";

export const meta = { fullscreen: true, styles: ["early", "piano"], points: 4 };

const WHITE = ["C", "D", "E", "F", "G", "A", "B"];
const SARGAM = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const HAS_BLACK = new Set(["C", "D", "F", "G", "A"]);
const COLOURS = ["#CC3054", "#E96E24", "#F3A328", "#2FA86A", "#3A86FF", "#631654", "#B0307A"];

/** One soft piano-like note: two partials with a quick attack and a long decay. */
function playNote(midi) {
  const ac = audioCtx;
  ac.resume();
  const t = ac.currentTime;
  const hz = 440 * 2 ** ((midi - 69) / 12);
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  out.connect(ac.destination);
  for (const [mult, type, level] of [
    [1, "triangle", 1],
    [2, "sine", 0.35],
    [3, "sine", 0.12],
  ]) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = hz * mult;
    g.gain.value = level;
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 1.9);
  }
}

export default function piano(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const octaves = Math.max(1, Math.min(3, d.octaves || 2));
  const base = 12 * ((d.start || 4) + 1); // MIDI number of the lowest C
  const names = d.names || "letters";
  const board = document.createElement("div");
  board.className = "pn";
  board.innerHTML = '<div class="pn-notes" aria-hidden="true"></div><div class="pn-keys"></div>';
  f.stage.appendChild(board);
  const keysEl = board.querySelector(".pn-keys");
  const notesEl = board.querySelector(".pn-notes");
  const whiteCount = octaves * 7 + 1;
  keysEl.style.setProperty("--n", String(whiteCount));
  const keys = [];

  for (let i = 0; i < whiteCount; i++) {
    const step = i % 7;
    const name = WHITE[step];
    const midi = base + 12 * Math.floor(i / 7) + SEMI[name];
    const k = document.createElement("button");
    k.type = "button";
    k.className = "pn-white";
    k.style.setProperty("--c", COLOURS[step]);
    k.dataset.midi = String(midi);
    if (names !== "none") k.innerHTML = `<span>${names === "sargam" ? SARGAM[step] : name}</span>`;
    k.setAttribute("aria-label", name);
    keysEl.appendChild(k);
    keys.push(k);
    if (HAS_BLACK.has(name) && i < whiteCount - 1) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pn-black";
      b.style.setProperty("--i", String(i + 1));
      b.dataset.midi = String(midi + 1);
      b.setAttribute("aria-label", name + " sharp");
      keysEl.appendChild(b);
      keys.push(b);
    }
  }

  function noteFloat(k) {
    if (MT.calm()) return;
    const r = k.getBoundingClientRect();
    const box = board.getBoundingClientRect();
    const n = document.createElement("span");
    n.textContent = "♪♫♩♬"[Math.floor(Math.random() * 4)];
    n.style.left = `${r.left - box.left + r.width / 2}px`;
    n.style.color = getComputedStyle(k).getPropertyValue("--c") || "var(--mt-plum)";
    notesEl.appendChild(n);
    setTimeout(() => n.remove(), 1600);
  }

  function press(k) {
    if (!k || k.classList.contains("down")) return;
    k.classList.add("down");
    playNote(+k.dataset.midi);
    noteFloat(k);
  }
  const release = (k) => k && k.classList.remove("down");

  // mouse and touch: each pointer holds the key it is on
  const held = new Map();
  const keyAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest(".pn-white, .pn-black") : null;
  };
  const onDown = (e) => {
    if (!e.isTrusted) return;
    const k = keyAt(e.clientX, e.clientY);
    held.set(e.pointerId, k);
    press(k);
  };
  const onMove = (e) => {
    if (!e.isTrusted || !held.has(e.pointerId)) return;
    const k = keyAt(e.clientX, e.clientY);
    if (k !== held.get(e.pointerId)) {
      release(held.get(e.pointerId));
      held.set(e.pointerId, k);
      press(k);
    }
  };
  const onUp = (e) => {
    if (!held.has(e.pointerId)) return;
    release(held.get(e.pointerId));
    held.delete(e.pointerId);
  };
  keysEl.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  // camera: every pen or fingertip on a key holds it down
  let camHeld = new Set();
  const off = onPoints((pts) => {
    const now = new Set(pts.map((p) => keyAt(p.x, p.y)).filter(Boolean));
    for (const k of camHeld) if (!now.has(k)) release(k);
    for (const k of now) if (!camHeld.has(k)) press(k);
    camHeld = now;
  });

  return () => {
    off();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
}
