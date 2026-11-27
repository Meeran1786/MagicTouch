// Live simulation stages (design system §4: "make the invisible visible"). Canvas 2D, one
// requestAnimationFrame loop that drives the picture AND the read-outs and graph in the side
// panel, so a slider moves both in the same frame. Used by simulate.js for the models listed
// in simLive; other models keep their SVG pictures.
//
//   const live = simLive.circuit(picHolder, sideHolder, { look, sliders });
//   live.update(vals, outputs);   // targets; the stage eases towards them
//   live.setLook("real" | "diagram");   // cross-fades between the two looks
//   live.stop();
//
// Ohm's law circuit: electron beads flow from − to + at a speed that follows I = V ÷ R, the
// filament heats from dull red to white with a halo that lights the wall, the resistor warms
// and shimmers with the power it turns into heat (P = V × I), the ammeter needle swings on a
// spring, and every number rolls to its new value.
// Low-spec PCs (window.MAGICTOUCH_LOW_SPEC): 16 beads instead of 40, no blur, 1× pixels.
// Reduced motion: beads and needle hold still, numbers and looks change at once.
import { MT } from "./kit.js";

const W = 680,
  H = 420;
const INK = "#631654",
  INK2 = "#3D0E37",
  FONT = "Carlito, Calibri, 'Segoe UI', sans-serif",
  MONO = "Consolas, Menlo, 'DejaVu Sans Mono', monospace";

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function ease(cur, target, dt, rate) {
  return cur + (target - cur) * (1 - Math.exp(-dt * rate));
}
function layer(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
// a polyline the beads ride along; at(f) gives the point at fraction f (0 … 1) of its length
function track(pts) {
  const segs = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a: a, b: b, s: len, l: l });
    len += l;
  }
  return {
    len: len,
    at: function (f) {
      const d = (((f % 1) + 1) % 1) * len;
      let lo = 0,
        hi = segs.length - 1;
      while (lo < hi) {
        const m = (lo + hi + 1) >> 1;
        if (segs[m].s <= d) lo = m;
        else hi = m - 1;
      }
      const g = segs[lo],
        k = (d - g.s) / g.l;
      return [g.a[0] + (g.b[0] - g.a[0]) * k, g.a[1] + (g.b[1] - g.a[1]) * k];
    },
  };
}
function pill(c, x, y, text, opt) {
  opt = opt || {};
  c.font = (opt.weight || 700) + " " + (opt.size || 18) + "px " + FONT;
  const w = c.measureText(text).width + 28,
    h = (opt.size || 18) + 14;
  c.fillStyle = opt.bg || "#fff";
  c.strokeStyle = opt.line || "rgba(99,22,84,.15)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  c.fill();
  if (opt.line !== "none") c.stroke();
  c.fillStyle = opt.color || INK;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(text, x, y + 1);
}

// 4-band resistor colours, 1 Ω to 99 Ω
const BAND = [
  "#1b1b1b",
  "#7a4a1f",
  "#d22f2f",
  "#f07a1a",
  "#f4d11d",
  "#2c9a3f",
  "#2a62c9",
  "#7d3fb5",
  "#8a8a8a",
  "#f4f4f4",
];
function bands(ohms) {
  const v = Math.round(ohms);
  return v < 10
    ? [BAND[v], BAND[0], "#c8a24a", "#c8a24a"]
    : [BAND[Math.floor(v / 10)], BAND[v % 10], BAND[0], "#c8a24a"];
}
function mixRGB(a, b, k) {
  return (
    "rgb(" +
    Math.round(a[0] + (b[0] - a[0]) * k) +
    "," +
    Math.round(a[1] + (b[1] - a[1]) * k) +
    "," +
    Math.round(a[2] + (b[2] - a[2]) * k) +
    ")"
  );
}
// filament colour along a heating curve: dark → dull red → orange → yellow-white
function hot(k) {
  const stops = [
    [0, [90, 42, 26]],
    [0.25, [210, 70, 27]],
    [0.55, [255, 138, 31]],
    [1, [255, 246, 200]],
  ];
  for (let i = 1; i < stops.length; i++)
    if (k <= stops[i][0])
      return mixRGB(stops[i - 1][1], stops[i][1], (k - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return mixRGB(stops[3][1], stops[3][1], 0);
}

// ── the Ohm's law circuit ──────────────────────────────────────────────────
function circuit(host, side, opts) {
  const low = MT.lowSpec(),
    calm = MT.calm();
  const sl = {};
  (opts.sliders || []).forEach(function (s) {
    sl[s.id] = s;
  });
  const Vmax = (sl.V && sl.V.max) || 12,
    Rmin = (sl.R && sl.R.min) || 1;
  const Imax = Vmax / Rmin,
    Pmax = Vmax * Imax;
  const BEADS = low ? 16 : 40; // design system: at most 40 flow particles

  // electrons leave − and arrive at +; the parts of the path inside the power supply / cell are hidden
  const paths = {
    real: track([
      [170, 332],
      [170, 362],
      [590, 362],
      [590, 70],
      [90, 70],
      [90, 172],
      [90, 250],
      [170, 250],
      [170, 332],
    ]),
    diagram: track([
      [90, 234],
      [90, 362],
      [590, 362],
      [590, 70],
      [90, 70],
      [90, 196],
      [90, 234],
    ]),
  };

  // DOM: the stage keeps 680:420 and fits the holder; a canvas for the picture
  host.innerHTML = "";
  const box = document.createElement("div");
  box.className = "sim-stage";
  const cv = document.createElement("canvas");
  cv.setAttribute("role", "img");
  box.appendChild(cv);
  host.appendChild(box);
  let c = cv.getContext("2d");

  // side panel: rolling read-outs and a live I–V graph
  const meter = document.createElement("div");
  meter.className = "sim-meter";
  meter.innerHTML =
    '<div class="sim-reads">' +
    '<div class="sim-read cur"><span class="k">Current I</span><span class="n"><b data-r="I"></b> A</span></div>' +
    '<div class="sim-read pow"><span class="k">Power P = V × I</span><span class="n"><b data-r="P"></b> W</span></div>' +
    '</div><canvas class="sim-graph" aria-label="Graph of current against voltage"></canvas>';
  side.appendChild(meter);
  const rI = meter.querySelector('[data-r="I"]'),
    rP = meter.querySelector('[data-r="P"]'),
    gcv = meter.querySelector(".sim-graph"),
    g = gcv.getContext("2d");

  let dpr = 1,
    scale = 1,
    gw = 0,
    gh = 0;
  const layers = {};
  let tmp = null;
  function fit() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    const k = Math.min(w / W, h / H);
    box.style.width = Math.floor(W * k) + "px";
    box.style.height = Math.floor(H * k) + "px";
    dpr = low ? 1 : Math.min(2, window.devicePixelRatio || 1);
    scale = k;
    cv.width = Math.round(W * k * dpr);
    cv.height = Math.round(H * k * dpr);
    tmp = null;
    ["real", "diagram"].forEach(function (lk) {
      layers[lk] = { back: layer(cv.width, cv.height), front: layer(cv.width, cv.height) };
      const b = layers[lk].back.getContext("2d"),
        f = layers[lk].front.getContext("2d");
      b.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
      f.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
      if (lk === "real") {
        realBack(b);
        realFront(f);
      } else {
        diagBack(b);
        diagFront(f);
      }
    });
    gw = gcv.clientWidth;
    gh = gcv.clientHeight;
    gcv.width = Math.round(gw * dpr);
    gcv.height = Math.round(gh * dpr);
  }

  // ── static art, drawn once per size ──
  function realBack(b) {
    let gr = b.createLinearGradient(0, 0, 0, 262);
    gr.addColorStop(0, "#FFFFFF");
    gr.addColorStop(1, "#F7F1F5");
    b.fillStyle = gr;
    b.fillRect(0, 0, W, 262);
    gr = b.createLinearGradient(0, 262, 0, H);
    gr.addColorStop(0, "#C99566");
    gr.addColorStop(1, "#8C5A31");
    b.fillStyle = gr;
    b.fillRect(0, 262, W, H - 262);
    b.fillStyle = "rgba(255,255,255,.35)";
    b.fillRect(0, 262, W, 3);
    b.strokeStyle = "rgba(90,50,20,.12)";
    b.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      b.beginPath();
      const y = 278 + i * 16;
      b.moveTo(0, y);
      for (let x = 0; x <= W; x += 40) b.lineTo(x, y + Math.sin(x * 0.02 + i) * 2.5);
      b.stroke();
    }
    // soft ground shadows under what stands on the bench
    function shadow(x, y, rx, ry) {
      const s = b.createRadialGradient(x, y, 0, x, y, rx);
      s.addColorStop(0, "rgba(40,15,5,.35)");
      s.addColorStop(1, "rgba(40,15,5,0)");
      b.save();
      b.translate(x, y);
      b.scale(1, ry / rx);
      b.translate(-x, -y);
      b.fillStyle = s;
      b.beginPath();
      b.arc(x, y, rx, 0, Math.PI * 2);
      b.fill();
      b.restore();
    }
    shadow(134, 336, 120, 12);
    shadow(590, 334, 48, 7);
    // wires: red to +, black back to −, with a highlight along the top
    function wire(d, col, hi) {
      b.lineCap = "round";
      b.lineJoin = "round";
      b.strokeStyle = col;
      b.lineWidth = 9;
      b.stroke(d);
      b.save();
      b.translate(-1.5, -1.5);
      b.strokeStyle = hi;
      b.lineWidth = 2.5;
      b.stroke(d);
      b.restore();
    }
    wire(new Path2D("M90 172V70H590V168"), "#B3222F", "rgba(255,140,145,.6)");
    wire(new Path2D("M590 330V362H170V332"), "#1F1F24", "rgba(125,127,138,.65)");
  }
  function realFront(f) {
    // power supply
    let gr = f.createLinearGradient(0, 172, 0, 332);
    gr.addColorStop(0, "#4A4F5A");
    gr.addColorStop(1, "#2A2D34");
    f.save();
    if (!low) {
      f.shadowColor = "rgba(0,0,0,.25)";
      f.shadowBlur = 14;
      f.shadowOffsetY = 6;
    }
    f.fillStyle = gr;
    f.beginPath();
    f.roundRect(34, 172, 196, 160, 14);
    f.fill();
    f.restore();
    f.fillStyle = "#5C626E";
    f.beginPath();
    f.roundRect(34, 172, 196, 14, 7);
    f.fill();
    f.fillStyle = "#0D1710";
    f.beginPath();
    f.roundRect(52, 198, 120, 50, 6);
    f.fill();
    f.font = "12px " + FONT;
    f.fillStyle = "#B9BEC8";
    f.textAlign = "left";
    f.textBaseline = "alphabetic";
    f.fillText("DC POWER SUPPLY", 52, 274);
    f.fillStyle = "#8C929C";
    f.font = "11px " + FONT;
    f.fillText("0 – " + Vmax + " V", 52, 292);
    function term(x, y, col, edge, t) {
      f.fillStyle = col;
      f.strokeStyle = edge;
      f.lineWidth = 3;
      f.beginPath();
      f.arc(x, y, 11, 0, Math.PI * 2);
      f.fill();
      f.stroke();
      f.fillStyle = "#fff";
      f.font = "700 16px " + FONT;
      f.textAlign = "center";
      f.textBaseline = "middle";
      f.fillText(t, x, y + 1);
    }
    term(90, 178, "#C8242F", "#6D0F17", "+");
    term(170, 326, "#1F1F24", "#000", "−");
    // ammeter face
    f.save();
    if (!low) {
      f.shadowColor = "rgba(61,14,55,.25)";
      f.shadowBlur = 12;
      f.shadowOffsetY = 5;
    }
    f.fillStyle = "#2F333B";
    f.beginPath();
    f.arc(470, 70, 50, 0, Math.PI * 2);
    f.fill();
    f.restore();
    gr = f.createRadialGradient(462, 58, 4, 470, 70, 44);
    gr.addColorStop(0, "#FFFFFF");
    gr.addColorStop(1, "#F3EDE2");
    f.fillStyle = gr;
    f.beginPath();
    f.arc(470, 70, 43, 0, Math.PI * 2);
    f.fill();
    f.strokeStyle = INK2;
    f.lineCap = "round";
    for (let j = 0; j <= 12; j++) {
      const a = ((-120 + 20 * j) * Math.PI) / 180,
        r1 = j % 2 ? 35 : 31;
      f.lineWidth = j % 2 ? 1.5 : 2.5;
      f.beginPath();
      f.moveTo(470 + Math.sin(a) * r1, 70 - Math.cos(a) * r1);
      f.lineTo(470 + Math.sin(a) * 39, 70 - Math.cos(a) * 39);
      f.stroke();
    }
    f.fillStyle = INK2;
    f.font = "700 12px " + FONT;
    f.textAlign = "center";
    f.textBaseline = "middle";
    [0, 4, 8, 12].forEach(function (n) {
      const a = ((-120 + (240 * n) / 12) * Math.PI) / 180;
      f.fillText(String(Math.round((n * Imax) / 12)), 470 + Math.sin(a) * 23, 70 - Math.cos(a) * 23);
    });
    f.font = "700 15px " + FONT;
    f.fillText("A", 470, 98);
    // bulb holder (stands on the bench)
    gr = f.createLinearGradient(565, 0, 615, 0);
    gr.addColorStop(0, "#9AA0A8");
    gr.addColorStop(0.5, "#E4E7EB");
    gr.addColorStop(1, "#8C929C");
    f.fillStyle = gr;
    f.beginPath();
    f.roundRect(572, 258, 36, 36, 4);
    f.fill();
    f.strokeStyle = "rgba(0,0,0,.18)";
    f.lineWidth = 1;
    for (let y = 264; y < 292; y += 6) {
      f.beginPath();
      f.moveTo(572, y);
      f.lineTo(608, y + 3);
      f.stroke();
    }
    f.fillStyle = "#3A3D45";
    f.beginPath();
    f.roundRect(562, 292, 56, 40, 8);
    f.fill();
    f.fillStyle = "rgba(255,255,255,.12)";
    f.fillRect(566, 296, 48, 6);
  }
  function diagBack(b) {
    b.fillStyle = "#FFFFFF";
    b.fillRect(0, 0, W, H);
    b.strokeStyle = "#F7F1F5";
    b.lineWidth = 1;
    for (let x = 0; x <= W; x += 20) {
      b.beginPath();
      b.moveTo(x, 0);
      b.lineTo(x, H);
      b.stroke();
    }
    for (let y = 0; y <= H; y += 20) {
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(W, y);
      b.stroke();
    }
    b.strokeStyle = INK;
    b.lineWidth = 6;
    b.lineJoin = "round";
    b.strokeRect(90, 70, 500, 292);
  }
  function diagFront(f) {
    // cell: long plate +, short thick plate −
    f.fillStyle = "#fff";
    f.fillRect(60, 192, 60, 46);
    f.strokeStyle = INK;
    f.lineCap = "butt";
    f.lineWidth = 5;
    f.beginPath();
    f.moveTo(56, 202);
    f.lineTo(124, 202);
    f.stroke();
    f.lineWidth = 11;
    f.beginPath();
    f.moveTo(74, 228);
    f.lineTo(106, 228);
    f.stroke();
    f.fillStyle = "#CC3054";
    f.font = "700 22px " + FONT;
    f.textAlign = "center";
    f.textBaseline = "middle";
    f.fillText("+", 136, 196);
    f.fillStyle = INK2;
    f.fillText("−", 120, 236);
    // ammeter
    f.fillStyle = "#fff";
    f.strokeStyle = INK;
    f.lineWidth = 5;
    f.beginPath();
    f.arc(470, 70, 30, 0, Math.PI * 2);
    f.fill();
    f.stroke();
    f.fillStyle = INK;
    f.font = "800 28px " + FONT;
    f.fillText("A", 470, 72);
    // legend
    f.fillStyle = "#7FD0FF";
    f.strokeStyle = "#1D5F8F";
    f.lineWidth = 1;
    f.beginPath();
    f.arc(24, 402, 5, 0, Math.PI * 2);
    f.fill();
    f.stroke();
    f.fillStyle = "#6E6170";
    f.font = "15px " + FONT;
    f.textAlign = "left";
    f.fillText("electron: flows from − to +", 36, 403);
  }

  // a glowing bead, drawn once
  const bead = layer(32, 32);
  (function () {
    const b = bead.getContext("2d"),
      gr = b.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(220,245,255,1)");
    gr.addColorStop(0.28, "rgba(127,208,255,1)");
    gr.addColorStop(0.42, "rgba(40,130,200,.9)");
    gr.addColorStop(0.6, "rgba(127,208,255,.25)");
    gr.addColorStop(1, "rgba(127,208,255,0)");
    b.fillStyle = gr;
    b.fillRect(0, 0, 32, 32);
  })();

  // ── live state ──
  const tgt = { V: 1, R: 1, I: 1 };
  const cur = { V: 1, R: 1, I: 1, P: 1, glow: 0, heat: 0 };
  let needle = 0,
    needleV = 0,
    phase = 0,
    look = opts.look === "diagram" ? "diagram" : "real",
    mix = look === "diagram" ? 1 : 0,
    first = true,
    t = 0;

  function beads(lk, alpha) {
    const p = paths[lk];
    c.globalAlpha = alpha;
    for (let i = 0; i < BEADS; i++) {
      const q = p.at(phase + i / BEADS);
      c.drawImage(bead, q[0] - 8, q[1] - 8, 16, 16);
    }
    c.globalAlpha = 1;
  }
  function halo(x, y, r, a) {
    if (a <= 0.01) return;
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,246,200," + 0.95 * a + ")");
    gr.addColorStop(0.35, "rgba(255,210,90," + 0.5 * a + ")");
    gr.addColorStop(1, "rgba(255,176,46,0)");
    c.fillStyle = gr;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  function shimmer(x0, y0, heat) {
    if (calm || heat < 0.05) return;
    c.lineWidth = 2;
    c.lineCap = "round";
    for (let j = 0; j < 3; j++) {
      c.strokeStyle = "rgba(233,110,36," + (0.45 * heat).toFixed(3) + ")";
      c.beginPath();
      const x = x0 - 22 + j * 22,
        rise = 18 + 26 * heat;
      for (let k = 0; k <= 12; k++) {
        const y = y0 - (k / 12) * rise,
          wob = Math.sin(y * 0.22 + t * 7 + j * 2) * (1.5 + 3 * heat) * (k / 12);
        if (k === 0) c.moveTo(x + wob, y);
        else c.lineTo(x + wob, y);
      }
      c.stroke();
    }
  }
  function fmtI(i) {
    return i.toFixed(2);
  }
  function eq() {
    return (
      "I = V ÷ R = " + Math.round(cur.V * 10) / 10 + " ÷ " + Math.round(cur.R * 10) / 10 + " = " + fmtI(cur.I) + " A"
    );
  }

  function drawReal() {
    c.drawImage(layers.real.back, 0, 0, W, H);
    // the bulb lights the wall
    if (cur.glow > 0.02) {
      const gr = c.createRadialGradient(590, 215, 10, 590, 215, 420);
      gr.addColorStop(0, "rgba(255,214,120," + 0.38 * cur.glow + ")");
      gr.addColorStop(1, "rgba(255,214,120,0)");
      c.fillStyle = gr;
      c.fillRect(0, 0, W, 262);
    }
    beads("real", 1);
    c.drawImage(layers.real.front, 0, 0, W, H);
    // LCD and knob
    c.save();
    c.font = "700 32px " + MONO;
    c.textAlign = "right";
    c.textBaseline = "alphabetic";
    c.fillStyle = "#7CFF9B";
    if (!low) {
      c.shadowColor = "rgba(124,255,155,.7)";
      c.shadowBlur = 6;
    }
    c.fillText(cur.V.toFixed(1), 160, 236);
    c.restore();
    c.fillStyle = "rgba(124,255,155,.8)";
    c.font = "11px " + FONT;
    c.textAlign = "left";
    c.fillText("V", 164, 212);
    c.save();
    c.translate(200, 223);
    c.rotate(((-135 + 270 * clamp((cur.V - 1) / (Vmax - 1 || 1), 0, 1)) * Math.PI) / 180);
    c.fillStyle = "#D9DDE3";
    c.strokeStyle = "#8C929C";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 19, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = "#2A2D34";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, -15);
    c.lineTo(0, -5);
    c.stroke();
    c.restore();
    // resistor: warms with the power it turns into heat
    if (cur.heat > 0.03) {
      const gr = c.createRadialGradient(300, 70, 4, 300, 70, 70);
      gr.addColorStop(0, "rgba(233,110,36," + 0.45 * cur.heat + ")");
      gr.addColorStop(1, "rgba(233,110,36,0)");
      c.fillStyle = gr;
      c.beginPath();
      c.arc(300, 70, 70, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = "#C0C4CA";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(238, 70);
    c.lineTo(254, 70);
    c.moveTo(346, 70);
    c.lineTo(362, 70);
    c.stroke();
    const body = c.createLinearGradient(0, 48, 0, 92),
      h = cur.heat;
    body.addColorStop(0, mixRGB([241, 223, 184], [255, 196, 150], h));
    body.addColorStop(0.5, mixRGB([226, 196, 140], [240, 140, 80], h));
    body.addColorStop(1, mixRGB([199, 162, 101], [205, 90, 50], h));
    c.fillStyle = body;
    c.strokeStyle = "#9C7A43";
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(254, 48, 92, 44, 14);
    c.fill();
    c.stroke();
    const bd = bands(cur.R);
    [
      [266, 8, 40],
      [284, 8, 36],
      [300, 8, 36],
      [328, 7, 40],
    ].forEach(function (r, i) {
      c.fillStyle = bd[i];
      c.fillRect(r[0], 70 - r[2] / 2, r[1], r[2]);
    });
    c.fillStyle = "rgba(255,255,255,.35)";
    c.beginPath();
    c.roundRect(258, 50, 84, 7, 3);
    c.fill();
    shimmer(300, 44, cur.heat);
    pill(c, 300, 122, Math.round(cur.R) + " Ω", { size: 18 });
    // ammeter needle
    c.save();
    c.translate(470, 70);
    c.rotate(((-120 + 240 * needle) * Math.PI) / 180);
    c.strokeStyle = "#CC3054";
    c.lineWidth = 3;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, 6);
    c.lineTo(0, -36);
    c.stroke();
    c.restore();
    c.fillStyle = INK2;
    c.beginPath();
    c.arc(470, 70, 5, 0, Math.PI * 2);
    c.fill();
    pill(c, 470, 142, "I = " + fmtI(cur.I) + " A", { bg: INK, color: "#fff", line: "none", size: 20 });
    // bulb: halo, glass, filament
    halo(590, 212, 60 + (low ? 70 : 120) * cur.glow, cur.glow);
    const glass = c.createRadialGradient(578, 196, 4, 590, 212, 48);
    glass.addColorStop(0, "rgba(255,255,255,.95)");
    glass.addColorStop(0.5, cur.glow > 0.05 ? "rgba(255,244,196,.6)" : "rgba(238,243,247,.55)");
    glass.addColorStop(1, "rgba(201,214,223,.55)");
    c.fillStyle = glass;
    c.strokeStyle = "rgba(120,140,155,.6)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(574, 258);
    c.bezierCurveTo(574, 240, 544, 232, 544, 205);
    c.arc(590, 205, 46, Math.PI, 0);
    c.bezierCurveTo(636, 232, 606, 240, 606, 258);
    c.closePath();
    c.fill();
    c.stroke();
    c.save();
    c.strokeStyle = hot(cur.glow);
    c.lineWidth = 2.5;
    c.lineJoin = "round";
    if (!low && cur.glow > 0.1) {
      c.shadowColor = "rgba(255,220,120,1)";
      c.shadowBlur = 16 * cur.glow;
    }
    c.beginPath();
    c.moveTo(580, 256);
    c.lineTo(582, 214);
    for (let k = 0; k <= 6; k++) c.lineTo(582 + k * (16 / 6), 214 + (k % 2 ? -7 : 0));
    c.lineTo(600, 256);
    c.stroke();
    c.restore();
    pill(c, 340, 396, eq(), { size: 20, bg: "rgba(255,255,255,.92)", line: "none" });
  }

  function drawDiagram() {
    c.drawImage(layers.diagram.back, 0, 0, W, H);
    beads("diagram", 1);
    c.drawImage(layers.diagram.front, 0, 0, W, H);
    // resistor zigzag, warming (the white patch hides the beads behind the symbol)
    c.fillStyle = "#fff";
    c.fillRect(244, 50, 112, 40);
    if (cur.heat > 0.03) {
      const gr = c.createRadialGradient(300, 70, 4, 300, 70, 64);
      gr.addColorStop(0, "rgba(233,110,36," + 0.5 * cur.heat + ")");
      gr.addColorStop(1, "rgba(233,110,36,0)");
      c.fillStyle = gr;
      c.beginPath();
      c.arc(300, 70, 64, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = cur.heat > 0.05 ? mixRGB([99, 22, 84], [204, 48, 84], cur.heat) : INK;
    c.lineWidth = 5;
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(240, 70);
    c.lineTo(252, 70);
    for (let k = 0; k < 8; k++) c.lineTo(258 + k * 12, k % 2 ? 84 : 56);
    c.lineTo(348, 70);
    c.lineTo(360, 70);
    c.stroke();
    shimmer(300, 46, cur.heat);
    pill(c, 300, 116, "R = " + Math.round(cur.R) + " Ω", { size: 20 });
    pill(c, 470, 124, "I = " + fmtI(cur.I) + " A", { bg: INK, color: "#fff", line: "none", size: 20 });
    pill(c, 190, 215, "V = " + cur.V.toFixed(1) + " V", { size: 20 });
    // bulb symbol
    halo(590, 215, 44 + (low ? 50 : 90) * cur.glow, cur.glow);
    c.fillStyle = cur.glow > 0.02 ? "rgba(251,208,100," + (0.25 + 0.75 * cur.glow) + ")" : "#fff";
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(590, 215, 30, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(569, 194);
    c.lineTo(611, 236);
    c.moveTo(611, 194);
    c.lineTo(569, 236);
    c.stroke();
    pill(c, 400, 396, eq(), { size: 20, bg: "#F7F1F5", line: "none" });
  }

  function drawGraph() {
    if (!gw) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, gw, gh);
    const L = 44,
      B = gh - 30,
      Rr = gw - 14,
      T = 12;
    const X = function (v) {
        return L + (v / Vmax) * (Rr - L);
      },
      Y = function (i) {
        return B - (i / Imax) * (B - T);
      };
    g.strokeStyle = "#EADBE5";
    g.lineWidth = 1;
    for (let v = 0; v <= Vmax; v += Vmax / 4) {
      g.beginPath();
      g.moveTo(X(v), T);
      g.lineTo(X(v), B);
      g.stroke();
    }
    for (let i = 0; i <= Imax; i += Imax / 4) {
      g.beginPath();
      g.moveTo(L, Y(i));
      g.lineTo(Rr, Y(i));
      g.stroke();
    }
    g.strokeStyle = INK2;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(L, T);
    g.lineTo(L, B);
    g.lineTo(Rr, B);
    g.stroke();
    g.fillStyle = "#6E6170";
    g.font = "13px " + FONT;
    g.textAlign = "center";
    g.textBaseline = "top";
    for (let v = 0; v <= Vmax; v += Vmax / 4) g.fillText(String(v), X(v), B + 4);
    g.fillText("Voltage V (volts)", (L + Rr) / 2, B + 15);
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (let i = 0; i <= Imax; i += Imax / 4) g.fillText(String(Math.round(i)), L - 6, Y(i));
    g.save();
    g.translate(12, (T + B) / 2);
    g.rotate(-Math.PI / 2);
    g.textAlign = "center";
    g.fillText("Current I (A)", 0, 0);
    g.restore();
    // the line I = V ÷ R for this resistor, clipped to the plot
    g.save();
    g.beginPath();
    g.rect(L, T, Rr - L, B - T);
    g.clip();
    g.strokeStyle = "#E96E24";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.lineTo(X(Vmax), Y(Vmax / cur.R));
    g.stroke();
    g.restore();
    const px = X(cur.V),
      py = Y(cur.I);
    g.setLineDash([4, 4]);
    g.strokeStyle = "rgba(99,22,84,.45)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(px, B);
    g.lineTo(px, py);
    g.lineTo(L, py);
    g.stroke();
    g.setLineDash([]);
    const gl = g.createRadialGradient(px, py, 0, px, py, 16);
    gl.addColorStop(0, "rgba(204,48,84,.45)");
    gl.addColorStop(1, "rgba(204,48,84,0)");
    g.fillStyle = gl;
    g.beginPath();
    g.arc(px, py, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#CC3054";
    g.strokeStyle = "#fff";
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(px, py, 7, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#E96E24";
    g.font = "700 14px " + FONT;
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillText("I = V ÷ R  with R = " + Math.round(cur.R) + " Ω", L + 8, T + 4);
  }

  let lastI = "",
    lastP = "";
  function frame(dt, now) {
    t = now;
    // ease every number towards its target (number roll-up); reduced motion jumps straight there
    const r = calm || first ? 1e9 : 9;
    cur.V = ease(cur.V, tgt.V, dt, r);
    cur.R = ease(cur.R, tgt.R, dt, r);
    cur.I = cur.V / cur.R;
    cur.P = cur.V * cur.I;
    cur.glow = Math.pow(clamp(cur.I / Imax, 0, 1), 0.55);
    cur.heat = Math.sqrt(clamp(cur.P / Pmax, 0, 1));
    // ammeter needle on a spring (a little overshoot, then settles)
    const goal = clamp(cur.I / Imax, 0, 1);
    if (calm || first) {
      needle = goal;
      needleV = 0;
    } else {
      needleV += (90 * (goal - needle) - 11 * needleV) * dt;
      needle += needleV * dt;
    }
    // electrons: drift speed follows the current
    if (!calm) phase += (dt * 24 * cur.I) / paths.real.len;
    mix = calm ? (look === "diagram" ? 1 : 0) : ease(mix, look === "diagram" ? 1 : 0, dt, 10);
    if (Math.abs(mix - Math.round(mix)) < 0.002) mix = Math.round(mix);
    first = false;

    c.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (mix === 0) drawReal();
    else if (mix === 1) drawDiagram();
    else {
      // cross-fade: the incoming look also grows from 97 % for a soft hand-over
      drawReal();
      if (!tmp) tmp = layer(cv.width, cv.height);
      const main = c;
      const tc = tmp.getContext("2d");
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.clearRect(0, 0, tmp.width, tmp.height);
      tc.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      c = tc;
      drawDiagram();
      c = main;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = mix;
      const s = 0.97 + 0.03 * mix,
        w = cv.width * s,
        h = cv.height * s;
      c.drawImage(tmp, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
      c.globalAlpha = 1;
    }
    drawGraph();
    const sI = fmtI(cur.I),
      sP = cur.P < 10 ? cur.P.toFixed(2) : cur.P.toFixed(1);
    if (sI !== lastI) rI.textContent = lastI = sI;
    if (sP !== lastP) rP.textContent = lastP = sP;
    cv.setAttribute("aria-label", eq());
  }

  fit();
  let ro = null;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(fit);
    ro.observe(host);
    ro.observe(gcv);
  }
  const stopLoop = MT.loop(box, frame);

  return {
    update: function (v) {
      tgt.V = v.V;
      tgt.R = v.R;
      tgt.I = v.V / v.R;
    },
    setLook: function (lk) {
      look = lk === "diagram" ? "diagram" : "real";
    },
    stop: function () {
      stopLoop();
      if (ro) ro.disconnect();
      meter.remove();
    },
  };
}

export const simLive = { circuit: circuit };
