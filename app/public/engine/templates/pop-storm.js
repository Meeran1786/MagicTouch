// Pop storm (early years): bubbles stream up the wall; touch one with a pen, a finger or
// both hands and it pops. Free play: nothing to get wrong, a streak counter for fun.
// Activity data:
//   emoji: "🐟🐠🦀"   optional, little pictures floating inside some bubbles
//   rate: 1.4         optional, bubbles per second
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiList } from "../js/arcade.js";

export const meta = { fullscreen: true, music: true, styles: ["early"], points: 4 };

const COLOURS = ["#CC3054", "#E96E24", "#F3A328", "#2FA86A", "#631654", "#3A86FF"];
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
  f.score(0);

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
    f.score(score);
    f.progress(streak > 2 ? `🔥 ${streak} in a row` : "");
    g.burst(b.x, b.y, b.colour, 10);
    MT.sfx.tap();
  }

  function drawBubble(b, t) {
    const { ctx } = g;
    const x = b.x + Math.sin(t / 600 + b.wob) * 10;
    b.sx = x;
    const grad = ctx.createRadialGradient(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, x, b.y, b.r);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.55, b.colour + "55");
    grad.addColorStop(1, b.colour + "cc");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = b.colour;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (b.pic) g.emoji(b.pic, x, b.y, b.r * 1.1);
  }

  g.onTap = (x, y) => {
    for (const b of bubbles) if (!b.dead && Math.hypot((b.sx || b.x) - x, b.y - y) < b.r + 16) pop(b, performance.now());
  };

  g.loop((dt, t) => {
    const { ctx } = g;
    ctx.clearRect(0, 0, g.w, g.h);
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
    g.drawParticles(dt);
  });

  return () => g.stop();
}
