// Slice (early years): things fly up the wall; swipe through them to slice them in two.
// With rules, only the numbers that match the rule count ("Slice the even numbers!").
// Activity data:
//   items: [{ word: "Mango", photo: "assets/mango.png" } | { word, emoji }]   things to slice
//   numbers: [1, 9]                    instead of items: numbered balls from 1 to 9
//   rules: [{ label: "Slice the EVEN numbers!", say: "...", kind: "even" | "odd" | "more" | "less" | "times", n: 5 }]
//   switchAfter: 8                     right slices before the next rule
// Gold Standard look: lit Studio backdrop, glossy number balls, things cast soft shadows, a glowing
// amber blade, a rolling score and a confetti celebration with a green pulse when a rule is mastered.
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiImage, photoImage, hud } from "../js/arcade.js";
import { ME } from "/shared/motion-engine.js";

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
const COLOURS = ["#CC3054", "#E96E24", "#F3A328", "#2FA86A", "#631654"];

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
  let nextRule = 0;
  const showScore = hud(f);
  showScore(0);

  function announce() {
    const r = rules[ruleAt];
    if (!r) return (banner.hidden = true);
    banner.textContent = r.label;
    banner.classList.remove("flash", "st-solved");
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
      if (!ME.lowSpec()) {
        c.shadowColor = "rgba(61, 14, 55, 0.25)";
        c.shadowBlur = 18;
        c.shadowOffsetY = 10;
      }
      g.image(o.img, 0, 0, o.r * 2.2);
      c.shadowColor = "transparent";
    } else {
      ME.gloss(c, 0, 0, o.r, o.colour);
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
      showScore(score);
      if (!rule && score % 10 === 0) ME.celebrate(f.root.querySelector(".ey-pill.score"));
      g.burst(o.x, o.y, o.colour || "#F3A328", 12);
      MT.sfx.good();
      if (o.value !== undefined) MT.speak(String(o.value));
      if (rule && ++ruleHits >= (d.switchAfter || 8)) {
        ruleHits = 0;
        ME.celebrate(banner);
        clearTimeout(nextRule);
        nextRule = setTimeout(() => {
          ruleAt = (ruleAt + 1) % rules.length;
          announce();
        }, 1300);
      }
    } else {
      g.burst(o.x, o.y, "#5D5464", 6);
      MT.sfx.bad();
    }
  }

  g.onTap = (x, y) => {
    for (const o of things) if (!o.dead && Math.hypot(o.x - x, o.y - y) < o.r) cut(o);
  };

  g.loop((dt) => {
    const c = g.ctx;
    g.backdrop();
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
    const floor = g.h * 0.93;
    for (const o of things) g.shadow(o.x, floor, o.r * 1.1, 1 - (floor - o.y) / g.h);
    for (const o of things) drawThing(o);
    for (const o of halves) drawThing(o, o.part);
    // the blade trail
    trail = trail.filter((s) => (s.life -= dt * 4) > 0);
    c.lineCap = "round";
    for (const s of trail) {
      // a plum edge with a hot amber core
      c.strokeStyle = `rgba(99, 22, 84, ${s.life * 0.55})`;
      c.lineWidth = 16 * s.life;
      c.beginPath();
      c.moveTo(s.px, s.py);
      c.lineTo(s.x, s.y);
      c.stroke();
      c.strokeStyle = `rgba(251, 208, 100, ${s.life})`;
      c.lineWidth = 6 * s.life;
      c.stroke();
    }
    g.drawParticles(dt);
  });

  announce();
  return () => {
    clearTimeout(nextRule);
    g.stop();
  };
}
