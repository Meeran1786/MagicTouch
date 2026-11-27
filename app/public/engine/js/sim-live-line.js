// Live "line" stage (y = mx + c, Gold Standard). Graph paper in Canvas 2D: the red line glides
// to its new slope and intercept, a slope triangle shows "across 1, up m", the y-intercept dot
// pulses, and in the Real look a car drives along the line, tilting with the slope. The target
// line of the current challenge is the green dashed line. Read-outs: slope, intercept, angle.
// Reduced motion: the car parks and the line moves at once. Low-spec: no glow blur.
import { ME } from "/shared/motion-engine.js";

const W = 520,
  H = 520,
  P = ME.PALETTE,
  FONT = ME.FONT;
const S = 24,
  OX = 260,
  OY = 260; // 24 px per unit, origin in the middle, −10 … 10 on both axes
function X(x) {
  return OX + x * S;
}
function Y(y) {
  return OY - y * S;
}

export function line(host, side, opts) {
  const low = ME.lowSpec(),
    calm = ME.calm();
  void opts;

  const meter = document.createElement("div");
  meter.className = "st-card st-meter";
  meter.innerHTML =
    '<div class="st-reads">' +
    '<div class="st-read"><span class="k">Angle with x-axis</span><span class="n"><b data-r="a"></b>°</span></div>' +
    '<div class="st-read st-read--accent"><span class="k">Crosses y-axis at</span><span class="n">y = <b data-r="c"></b></span></div>' +
    '<div class="st-read"><span class="k">Crosses x-axis at</span><span class="n"><b data-r="x"></b></span></div>' +
    "</div>";
  side.appendChild(meter);
  const rx = meter.querySelector('[data-r="x"]'),
    rc = meter.querySelector('[data-r="c"]'),
    ra = meter.querySelector('[data-r="a"]');

  host.innerHTML = "";
  let scale = 1,
    dpr = 1;
  const layers = {};
  let tmp = null;
  const st = ME.stage(host, W, H, function (z) {
    scale = z.scale;
    dpr = z.dpr;
    tmp = null;
    ["real", "diagram"].forEach(function (lk) {
      layers[lk] = ME.layer(z.canvas.width, z.canvas.height);
      const b = layers[lk].getContext("2d");
      b.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      paper(b, lk === "real");
    });
  });
  const cv = st.canvas;
  let c = st.ctx;

  function paper(b, real) {
    b.fillStyle = real ? "#FFFDF8" : "#FFFFFF";
    b.fillRect(0, 0, W, H);
    for (let i = -10; i <= 10; i++) {
      for (let k = 1; k < 5 && real && i < 10; k++) {
        b.strokeStyle = "rgba(120,170,210,.18)";
        b.lineWidth = 1;
        b.beginPath();
        b.moveTo(X(i + k / 5), 0);
        b.lineTo(X(i + k / 5), H);
        b.moveTo(0, Y(i + k / 5));
        b.lineTo(W, Y(i + k / 5));
        b.stroke();
      }
      b.strokeStyle = real ? "rgba(90,140,190,.35)" : P.line;
      b.lineWidth = 1.2;
      b.beginPath();
      b.moveTo(X(i), 0);
      b.lineTo(X(i), H);
      b.moveTo(0, Y(i));
      b.lineTo(W, Y(i));
      b.stroke();
    }
    b.strokeStyle = P.plumDark;
    b.lineWidth = 2.5;
    b.beginPath();
    b.moveTo(0, OY);
    b.lineTo(W, OY);
    b.moveTo(OX, 0);
    b.lineTo(OX, H);
    b.stroke();
    b.fillStyle = P.plumDark;
    b.font = "700 16px " + FONT;
    b.textAlign = "center";
    b.textBaseline = "top";
    for (let i = -8; i <= 8; i += 2) if (i) b.fillText(String(i), X(i), OY + 6);
    b.textAlign = "right";
    b.textBaseline = "middle";
    for (let i = -8; i <= 8; i += 2) if (i) b.fillText(String(i), OX - 8, Y(i));
    b.font = "italic 700 20px " + FONT;
    b.fillText("x", W - 8, OY - 14);
    b.textAlign = "left";
    b.fillText("y", OX + 8, 14);
  }

  const tgt = { m: 0, c: 0, goal: null };
  const cur = { m: 0, c: 0 };
  let look = opts.look === "diagram" ? "diagram" : "real",
    mix = look === "diagram" ? 1 : 0,
    first = true,
    t = 0,
    carX = -8;

  function fullLine(m, k, color, width, dash) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    if (dash) c.setLineDash(dash);
    c.beginPath();
    c.moveTo(X(-11), Y(m * -11 + k));
    c.lineTo(X(11), Y(m * 11 + k));
    c.stroke();
    c.restore();
  }
  function car(x) {
    const y = cur.m * x + cur.c;
    if (y < -10.5 || y > 10.5) return;
    const ang = Math.atan(cur.m);
    c.save();
    c.translate(X(x), Y(y));
    c.rotate(-ang);
    c.fillStyle = "rgba(0,0,0,.18)";
    c.beginPath();
    c.ellipse(0, 1, 26, 4, 0, 0, Math.PI * 2);
    c.fill();
    const body = c.createLinearGradient(0, -30, 0, -6);
    body.addColorStop(0, "#4C8FE0");
    body.addColorStop(1, "#2B62B0");
    c.fillStyle = body;
    c.beginPath();
    c.roundRect(-26, -22, 52, 16, 6);
    c.fill();
    c.beginPath();
    c.roundRect(-14, -34, 28, 14, 6);
    c.fill();
    c.fillStyle = "#CFE6FF";
    c.beginPath();
    c.roundRect(-10, -31, 20, 9, 3);
    c.fill();
    const spin = calm ? 0 : t * 8;
    [-15, 15].forEach(function (wx) {
      c.fillStyle = "#1F1F24";
      c.beginPath();
      c.arc(wx, -5, 7, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#9AA0A8";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(wx + Math.cos(spin) * 4, -5 + Math.sin(spin) * 4);
      c.lineTo(wx - Math.cos(spin) * 4, -5 - Math.sin(spin) * 4);
      c.stroke();
    });
    c.restore();
  }
  function scene(real) {
    c.drawImage(layers[real ? "real" : "diagram"], 0, 0, W, H);
    if (tgt.goal) fullLine(tgt.goal[0], tgt.goal[1], P.green, 5, [14, 10]);
    // glow under the line (not on low-spec)
    if (!low) fullLine(cur.m, cur.c, "rgba(204,48,84,.18)", 14);
    fullLine(cur.m, cur.c, P.magenta, 6);
    // slope triangle from the intercept: across 1, up m
    if (Math.abs(cur.c) < 9.5 && Math.abs(cur.m) >= 0.05) {
      c.save();
      c.fillStyle = "rgba(243,163,40,.22)";
      c.strokeStyle = P.orange;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(X(0), Y(cur.c));
      c.lineTo(X(2), Y(cur.c));
      c.lineTo(X(2), Y(cur.c + 2 * cur.m));
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
      ME.pill(c, X(1), Y(cur.c) + (cur.m >= 0 ? 20 : -20), "across 2", { size: 15, color: P.orange });
      ME.pill(c, X(2) + 48, Y(cur.c + cur.m), (cur.m >= 0 ? "up " : "down ") + fmt(Math.abs(2 * cur.m)), {
        size: 15,
        color: P.orange,
      });
    }
    if (Math.abs(cur.c) < 9.5) {
      // intercept dot, pulsing
      const pulse = calm ? 0 : (Math.sin(t * 3) + 1) / 2;
      c.fillStyle = "rgba(99,22,84," + (0.15 + 0.15 * pulse) + ")";
      c.beginPath();
      c.arc(X(0), Y(cur.c), 14 + 6 * pulse, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = P.plum;
      c.strokeStyle = "#fff";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(X(0), Y(cur.c), 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      ME.pill(c, X(0) - 52, Y(cur.c) - 22, "(0, " + fmt(cur.c) + ")", { size: 15 });
    }
    if (real) car(carX);
    const cc = Math.round(cur.c * 2) / 2;
    ME.pill(c, 120, 34, "y = " + fmt(cur.m) + "x " + (cc < 0 ? "− " + fmt(-cc) : "+ " + fmt(cc)), {
      size: 26,
      weight: 800,
    });
  }
  function fmt(v) {
    const r = Math.round(v * 10) / 10;
    return String(r);
  }

  function frame(dt, now) {
    t = now;
    const r = calm || first ? 1e9 : 9;
    cur.m = ME.ease(cur.m, tgt.m, dt, r);
    cur.c = ME.ease(cur.c, tgt.c, dt, r);
    if (!calm) {
      // drive across the visible part of the line, then come round again
      carX += dt * 2.2 * Math.cos(Math.atan(cur.m));
      if (carX > 10.5 || cur.m * carX + cur.c > 11 || cur.m * carX + cur.c < -11) {
        carX = -10.5;
        // start where the line enters the paper
        for (let k = 0; k < 200 && Math.abs(cur.m * carX + cur.c) > 10 && carX < 10; k++) carX += 0.1;
      }
    } else carX = -6;
    mix = calm ? (look === "diagram" ? 1 : 0) : ME.ease(mix, look === "diagram" ? 1 : 0, dt, 10);
    if (Math.abs(mix - Math.round(mix)) < 0.002) mix = Math.round(mix);
    first = false;
    st.begin(c);
    if (mix === 0) scene(true);
    else if (mix === 1) scene(false);
    else {
      scene(true);
      if (!tmp) tmp = ME.layer(cv.width, cv.height);
      const main = c,
        tc = tmp.getContext("2d");
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.clearRect(0, 0, tmp.width, tmp.height);
      st.begin(tc);
      c = tc;
      scene(false);
      c = main;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = mix;
      c.drawImage(tmp, 0, 0);
      c.globalAlpha = 1;
    }
    rx.textContent =
      Math.abs(cur.m) < 0.05 ? (Math.abs(cur.c) < 0.05 ? "every x" : "never") : "x = " + fmt(-cur.c / cur.m);
    rc.textContent = fmt(cur.c);
    ra.textContent = String(Math.round((Math.atan(cur.m) * 180) / Math.PI));
    cv.setAttribute("aria-label", "Line y = " + fmt(tgt.m) + "x + " + fmt(tgt.c));
  }
  const stopLoop = ME.loop(st.box, frame);
  return {
    update: function (v, o, goal) {
      tgt.m = v.m;
      tgt.c = v.c;
      tgt.goal = goal && goal.line ? goal.line : null;
    },
    setLook: function (lk) {
      look = lk === "diagram" ? "diagram" : "real";
    },
    stop: function () {
      stopLoop();
      st.stop();
      meter.remove();
    },
  };
}
