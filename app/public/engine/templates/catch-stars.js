// Catch the stars (early years): a glowing shield along the bottom follows the pen or hand
// left and right; slide it under the falling stars to catch them. Misses just fall past.
// Activity data:
//   emoji: "⭐🌟"   optional, what falls (default a star)
//   speed: 1        optional, how fast things fall
// Gold Standard look: an evening-sky Studio backdrop, stars with a soft halo and a ground shadow that
// grows as they fall, a lit shield that squashes when it catches, a rolling score and a confetti
// celebration every 10 catches.
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiList, hud } from "../js/arcade.js";
import { ME } from "/shared/motion-engine.js";

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
  let squash = 0;
  const showScore = hud(f);
  showScore(0);

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
    g.backdrop({ floor: (shieldY + 30) / g.h, top: "#FBF4FA", mid: "#FDF9FC", bottom: "#F3E7F0" });

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
        squash = 1;
        showScore(caught);
        if (caught % 10 === 0) ME.celebrate(f.root.querySelector(".ey-pill.score"));
        g.burst(s.x, shieldY - 10, "#F3A328", 12);
        MT.sfx.good();
      }
    }
    missed += stars.filter((s) => !s.done && s.y > g.h + 40).length;
    stars = stars.filter((s) => !s.done && s.y < g.h + 40);
    f.progress(missed ? `Caught ${caught} of ${caught + missed}` : "");

    for (const s of stars) {
      const size = 64 + Math.sin(t / 300 + s.spin) * 6;
      g.shadow(s.x, shieldY + 30, size * 0.5, s.y / (shieldY + 30));
      if (!ME.lowSpec()) {
        const halo = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, size);
        halo.addColorStop(0, "rgba(251, 208, 100, 0.45)");
        halo.addColorStop(1, "rgba(251, 208, 100, 0)");
        c.fillStyle = halo;
        c.beginPath();
        c.arc(s.x, s.y, size, 0, Math.PI * 2);
        c.fill();
      }
      g.emoji(s.pic, s.x, s.y, size);
    }
    // the shield: a lit plum capsule with a ground shadow; it squashes when it catches
    flash = Math.max(0, flash - dt * 3);
    squash = Math.max(0, squash - dt * 4);
    const sq = MT.calm() ? 0 : Math.sin(squash * Math.PI) * 0.18;
    g.shadow(shieldX, shieldY + 30, shieldW * 0.6, 1);
    c.save();
    c.translate(shieldX, shieldY);
    c.scale(1 + sq, 1 - sq);
    c.shadowColor = "#F3A328";
    c.shadowBlur = MT.lowSpec() ? 0 : 20 + flash * 30;
    const grad = c.createLinearGradient(0, -16, 0, 16);
    grad.addColorStop(0, "#9b3b8a");
    grad.addColorStop(0.5, "#631654");
    grad.addColorStop(1, "#3D0E37");
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect(-shieldW / 2, -16, shieldW, 32, 16);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = "rgba(255, 255, 255, 0.35)";
    c.beginPath();
    c.roundRect(-shieldW / 2 + 14, -11, shieldW - 28, 7, 4);
    c.fill();
    c.restore();
    g.drawParticles(dt);
  });

  return () => g.stop();
}
