// Shadow puppets (early years): a glowing paper screen; the pen or hand moves an animal's
// shadow across it. The shadow glides after the pointer, turns to face where it is going and
// grows as it comes down towards the light. Pick another puppet from the shelf below.
// Activity data:
//   puppets: [{ emoji: "🐇", word: "Rabbit" }, ...]
// Gold Standard look: the paper screen is an elevated stage in a plum theatre frame, dust motes
// drift in the lamp light, the shadow stretches as it speeds up and squashes when it stops, and a
// picked puppet bounces.
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiImage, hud } from "../js/arcade.js";
import { ME } from "/shared/motion-engine.js";
import { emojiImg } from "/shared/studio/emoji.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "shadow-puppet"], points: 1 };

export default function shadowPuppet(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const wrap = document.createElement("div");
  wrap.className = "spp";
  wrap.innerHTML = '<div class="spp-screen st-stage"></div><div class="spp-shelf"></div>';
  f.stage.appendChild(wrap);
  hud(f);
  const g = arcade(wrap.querySelector(".spp-screen"), { hover: true, card: false });
  const shelf = wrap.querySelector(".spp-shelf");
  let puppet = d.puppets[0];
  let x = 0;
  let y = 0;
  let face = 1;
  let vel = 0;
  let started = false;

  d.puppets.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spp-pick" + (i === 0 ? " on" : "");
    b.setAttribute("aria-label", p.word);
    b.append(emojiImg(p.emoji, p.word), Object.assign(document.createElement("span"), { textContent: p.word }));
    b.addEventListener("click", () => {
      puppet = p;
      shelf.querySelectorAll(".spp-pick").forEach((n) => n.classList.toggle("on", n === b));
      ME.squash(b);
      MT.sfx.tap();
      MT.speak(p.word);
    });
    shelf.appendChild(b);
  });

  g.loop((dt, t) => {
    const c = g.ctx;
    const p = g.points()[0];
    if (!started) {
      x = g.w / 2;
      y = g.h * 0.55;
      started = true;
    }
    const ox = x;
    if (p) {
      const nx = x + (p.x - x) * Math.min(1, dt * 6);
      if (Math.abs(nx - x) > 0.6) face = nx > x ? 1 : -1;
      x = nx;
      y += (p.y - y) * Math.min(1, dt * 6);
    }
    vel += (Math.min(1, Math.abs(x - ox) / Math.max(dt, 0.001) / 900) - vel) * Math.min(1, dt * 8);
    // the paper screen, lit from behind
    const glow = c.createRadialGradient(g.w / 2, g.h * 0.45, 20, g.w / 2, g.h * 0.45, Math.max(g.w, g.h) * 0.7);
    glow.addColorStop(0, "#fff7e6");
    glow.addColorStop(0.6, "#fde3b5");
    glow.addColorStop(1, "#f3b968");
    c.fillStyle = glow;
    c.fillRect(0, 0, g.w, g.h);
    // grass along the bottom, swaying
    c.fillStyle = "rgba(61, 14, 55, 0.85)";
    c.beginPath();
    c.moveTo(0, g.h);
    for (let i = 0; i <= 60; i++) {
      const gx = (i / 60) * g.w;
      const sway = MT.calm() ? 0 : Math.sin(t / 700 + i) * 4;
      c.lineTo(gx + sway, g.h - (i % 2 ? 18 : 34));
    }
    c.lineTo(g.w, g.h);
    c.fill();
    // the moon
    c.fillStyle = "rgba(255, 255, 255, 0.8)";
    c.beginPath();
    c.arc(g.w * 0.85, g.h * 0.18, 38, 0, Math.PI * 2);
    c.fill();
    // dust drifting in the lamp light
    if (!MT.calm() && !MT.lowSpec()) {
      c.fillStyle = "rgba(255, 255, 255, 0.55)";
      for (let i = 0; i < 14; i++) {
        const mx = (((i * 0.137 + t / 90000) % 1) + 1) % 1;
        const my = (((i * 0.311 - t / 40000) % 1) + 1) % 1;
        c.beginPath();
        c.arc(mx * g.w + Math.sin(t / 1300 + i) * 20, my * g.h * 0.85, 2 + (i % 3), 0, Math.PI * 2);
        c.fill();
      }
    }
    // the puppet's shadow: soft edge first, then the sharp shadow
    const size = Math.min(g.h * 0.55, 140 + (y / g.h) * 200);
    const bob = MT.calm() ? 0 : Math.sin(t / 260) * 6;
    const img = emojiImage(puppet.emoji);
    if (img.complete && img.naturalWidth) {
      c.save();
      c.translate(x, y + bob);
      c.scale(-face, 1); // emoji face left; flip to face the way it moves
      if (!MT.calm()) c.scale(1 + vel * 0.18, 1 - vel * 0.12); // stretch with speed
      c.filter = MT.lowSpec() ? "brightness(0)" : "brightness(0) blur(6px)";
      c.globalAlpha = 0.35;
      c.drawImage(img, -size / 2 + 8, -size / 2 + 8, size, size);
      c.filter = "brightness(0)";
      c.globalAlpha = 0.88;
      c.drawImage(img, -size / 2, -size / 2, size, size);
      c.restore();
    }
  });

  return () => g.stop();
}
