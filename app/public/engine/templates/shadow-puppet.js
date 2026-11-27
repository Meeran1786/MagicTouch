// Shadow puppets (early years): a glowing paper screen; the pen or hand moves an animal's
// shadow across it. The shadow glides after the pointer, turns to face where it is going and
// grows as it comes down towards the light. Pick another puppet from the shelf below.
// Activity data:
//   puppets: [{ emoji: "🐇", word: "Rabbit" }, ...]
import { MT } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiImage } from "../js/arcade.js";
import { emojiImg } from "/shared/studio/emoji.js";

export const meta = { fullscreen: true, music: true, styles: ["early", "shadow-puppet"], points: 1 };

export default function shadowPuppet(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const wrap = document.createElement("div");
  wrap.className = "spp";
  wrap.innerHTML = '<div class="spp-screen"></div><div class="spp-shelf"></div>';
  f.stage.appendChild(wrap);
  const g = arcade(wrap.querySelector(".spp-screen"), { hover: true });
  const shelf = wrap.querySelector(".spp-shelf");
  let puppet = d.puppets[0];
  let x = 0;
  let y = 0;
  let face = 1;
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
    if (p) {
      const nx = x + (p.x - x) * Math.min(1, dt * 6);
      if (Math.abs(nx - x) > 0.6) face = nx > x ? 1 : -1;
      x = nx;
      y += (p.y - y) * Math.min(1, dt * 6);
    }
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
    // the puppet's shadow: soft edge first, then the sharp shadow
    const size = Math.min(g.h * 0.55, 140 + (y / g.h) * 200);
    const bob = MT.calm() ? 0 : Math.sin(t / 260) * 6;
    const img = emojiImage(puppet.emoji);
    if (img.complete && img.naturalWidth) {
      c.save();
      c.translate(x, y + bob);
      c.scale(-face, 1); // emoji face left; flip to face the way it moves
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
