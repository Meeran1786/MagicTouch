// Trace (early years): a big letter or number drawn as pen strokes in writing order. Each
// stroke has a numbered start and arrows; the child traces over the dots with the pen, a
// finger or a mouse, and the dots light up. Trace most of it and the shape is done.
// Activity data:
//   glyphs: { "A": [stroke, ...], ... }   in the order they are taught; strokes in 0..1 box space:
//     { line: [[x, y], ...] }                    a straight or bent line
//     { arc: [cx, cy, rx, ry, fromDeg, toDeg] }  part of an ellipse (0° right, 90° down)
//     { open: [cx, cy, rx, ry, gapDeg, gapWidth] } an ellipse with a gap (C, G, S)
//   say: { "A": "A for Apple" }   optional, spoken when a glyph is finished
// Gold Standard look: the board is an elevated stage with a lit Studio backdrop; the guide is an
// embossed letter, lit dots pop as the pen passes, the "Traced" read-out rolls up, and a finished
// letter celebrates (green pulse, confetti, squash).
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, hud } from "../js/arcade.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "trace"], points: 1 };

const SPACING = 0.045; // guide dots, in box units
const DONE_SHARE = 0.9; // share of dots that must be lit
const COLOURS = ["#CC3054", "#E96E24", "#2FA86A", "#631654", "#F3A328"];

function strokePoints(s) {
  const out = [];
  if (s.line) {
    out.push(s.line[0]);
    for (let i = 1; i < s.line.length; i++) {
      const [ax, ay] = s.line[i - 1];
      const [bx, by] = s.line[i];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / SPACING));
      for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
    return out;
  }
  const [cx, cy, rx, ry, a, b] = s.arc || s.open;
  // an open ellipse names its gap; turn that into where the stroke starts and ends
  const [from, to] = s.open ? [a + b / 2, a + 360 - b / 2] : [a, b];
  const n = Math.max(4, Math.round((((rx + ry) / 2) * Math.abs(to - from) * Math.PI) / 180 / SPACING));
  for (let k = 0; k <= n; k++) {
    const a = ((from + ((to - from) * k) / n) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

export default function trace(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const wrap = document.createElement("div");
  wrap.className = "tr";
  wrap.innerHTML =
    '<div class="tr-board"></div><div class="tr-side">' +
    '<div class="tr-glyph"></div>' +
    '<div class="st-read tr-read"><span class="k">Traced</span><span class="n"><b>0</b> %</span><div class="tr-bar"><i></i></div></div>' +
    '<button class="ey-btn alt tr-clear" type="button">↺ Start again</button>' +
    '<div class="tr-nav"><button class="ey-btn alt tr-prev" type="button">←</button>' +
    '<button class="ey-btn tr-next" type="button">Next →</button></div></div>';
  f.stage.appendChild(wrap);
  const g = arcade(wrap.querySelector(".tr-board"));
  const glyphEl = wrap.querySelector(".tr-glyph");
  const bar = wrap.querySelector(".tr-bar i");
  const readEl = wrap.querySelector(".tr-read");
  const pctEl = readEl.querySelector("b");
  const pct = ME.counter((n) => (pctEl.textContent = String(n)), 12);
  const showScore = hud(f);
  const keys = Object.keys(d.glyphs);
  let at = 0;
  let strokes = []; // [[{x, y, lit}], ...] in box units
  let done = false;
  let ink = [];
  let stars = 0;
  showScore(0);

  function load(i) {
    at = (i + keys.length) % keys.length;
    strokes = d.glyphs[keys[at]].map((s) => strokePoints(s).map(([x, y]) => ({ x, y, lit: false })));
    done = false;
    ink = [];
    bar.style.transform = "scaleX(0)";
    pct.set(0);
    readEl.classList.remove("st-solved");
    glyphEl.textContent = keys[at];
    ME.squash(glyphEl);
    f.progress(`${at + 1} / ${keys.length}`);
    MT.speak(["Trace", keys[at]]);
  }

  function box() {
    const s = Math.min(g.w * 0.7, g.h * 0.86);
    return { s, x: (g.w - s) / 2, y: (g.h - s) / 2 };
  }

  function finish() {
    done = true;
    stars++;
    showScore(stars);
    pct.set(100);
    ME.celebrate(readEl);
    ME.squash(glyphEl);
    const b = box();
    for (const st of strokes)
      for (const p of st.filter((_, k) => k % 4 === 0)) g.burst(b.x + p.x * b.s, b.y + p.y * b.s, "#F3A328", 2);
    MT.speak(["Well done!", (d.say && d.say[keys[at]]) || keys[at]]);
  }

  wrap.querySelector(".tr-clear").addEventListener("click", () => load(at));
  wrap.querySelector(".tr-prev").addEventListener("click", () => load(at - 1));
  wrap.querySelector(".tr-next").addEventListener("click", () => load(at + 1));

  g.loop((dt) => {
    const c = g.ctx;
    const b = box();
    const X = (p) => b.x + p.x * b.s;
    const Y = (p) => b.y + p.y * b.s;
    const reach = Math.max(26, b.s * 0.06);
    // light the dots the pointer passes over
    if (!done) {
      for (const p of g.points()) {
        ink.push({ x: p.x, y: p.y, px: p.px, py: p.py });
        for (const st of strokes)
          for (const q of st) if (!q.lit && g.segDist(X(q), Y(q), p.px, p.py, p.x, p.y) < reach) q.lit = true;
      }
      const all = strokes.flat();
      const share = all.filter((q) => q.lit).length / all.length;
      bar.style.transform = `scaleX(${share.toFixed(3)})`;
      pct.set(Math.round(share * 100));
      if (share >= DONE_SHARE) finish();
    }
    if (ink.length > 400) ink.splice(0, ink.length - 400);

    g.backdrop({ floor: 0 });
    c.lineCap = c.lineJoin = "round";
    // the fat pale letter, embossed: a soft shade below, the face, a light edge above
    for (const [dy, col] of [
      [b.s * 0.008, "rgba(99, 22, 84, 0.10)"],
      [0, "#F3E8F0"],
    ])
      for (const st of strokes) {
        c.strokeStyle = col;
        c.lineWidth = b.s * 0.13;
        c.beginPath();
        st.forEach((q, k) => (k ? c.lineTo(X(q), Y(q) + dy) : c.moveTo(X(q), Y(q) + dy)));
        c.stroke();
      }
    // the child's ink
    c.strokeStyle = "rgba(204, 48, 84, 0.55)";
    c.lineWidth = b.s * 0.05;
    for (const s of ink) {
      c.beginPath();
      c.moveTo(s.px, s.py);
      c.lineTo(s.x, s.y);
      c.stroke();
    }
    // guide dots, arrows and numbered starts
    const badges = [];
    strokes.forEach((st, si) => {
      const col = COLOURS[si % COLOURS.length];
      st.forEach((q, k) => {
        c.fillStyle = q.lit ? col : "rgba(99, 22, 84, 0.22)";
        c.beginPath();
        c.arc(X(q), Y(q), q.lit ? b.s * 0.017 : b.s * 0.011, 0, Math.PI * 2);
        c.fill();
        if (!q.lit && k % 6 === 3 && st[k + 1]) {
          const a = Math.atan2(Y(st[k + 1]) - Y(q), X(st[k + 1]) - X(q));
          c.save();
          c.translate(X(q), Y(q));
          c.rotate(a);
          c.fillStyle = "rgba(99, 22, 84, 0.45)";
          c.beginPath();
          c.moveTo(b.s * 0.03, 0);
          c.lineTo(-b.s * 0.01, -b.s * 0.02);
          c.lineTo(-b.s * 0.01, b.s * 0.02);
          c.fill();
          c.restore();
        }
      });
      // the numbered start sits just behind the start, so strokes that begin at the same
      // spot (the top of A) still show both numbers
      const s0 = st[0];
      const s1 = st[Math.min(2, st.length - 1)];
      const len = Math.hypot(s1.x - s0.x, s1.y - s0.y) || 1;
      let back = 0.05;
      let bx = 0;
      let by = 0;
      do {
        bx = X(s0) - ((s1.x - s0.x) / len) * b.s * back;
        by = Y(s0) - ((s1.y - s0.y) / len) * b.s * back;
        back += 0.02;
      } while (back < 0.2 && badges.some((q) => Math.hypot(q.x - bx, q.y - by) < b.s * 0.075));
      badges.push({ x: bx, y: by });
      c.fillStyle = col;
      c.beginPath();
      c.arc(bx, by, b.s * 0.035, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.font = `700 ${Math.round(b.s * 0.04)}px Carlito, Calibri, sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(si + 1), bx, by + 1);
    });
    g.drawParticles(dt);
  });

  load(0);
  return () => g.stop();
}
