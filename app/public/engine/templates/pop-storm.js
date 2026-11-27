// Pop storm (early years): bubbles stream up the wall; touch one with a pen, a finger or
// both hands and it pops. Free play: nothing to get wrong, a streak counter for fun.
// Gold Standard look: glassy lit bubbles that squash and stretch as they wobble, a pop ring and
// sparks, a rolling score, and a confetti celebration every 10 pops.
// Activity data:
//   emoji: "🐟🐠🦀"   optional, little pictures floating inside some bubbles
//   rate: 1.4         optional, bubbles per second
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiList, hud } from "../js/arcade.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, music: true, styles: ["early"], points: 4 };

const COLOURS = ["#CC3054", "#E96E24", "#F3A328", "#2FA86A", "#631654"];
const CELEBRATE_EVERY = 10;
const MAX_BUBBLES = 18;

export default function popStorm(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const g = arcade(f.stage, { hover: true });
  const pictures = emojiList(d.emoji);
  const rate = d.rate || 1.4;
  let bubbles = [];
  let spawn = 0;
  let score = 0;
  let streak = 0;
  let lastPop = 0;
  let rings = [];
  const showScore = hud(f);
  showScore(0);

  function add() {
    const r = 46 + Math.random() * 40;
    bubbles.push({
      x: r + Math.random() * (g.w - 2 * r),
      y: g.h + r,
      r,
      vy: 90 + Math.random() * 90,
      wob: Math.random() * Math.PI * 2,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
      pic: pictures.length && Math.random() < 0.4 ? pictures[Math.floor(Math.random() * pictures.length)] : null,
    });
  }

  function pop(b, t) {
    b.dead = true;
    score++;
    streak = t - lastPop < 1200 ? streak + 1 : 1;
    lastPop = t;
    showScore(score);
    f.progress(streak > 2 ? `🔥 ${streak} in a row` : "");
    g.burst(b.sx || b.x, b.y, b.colour, 10);
    rings.push({ x: b.sx || b.x, y: b.y, r: b.r, life: 1, colour: b.colour });
    MT.sfx.tap();
    if (score % CELEBRATE_EVERY === 0) ME.celebrate(f.root.querySelector(".ey-pill.score"));
  }

  function drawBubble(b, t) {
    const { ctx } = g;
    const x = b.x + Math.sin(t / 600 + b.wob) * 10;
    b.sx = x;
    // squash and stretch: the bubble breathes as it wobbles up
    const k = MT.calm() ? 0 : Math.sin(t / 260 + b.wob) * 0.06;
    ctx.save();
    ctx.translate(x, b.y);
    ctx.scale(1 + k, 1 - k);
    const r = b.r;
    // body: clear glass tinted at the rim
    const body = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.15, 0, 0, r);
    body.addColorStop(0, "rgba(255,255,255,0.55)");
    body.addColorStop(0.7, b.colour + "26");
    body.addColorStop(0.92, b.colour + "88");
    body.addColorStop(1, b.colour + "dd");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    if (b.pic) g.emoji(b.pic, 0, 0, r * 1.1);
    // rim light below and the key-light highlight above
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, Math.PI * 0.15, Math.PI * 0.55);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.22, r * 0.11, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRings(dt) {
    const { ctx } = g;
    rings = rings.filter((q) => (q.life -= dt * 3) > 0);
    for (const q of rings) {
      ctx.strokeStyle = q.colour;
      ctx.globalAlpha = q.life;
      ctx.lineWidth = 6 * q.life;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r * (1.5 - q.life * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  g.onTap = (x, y) => {
    for (const b of bubbles)
      if (!b.dead && Math.hypot((b.sx || b.x) - x, b.y - y) < b.r + 16) pop(b, performance.now());
  };

  g.loop((dt, t) => {
    g.backdrop({ floor: 0, top: "#FFFFFF", mid: "#F9F3F8", bottom: "#F1E6EE" });
    spawn += dt * rate * (MT.lowSpec() ? 0.6 : 1);
    while (spawn >= 1 && bubbles.length < MAX_BUBBLES) {
      spawn--;
      add();
    }
    if (spawn >= 1) spawn = 0;
    const touches = g.points();
    for (const b of bubbles) {
      b.y -= b.vy * dt;
      for (const p of touches) {
        if (!b.dead && g.segDist(b.sx || b.x, b.y, p.px, p.py, p.x, p.y) < b.r + 12) pop(b, t);
      }
    }
    bubbles = bubbles.filter((b) => !b.dead && b.y > -b.r * 2);
    for (const b of bubbles) drawBubble(b, t);
    drawRings(dt);
    g.drawParticles(dt);
  });

  return () => g.stop();
}
