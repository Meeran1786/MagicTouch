// Slice (early years): things fly up the wall; swipe through them to slice them in two.
// With rules, only the numbers that match the rule count ("Slice the even numbers!").
// Activity data:
//   items: [{ word: "Mango", photo: "assets/mango.png" } | { word, emoji }]   things to slice
//   numbers: [1, 9]                    instead of items: numbered balls from 1 to 9
//   rules: [{ label: "Slice the EVEN numbers!", say: "...", kind: "even" | "odd" | "more" | "less" | "times", n: 5 }]
//   switchAfter: 8                     right slices before the next rule
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiImage, photoImage } from "../js/arcade.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "slice"], points: 2 };

const TESTS = {
  even: (v) => v % 2 === 0,
  odd: (v) => v % 2 === 1,
  more: (v, n) => v > n,
  less: (v, n) => v < n,
  times: (v, n) => v % n === 0,
};
const GRAVITY = 620;
const MIN_SWIPE = 6; // px a pointer must move in a frame to cut
const COLOURS = ["#CC3054", "#E96E24", "#F3A328", "#2FA86A", "#631654", "#3A86FF"];

export default function slice(area, d, ctx) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const banner = document.createElement("div");
  banner.className = "sl-rule";
  f.stage.appendChild(banner);
  const g = arcade(f.stage);
  const rules = d.rules || [];
  const [lo, hi] = d.numbers || [1, 9];
  let things = [];
  let halves = [];
  let trail = [];
  let spawn = 0.6;
  let score = 0;
  let ruleAt = 0;
  let ruleHits = 0;
  f.score(0);

  function announce() {
    const r = rules[ruleAt];
    if (!r) return (banner.hidden = true);
    banner.textContent = r.label;
    banner.classList.remove("flash");
    void banner.offsetWidth;
    banner.classList.add("flash");
    MT.speak(r.say || r.label);
  }

  function picture() {
    if (d.items) {
      const it = d.items[Math.floor(Math.random() * d.items.length)];
      return { word: it.word, img: it.photo ? photoImage(ctx.base + it.photo) : emojiImage(it.emoji) };
    }
    const v = lo + Math.floor(Math.random() * (hi - lo + 1));
    return { value: v, colour: COLOURS[v % COLOURS.length] };
  }

  function throwOne() {
    const r = Math.min(70, g.h * 0.09);
    const x = g.w * (0.15 + Math.random() * 0.7);
    const peak = g.h * (0.2 + Math.random() * 0.3);
    const vy = -Math.sqrt(2 * GRAVITY * (g.h - peak));
    things.push({
      ...picture(),
      x,
      y: g.h + r,
      r,
      vx: (g.w / 2 - x) * (0.2 + Math.random() * 0.3),
      vy,
      spin: d.items ? (Math.random() - 0.5) * 3 : 0,
      a: 0,
    });
  }

  function drawThing(o, part = 0) {
    const c = g.ctx;
    c.save();
    c.translate(o.x, o.y);
    c.rotate(o.a);
    if (part) {
      c.beginPath();
      c.rect(part < 0 ? -o.r * 2 : 0, -o.r * 2, o.r * 2, o.r * 4);
      c.clip();
    }
    if (o.img) {
      g.image(o.img, 0, 0, o.r * 2.2);
    } else {
      const grad = c.createRadialGradient(-o.r * 0.3, -o.r * 0.3, o.r * 0.1, 0, 0, o.r);
      grad.addColorStop(0, "#fff");
      grad.addColorStop(0.35, o.colour);
      grad.addColorStop(1, o.colour);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(0, 0, o.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.font = `700 ${o.r * 1.1}px Caladea, Cambria, serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(o.value), 0, o.r * 0.06);
    }
    c.restore();
  }

  function cut(o) {
    o.dead = true;
    for (const side of [-1, 1])
      halves.push({ ...o, part: side, vx: o.vx + side * 160, vy: Math.min(o.vy, 0) - 80, spin: side * 3, life: 1 });
    const rule = rules[ruleAt];
    const ok = !rule || o.value === undefined || TESTS[rule.kind](o.value, rule.n);
    if (ok) {
      score++;
      f.score(score);
      g.burst(o.x, o.y, o.colour || "#F3A328", 12);
      MT.sfx.good();
      if (o.value !== undefined) MT.speak(String(o.value));
      if (rule && ++ruleHits >= (d.switchAfter || 8)) {
        ruleHits = 0;
        ruleAt = (ruleAt + 1) % rules.length;
        announce();
      }
    } else {
      g.burst(o.x, o.y, "#8E8E93", 6);
      MT.sfx.bad();
    }
  }

  g.onTap = (x, y) => {
    for (const o of things) if (!o.dead && Math.hypot(o.x - x, o.y - y) < o.r) cut(o);
  };

  g.loop((dt) => {
    const c = g.ctx;
    c.clearRect(0, 0, g.w, g.h);
    spawn -= dt;
    if (spawn <= 0 && things.length < (MT.lowSpec() ? 4 : 6)) {
      throwOne();
      spawn = 0.9 + Math.random() * 0.6;
    }
    for (const p of g.points()) {
      if (Math.hypot(p.x - p.px, p.y - p.py) < MIN_SWIPE) continue;
      trail.push({ x: p.x, y: p.y, px: p.px, py: p.py, life: 1 });
      for (const o of things) if (!o.dead && g.segDist(o.x, o.y, p.px, p.py, p.x, p.y) < o.r) cut(o);
    }
    for (const o of [...things, ...halves]) {
      o.vy += GRAVITY * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.a += o.spin * dt;
    }
    things = things.filter((o) => !o.dead && o.y < g.h + o.r * 2);
    halves = halves.filter((o) => o.y < g.h + o.r * 3);
    for (const o of things) drawThing(o);
    for (const o of halves) drawThing(o, o.part);
    // the blade trail
    trail = trail.filter((s) => (s.life -= dt * 4) > 0);
    c.lineCap = "round";
    for (const s of trail) {
      c.strokeStyle = `rgba(99, 22, 84, ${s.life * 0.7})`;
      c.lineWidth = 12 * s.life;
      c.beginPath();
      c.moveTo(s.px, s.py);
      c.lineTo(s.x, s.y);
      c.stroke();
    }
    g.drawParticles(dt);
  });

  announce();
  return () => g.stop();
}
