// Conductor (early years): a little tune loops while the child conducts the orchestra.
// Raise the pen or hand and the music speeds up; lower it and it slows. Wave with energy and
// it swells; hold still and it plays softly. The instruments bounce on the beat.
// Activity data:
//   emoji: "🎻🎺🥁🎷🪕🎹"     the orchestra
//   melody: [0, 2, 4, 2, 0, 4, 7, 4]   optional, steps of the C major scale, one per eighth note
import { MT, audioCtx } from "../js/kit.js";
import { frame } from "../js/early.js";
import { arcade, emojiList } from "../js/arcade.js";

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
  let trail = [];

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
    if (master) master.gain.setTargetAtTime(vol, ac.currentTime, 0.06);
    f.progress(master ? `🎵 ${Math.round(bpm)} beats a minute · ${vol > 0.5 ? "loud" : vol > 0.25 ? "medium" : "soft"}` : "Wave to start the music!");

    c.clearRect(0, 0, g.w, g.h);
    // the stage floor with a soft shadow
    const floorY = g.h * 0.78;
    c.fillStyle = "rgba(99, 22, 84, 0.06)";
    c.fillRect(0, floorY, g.w, g.h - floorY);
    // the orchestra bounces on the beat
    const since = (performance.now() - beatAt) / 1000;
    const bounce = Math.max(0, 1 - since * 5);
    const gap = g.w / (band.length + 1);
    band.forEach((e, i) => {
      const x = gap * (i + 1);
      const lift = bounce * (i % 2 ? 26 : 18);
      const size = Math.min(130, gap * 0.7) * (1 + bounce * 0.12);
      c.fillStyle = "rgba(61, 14, 55, 0.12)";
      c.beginPath();
      c.ellipse(x, floorY + 6, size * 0.4 * (1 - bounce * 0.2), 9, 0, 0, Math.PI * 2);
      c.fill();
      g.emoji(e, x, floorY - size * 0.55 - lift, size);
    });
    // the baton trail
    c.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const k = i / trail.length;
      c.strokeStyle = `rgba(243, 163, 40, ${k})`;
      c.lineWidth = 4 + k * 10;
      c.beginPath();
      c.moveTo(trail[i - 1].x, trail[i - 1].y);
      c.lineTo(trail[i].x, trail[i].y);
      c.stroke();
    }
    // the tempo bar on the left: up is fast
    const barH = g.h * 0.6;
    const barY = g.h * 0.08;
    c.fillStyle = "#F7F1F5";
    c.beginPath();
    c.roundRect(24, barY, 26, barH, 13);
    c.fill();
    const k = (bpm - BPM[0]) / (BPM[1] - BPM[0]);
    c.fillStyle = "#631654";
    c.beginPath();
    c.roundRect(24, barY + barH * (1 - k), 26, barH * k, 13);
    c.fill();
    c.fillStyle = "#631654";
    c.font = "700 18px Carlito, Calibri, sans-serif";
    c.textAlign = "left";
    c.fillText("fast", 60, barY + 12);
    c.fillText("slow", 60, barY + barH - 4);
  });

  return () => {
    g.stop();
    clearInterval(timer);
    pad.forEach((o) => o.stop());
    if (master) master.disconnect();
  };
}
