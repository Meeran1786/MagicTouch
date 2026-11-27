// Catch the stars (early years): a glowing shield along the bottom follows the pen or hand
// left and right; slide it under the falling stars to catch them. Misses just fall past.
// Activity data:
//   emoji: "⭐🌟"   optional, what falls (default a star)
//   speed: 1        optional, how fast things fall
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiList } from "../js/arcade.js";

export const meta = { fullscreen: true, music: true, styles: ["early"], points: 1 };

export default function catchStars(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const g = arcade(f.stage, { hover: true });
  const pictures = emojiList(d.emoji || "⭐");
  const speed = d.speed || 1;
  let shieldX = 0;
  let flash = 0;
  let stars = [];
  let spawn = 0;
  let caught = 0;
  let missed = 0;
  f.score(0);

  g.onResize = (w) => {
    if (!shieldX) shieldX = w / 2;
  };
  g.onResize(g.w);

  g.loop((dt, t) => {
    const c = g.ctx;
    const shieldW = Math.max(200, g.w * 0.16);
    const shieldY = g.h - 50;
    const p = g.points()[0];
    if (p) shieldX += (Math.max(shieldW / 2, Math.min(g.w - shieldW / 2, p.x)) - shieldX) * Math.min(1, dt * 14);
    c.clearRect(0, 0, g.w, g.h);

    spawn -= dt;
    if (spawn <= 0) {
      stars.push({
        x: 40 + Math.random() * (g.w - 80),
        y: -40,
        v: (160 + Math.random() * 120) * speed,
        pic: pictures[Math.floor(Math.random() * pictures.length)],
        spin: Math.random() * 6,
      });
      spawn = 1.1 / speed;
    }
    for (const s of stars) {
      s.y += s.v * dt;
      if (!s.done && s.y > shieldY - 24 && s.y < shieldY + 10 && Math.abs(s.x - shieldX) < shieldW / 2 + 20) {
        s.done = true;
        caught++;
        flash = 1;
        f.score(caught);
        g.burst(s.x, shieldY - 10, "#F3A328", 12);
        MT.sfx.good();
      }
    }
    missed += stars.filter((s) => !s.done && s.y > g.h + 40).length;
    stars = stars.filter((s) => !s.done && s.y < g.h + 40);
    f.progress(missed ? `Caught ${caught} of ${caught + missed}` : "");

    for (const s of stars) {
      const size = 64 + Math.sin(t / 300 + s.spin) * 6;
      g.emoji(s.pic, s.x, s.y, size);
    }
    // the shield: a soft glowing bar with a ground shadow
    flash = Math.max(0, flash - dt * 3);
    c.fillStyle = "rgba(61, 14, 55, 0.12)";
    c.beginPath();
    c.ellipse(shieldX, shieldY + 30, shieldW * 0.55, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = "#F3A328";
    c.shadowBlur = MT.lowSpec() ? 0 : 20 + flash * 30;
    const grad = c.createLinearGradient(0, shieldY - 14, 0, shieldY + 14);
    grad.addColorStop(0, "#9b3b8a");
    grad.addColorStop(1, "#631654");
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect(shieldX - shieldW / 2, shieldY - 14, shieldW, 28, 14);
    c.fill();
    c.shadowBlur = 0;
    g.drawParticles(dt);
  });

  return () => g.stop();
}
