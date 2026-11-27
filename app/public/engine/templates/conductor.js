// Conductor (early years): a little tune loops while the child conducts the orchestra.
// Raise the pen or hand and the music speeds up; lower it and it slows. Wave with energy and
// it swells; hold still and it plays softly. The instruments bounce on the beat.
// Activity data:
//   emoji: "🎻🎺🥁🎷🪕🎹"     the orchestra
//   melody: [0, 2, 4, 2, 0, 4, 7, 4]   optional, steps of the C major scale, one per eighth note
// Gold Standard look: a lit concert stage with plum curtains and spotlights that flare on the beat,
// instruments that squash and stretch with ground shadows, a glowing baton trail, a tempo meter
// with a projector-readable read-out, and the global sound switch.
import { audioCtx } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiList, hud } from "../js/arcade.js";
import { ME } from "/shared/motion-engine.js";

export const meta = { fullscreen: true, styles: ["early"], points: 1 };

const SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const BPM = [55, 170];
const VOL = [0.12, 0.9];
const LOOKAHEAD_MS = 25;
const AHEAD_S = 0.15;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function conductor(area, d) {
  const f = frame(area, { icon: d.icon, title: d.title });
  const g = arcade(f.stage, { hover: true });
  hud(f);
  const band = emojiList(d.emoji || "🎻🎺🥁🎷🪕🎹");
  const melody = d.melody || [0, 2, 4, 2, 0, 4, 7, 4];
  const ac = audioCtx;
  let master = null;
  let pad = [];
  let timer = 0;
  let nextAt = 0;
  let step = 0;
  let bpm = 96;
  let targetBpm = 96;
  let vol = VOL[0];
  let speed = 0;
  let prev = null;
  let beatAt = -1e9;
  const trail = [];

  function tone(type, freq, time, peak, len, endFreq) {
    const o = ac.createOscillator();
    const gn = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, time + len * 0.8);
    gn.gain.setValueAtTime(0.0001, time);
    gn.gain.linearRampToValueAtTime(peak, time + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.001, time + len);
    o.connect(gn).connect(master);
    o.start(time);
    o.stop(time + len + 0.02);
  }

  function schedule() {
    while (nextAt < ac.currentTime + AHEAD_S) {
      tone("triangle", SCALE[melody[step % melody.length]], nextAt, 0.5, 0.28);
      if (step % 4 === 0) tone("sine", 150, nextAt, 0.9, 0.16, 42);
      const at = nextAt;
      setTimeout(() => (beatAt = performance.now()), Math.max(0, (at - ac.currentTime) * 1000));
      nextAt += 60 / bpm / 2;
      step++;
    }
  }

  function start() {
    if (master) return;
    ac.resume();
    master = ac.createGain();
    master.gain.value = vol;
    master.connect(ac.destination);
    const padGain = ac.createGain();
    padGain.gain.value = 0.12;
    padGain.connect(master);
    pad = [130.81, 164.81, 196.0].map((hz) => {
      const o = ac.createOscillator();
      o.frequency.value = hz;
      o.connect(padGain);
      o.start();
      return o;
    });
    nextAt = ac.currentTime + 0.1;
    timer = setInterval(schedule, LOOKAHEAD_MS);
  }
  g.onTap = start;

  g.loop((dt, t) => {
    const c = g.ctx;
    const p = g.points()[0];
    if (p) {
      start();
      targetBpm = clamp(lerp(BPM[1], BPM[0], p.y / g.h), BPM[0], BPM[1]);
      speed = lerp(speed, prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0, 0.15);
      trail.push({ x: p.x, y: p.y });
      if (trail.length > 16) trail.shift();
    } else {
      speed = lerp(speed, 0, 0.15);
      if (trail.length) trail.shift();
    }
    prev = p || null;
    bpm = lerp(bpm, targetBpm, 0.05);
    vol = lerp(vol, clamp(lerp(VOL[0], VOL[1], speed / 30), VOL[0], VOL[1]), 0.08);
    if (master) master.gain.setTargetAtTime(ME.sound.on() ? vol : 0, ac.currentTime, 0.06);
    f.progress(
      master
        ? `🎵 ${Math.round(bpm)} beats a minute · ${vol > 0.5 ? "loud" : vol > 0.25 ? "medium" : "soft"}`
        : "Wave to start the music!",
    );

    const floorY = g.h * 0.78;
    const since = (performance.now() - beatAt) / 1000;
    const bounce = ME.calm() ? 0 : Math.max(0, 1 - since * 5);
    g.backdrop({ floor: 0.78, motes: true });
    // curtains at both sides, lit from the front
    for (const side of [0, 1]) {
      const cw = g.w * 0.07;
      const x0 = side ? g.w - cw : 0;
      const cg = c.createLinearGradient(x0, 0, x0 + cw, 0);
      cg.addColorStop(side ? 0 : 1, "rgba(99, 22, 84, 0.55)");
      cg.addColorStop(side ? 1 : 0, "#3D0E37");
      c.fillStyle = cg;
      const edge = side ? x0 : cw;
      const outer = side ? g.w : 0;
      c.beginPath();
      c.moveTo(outer, 0);
      for (let y = 0; y <= g.h; y += 24) c.lineTo(edge + Math.sin(y / 40 + t / 1400) * 5, y);
      c.lineTo(outer, g.h);
      c.fill();
    }
    // the orchestra: a spotlight each, bouncing on the beat
    const left = g.w * 0.17;
    const gap = (g.w * 0.93 - left) / band.length;
    band.forEach((e, i) => {
      const x = left + gap * (i + 0.5);
      const lift = bounce * (i % 2 ? 26 : 18);
      const size = Math.min(130, gap * 0.7);
      const beam = c.createLinearGradient(x, 0, x, floorY);
      beam.addColorStop(0, "rgba(251, 208, 100, 0)");
      beam.addColorStop(1, `rgba(251, 208, 100, ${0.12 + bounce * 0.22})`);
      c.fillStyle = beam;
      c.beginPath();
      c.moveTo(x - size * 0.15, 0);
      c.lineTo(x + size * 0.15, 0);
      c.lineTo(x + size * 0.7, floorY + 8);
      c.lineTo(x - size * 0.7, floorY + 8);
      c.fill();
      g.shadow(x, floorY + 6, size * 0.6, 1 - lift / 60);
      // squash on landing, stretch on the way up
      const st = bounce * 0.14;
      c.save();
      c.translate(x, floorY);
      c.scale(1 - st * 0.5, 1 + st);
      g.emoji(e, 0, -size * 0.55 - lift, size);
      c.restore();
    });
    // the baton trail
    c.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const k = i / trail.length;
      c.strokeStyle = `rgba(243, 163, 40, ${k})`;
      c.lineWidth = 4 + k * 12;
      c.beginPath();
      c.moveTo(trail[i - 1].x, trail[i - 1].y);
      c.lineTo(trail[i].x, trail[i].y);
      c.stroke();
    }
    // the tempo meter on the left: up is fast
    const barH = g.h * 0.56;
    const barY = g.h * 0.1;
    const bx = g.w * 0.07 + 30;
    c.fillStyle = "#FFFFFF";
    c.strokeStyle = "#EADBE5";
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(bx, barY, 34, barH, 17);
    c.fill();
    c.stroke();
    const k = (bpm - BPM[0]) / (BPM[1] - BPM[0]);
    const fill = c.createLinearGradient(0, barY + barH, 0, barY);
    fill.addColorStop(0, "#F3A328");
    fill.addColorStop(1, "#CC3054");
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(bx + 5, barY + 5 + (barH - 10) * (1 - k), 24, (barH - 10) * k, 12);
    c.fill();
    c.fillStyle = "#631654";
    c.font = "700 20px " + ME.FONT;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText("fast", bx + 46, barY + 14);
    c.fillText("slow", bx + 46, barY + barH - 14);
    ME.pill(c, bx + 17, barY + barH + 40, Math.round(bpm) + " beats", { size: 24, color: "#631654" });
  });

  return () => {
    g.stop();
    clearInterval(timer);
    pad.forEach((o) => o.stop());
    if (master) master.disconnect();
  };
}
