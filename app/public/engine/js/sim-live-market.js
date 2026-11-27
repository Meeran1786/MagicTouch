// Live "market" stage (supply and demand, Gold Standard). A mango stall at a mandi drawn in
// Canvas 2D: buyers walk in when the price falls and walk away when it rises, each with a
// reaction bubble; the crates fill with the mangoes sellers bring; the price board, read-outs
// and a live price–quantity graph all move in the same frame. Diagram look: animated bars.
// Model (simulate.js): demand D = 100 − 5p, supply S = 10 + 4p. One buyer figure = 5 mangoes.
// Low-spec: fewer mango sprites, no blur. Reduced motion: buyers appear and leave in place.
import { ME } from "/shared/motion-engine.js";

const W = 680,
  H = 420,
  P = ME.PALETTE,
  FONT = ME.FONT;
const GROUND = 318;
const SKIN = ["#8D5524", "#A0663A", "#C68642", "#7A4A24", "#B5774A"];
const CLOTH = [P.magenta, "#2F6DB5", P.green, P.orange, P.plum, "#1E8C93", P.amber];

export function market(host, side, opts) {
  const low = ME.lowSpec(),
    calm = ME.calm();
  const sl = (opts.sliders || [])[0] || { min: 0, max: 20 };
  const Pmax = sl.max || 20;

  // side panel: read-outs and the live price–quantity graph
  const meter = document.createElement("div");
  meter.className = "st-card st-meter";
  meter.innerHTML =
    '<div class="st-reads">' +
    '<div class="st-read"><span class="k">Buyers want (demand)</span><span class="n"><b data-r="D"></b> mangoes</span></div>' +
    '<div class="st-read st-read--accent"><span class="k">Sellers offer (supply)</span><span class="n"><b data-r="S"></b> mangoes</span></div>' +
    '</div><canvas class="st-graph" aria-label="Graph of price against quantity"></canvas>';
  side.appendChild(meter);
  const rD = meter.querySelector('[data-r="D"]'),
    rS = meter.querySelector('[data-r="S"]'),
    graph = ME.graph(meter.querySelector(".st-graph"));

  host.innerHTML = "";
  let scale = 1,
    dpr = 1;
  const layers = {};
  let tmp = null;
  const st = ME.stage(host, W, H, function (z) {
    scale = z.scale;
    dpr = z.dpr;
    tmp = null;
    layers.real = ME.layer(z.canvas.width, z.canvas.height);
    layers.diagram = ME.layer(z.canvas.width, z.canvas.height);
    const r = layers.real.getContext("2d"),
      d = layers.diagram.getContext("2d");
    r.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    d.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    realBack(r);
    diagBack(d);
  });
  const cv = st.canvas;
  let c = st.ctx;

  // ── static art ──
  function realBack(b) {
    let gr = b.createLinearGradient(0, 0, 0, GROUND);
    gr.addColorStop(0, "#FFFFFF");
    gr.addColorStop(1, "#FBEFE3");
    b.fillStyle = gr;
    b.fillRect(0, 0, W, GROUND);
    // far mandi stalls, soft
    b.fillStyle = "rgba(99,22,84,.07)";
    for (let i = 0; i < 6; i++) {
      b.beginPath();
      b.roundRect(10 + i * 70, 200 - (i % 2) * 14, 58, GROUND - 200 + (i % 2) * 14, 6);
      b.fill();
    }
    gr = b.createLinearGradient(0, GROUND, 0, H);
    gr.addColorStop(0, "#E2C59A");
    gr.addColorStop(1, "#C9A06C");
    b.fillStyle = gr;
    b.fillRect(0, GROUND, W, H - GROUND);
    b.fillStyle = "rgba(255,255,255,.35)";
    b.fillRect(0, GROUND, W, 2);
    // stall shadow
    const s = b.createRadialGradient(520, GROUND + 6, 0, 520, GROUND + 6, 170);
    s.addColorStop(0, "rgba(60,30,10,.3)");
    s.addColorStop(1, "rgba(60,30,10,0)");
    b.save();
    b.translate(520, GROUND + 6);
    b.scale(1, 0.08);
    b.translate(-520, -(GROUND + 6));
    b.fillStyle = s;
    b.beginPath();
    b.arc(520, GROUND + 6, 170, 0, Math.PI * 2);
    b.fill();
    b.restore();
    // stall posts and counter
    b.fillStyle = "#8A5A33";
    b.fillRect(376, 110, 10, GROUND - 110);
    b.fillRect(654, 110, 10, GROUND - 110);
    gr = b.createLinearGradient(0, 238, 0, GROUND);
    gr.addColorStop(0, "#B67A47");
    gr.addColorStop(1, "#8C5A31");
    b.fillStyle = gr;
    b.beginPath();
    b.roundRect(366, 238, 306, GROUND - 238, 6);
    b.fill();
    b.fillStyle = "#D29A62";
    b.beginPath();
    b.roundRect(360, 230, 318, 14, 5);
    b.fill();
  }
  function diagBack(b) {
    b.fillStyle = "#FFFFFF";
    b.fillRect(0, 0, W, H);
    b.strokeStyle = P.tint;
    b.lineWidth = 1;
    for (let y = 20; y < H; y += 20) {
      b.beginPath();
      b.moveTo(0, y);
      b.lineTo(W, y);
      b.stroke();
    }
    b.strokeStyle = P.plumDark;
    b.lineWidth = 3;
    b.beginPath();
    b.moveTo(60, 340);
    b.lineTo(640, 340);
    b.stroke();
  }

  // mango sprite
  const mango = ME.layer(40, 40);
  (function () {
    const m = mango.getContext("2d");
    const g = m.createRadialGradient(15, 15, 2, 20, 21, 17);
    g.addColorStop(0, "#FFE27A");
    g.addColorStop(0.55, "#F7B32B");
    g.addColorStop(1, "#E07A1F");
    m.fillStyle = g;
    m.beginPath();
    m.ellipse(20, 22, 15, 13, -0.4, 0, Math.PI * 2);
    m.fill();
    m.fillStyle = "#3E8E41";
    m.beginPath();
    m.ellipse(26, 8, 7, 3, -0.6, 0, Math.PI * 2);
    m.fill();
  })();

  // ── live state ──
  const tgt = { p: sl.value || 10, D: 50, S: 50 };
  const cur = { p: tgt.p, D: 50, S: 50, bars: [50, 50] };
  let look = opts.look === "diagram" ? "diagram" : "real",
    mix = look === "diagram" ? 1 : 0,
    first = true,
    t = 0,
    lastP = tgt.p;
  const buyers = []; // {x, y, tx, ty, state: "in"|"here"|"out", bubble, life, col, skin, phase}
  let seed = 7;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  function slot(i) {
    // two loose rows in front of the stall
    const row = i % 2,
      col = Math.floor(i / 2);
    return [338 - col * 34 - row * 17, GROUND + 24 + row * 36];
  }
  function syncBuyers(n, cheaper) {
    const here = buyers.filter(function (b) {
      return b.state !== "out";
    });
    let said = false;
    function hush() {
      // only one bubble on screen at a time: a new one silences the old ones
      buyers.forEach(function (o) {
        o.bubble = null;
      });
    }
    if (n !== here.length && !first) hush();
    while (here.length < n) {
      const i = here.length,
        s = slot(i),
        b = {
          x: calm ? s[0] : -30 - rnd() * 60,
          y: s[1],
          tx: s[0],
          ty: s[1],
          state: "in",
          i: i,
          col: CLOTH[Math.floor(rnd() * CLOTH.length)],
          skin: SKIN[Math.floor(rnd() * SKIN.length)],
          phase: rnd() * 6,
          // one reaction bubble per price change, so they never pile up
          bubble: first || !cheaper || said ? null : "Cheap! I'll buy",
          life: 1.6,
        };
      if (b.bubble) said = true;
      buyers.push(b);
      here.push(b);
    }
    // the last to arrive leave first
    for (let k = here.length - 1; k >= n; k--) {
      const b = here[k];
      b.state = "out";
      b.tx = -60;
      b.bubble = k === here.length - 1 ? "Too costly!" : null;
      b.life = 1.6;
    }
  }

  function person(b) {
    const walking = b.state !== "here" && !calm,
      sw = walking ? Math.sin(t * 10 + b.phase) * 5 : 0,
      bob = walking ? Math.abs(Math.sin(t * 10 + b.phase)) * 2 : 0,
      x = b.x,
      y = b.y - bob;
    // ground shadow
    c.fillStyle = "rgba(60,30,10,.22)";
    c.beginPath();
    c.ellipse(x, b.y + 1, 14, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#3B2A20";
    c.lineWidth = 5;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x - 4, y - 18);
    c.lineTo(x - 4 + sw, y);
    c.moveTo(x + 4, y - 18);
    c.lineTo(x + 4 - sw, y);
    c.stroke();
    c.fillStyle = b.col;
    c.beginPath();
    c.roundRect(x - 11, y - 50, 22, 34, 9);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.18)";
    c.fillRect(x - 9, y - 48, 6, 28);
    c.fillStyle = b.skin;
    c.beginPath();
    c.arc(x, y - 60, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2B1D16";
    c.beginPath();
    c.arc(x, y - 63, 10, Math.PI, 0);
    c.fill();
    if (b.bubble && b.life > 0) {
      const a = Math.min(1, b.life / 0.4);
      c.globalAlpha = a;
      const good = b.state !== "out";
      ME.pill(c, x, y - 92, b.bubble, {
        size: 15,
        bg: good ? "#E3F4EA" : "#FBE5EA",
        color: good ? "#1F7A4C" : P.magenta,
        line: "none",
      });
      c.globalAlpha = 1;
    }
  }

  function drawReal() {
    c.drawImage(layers.real, 0, 0, W, H);
    // awning that sways a little (ambient life)
    const sway = calm ? 0 : Math.sin(t * 1.3) * 2;
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? P.amber : P.plum;
      c.beginPath();
      const x0 = 366 + i * 51;
      c.moveTo(x0, 96);
      c.lineTo(x0 + 51, 96);
      c.lineTo(x0 + 51, 132 + sway);
      c.quadraticCurveTo(x0 + 25.5, 150 + sway, x0, 132 + sway);
      c.closePath();
      c.fill();
    }
    c.fillStyle = P.plumDark;
    c.beginPath();
    c.roundRect(358, 84, 322, 16, 5);
    c.fill();
    // crates with the mangoes sellers bring (one sprite = 2 mangoes)
    const per = low ? 4 : 2,
      shown = Math.round(cur.S / per);
    for (let k = 0; k < 5; k++) {
      const cx = 380 + k * 58;
      c.fillStyle = "#C99566";
      c.beginPath();
      c.roundRect(cx, 196, 52, 36, 4);
      c.fill();
      c.strokeStyle = "rgba(90,50,20,.45)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(cx, 214);
      c.lineTo(cx + 52, 214);
      c.stroke();
    }
    for (let m = 0; m < shown; m++) {
      const crate = m % 5,
        layerN = Math.floor(m / 5),
        x = 380 + crate * 58 + 4 + (layerN % 3) * 14,
        y = 184 - Math.floor(layerN / 3) * 11 - (layerN % 3) * 2;
      c.drawImage(mango, x, y, 22, 22);
    }
    // seller behind the counter
    c.fillStyle = "#A0663A";
    c.beginPath();
    c.arc(620, 170, 13, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = P.green;
    c.beginPath();
    c.roundRect(604, 184, 32, 46, 10);
    c.fill();
    // price board
    c.save();
    if (!low) {
      c.shadowColor = "rgba(0,0,0,.25)";
      c.shadowBlur = 10;
      c.shadowOffsetY = 4;
    }
    c.fillStyle = "#24332A";
    c.beginPath();
    c.roundRect(452, 120, 128, 70, 10);
    c.fill();
    c.restore();
    c.strokeStyle = "#8A5A33";
    c.lineWidth = 5;
    c.beginPath();
    c.roundRect(452, 120, 128, 70, 10);
    c.stroke();
    c.fillStyle = "#FFFFFF";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "15px " + FONT;
    c.fillText("Mango, each", 516, 138);
    c.font = "800 32px " + FONT;
    c.fillStyle = P.yellow;
    c.fillText("₹" + Math.round(cur.p), 516, 168);
    // buyers, back row first
    buyers
      .slice()
      .sort(function (a, b) {
        return a.y - b.y;
      })
      .forEach(person);
    // labels and the market state
    ME.pill(c, 130, 34, "Buyers want " + Math.round(cur.D), { size: 20, color: P.magenta });
    ME.pill(c, 520, 34, "Sellers offer " + Math.round(cur.S), { size: 20, color: P.orange });
    banner(396);
  }
  function banner(y) {
    const gap = Math.round(cur.D - cur.S);
    let text, bg;
    if (Math.abs(gap) <= 1) {
      text = "Balanced at ₹" + Math.round(cur.p) + ": the market price";
      bg = P.green;
    } else if (gap > 0) {
      text = "Shortage: buyers want " + gap + " more than sellers offer";
      bg = P.magenta;
    } else {
      text = "Surplus: " + -gap + " mangoes left unsold";
      bg = P.orange;
    }
    ME.pill(c, W / 2, y, text, { size: 20, bg: bg, color: "#FFFFFF", line: "none" });
  }
  function drawDiagram() {
    c.drawImage(layers.diagram, 0, 0, W, H);
    const Hs = function (q) {
      return q * 2.5;
    };
    [
      [170, cur.D, P.magenta, "Buyers want"],
      [430, cur.S, P.orange, "Sellers offer"],
    ].forEach(function (b) {
      const h = Hs(b[1]),
        gr = c.createLinearGradient(0, 340 - h, 0, 340);
      gr.addColorStop(0, b[2]);
      gr.addColorStop(1, b[2] + "CC");
      c.save();
      if (!low) {
        c.shadowColor = "rgba(61,14,55,.18)";
        c.shadowBlur = 10;
        c.shadowOffsetY = 4;
      }
      c.fillStyle = gr;
      c.beginPath();
      c.roundRect(b[0], 340 - h, 90, h, [10, 10, 0, 0]);
      c.fill();
      c.restore();
      c.fillStyle = b[2];
      c.font = "800 26px " + FONT;
      c.textAlign = "center";
      c.textBaseline = "bottom";
      c.fillText(String(Math.round(b[1])), b[0] + 45, 334 - h);
      c.fillStyle = P.plumDark;
      c.font = "700 18px " + FONT;
      c.textBaseline = "top";
      c.fillText(b[3], b[0] + 45, 348);
    });
    ME.pill(c, W / 2, 34, "Price ₹" + Math.round(cur.p), { size: 22 });
    banner(396);
  }

  function frame(dt, now) {
    t = now;
    const r = calm || first ? 1e9 : 8;
    cur.p = ME.ease(cur.p, tgt.p, dt, r);
    cur.D = ME.ease(cur.D, tgt.D, dt, r);
    cur.S = ME.ease(cur.S, tgt.S, dt, r);
    // buyers: one figure for every 5 mangoes wanted
    const want = Math.round(tgt.D / 5);
    if (first || Math.round(tgt.p) !== Math.round(lastP)) {
      syncBuyers(want, tgt.p < lastP);
      lastP = tgt.p;
    }
    for (let i = buyers.length - 1; i >= 0; i--) {
      const b = buyers[i];
      b.life -= dt;
      const sp = 150 * dt;
      if (calm) b.x = b.tx;
      else if (Math.abs(b.tx - b.x) > sp) b.x += Math.sign(b.tx - b.x) * sp;
      else b.x = b.tx;
      if (b.state === "in" && b.x === b.tx) b.state = "here";
      if (b.state === "out" && (b.x <= -50 || calm)) buyers.splice(i, 1);
    }
    mix = calm ? (look === "diagram" ? 1 : 0) : ME.ease(mix, look === "diagram" ? 1 : 0, dt, 10);
    if (Math.abs(mix - Math.round(mix)) < 0.002) mix = Math.round(mix);
    first = false;

    st.begin(c);
    if (mix === 0) drawReal();
    else if (mix === 1) drawDiagram();
    else {
      drawReal();
      if (!tmp) tmp = ME.layer(cv.width, cv.height);
      const main = c,
        tc = tmp.getContext("2d");
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.clearRect(0, 0, tmp.width, tmp.height);
      st.begin(tc);
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
    graph.draw({
      xMax: 100,
      yMax: Pmax,
      xLabel: "Quantity (mangoes)",
      yLabel: "Price (₹)",
      lines: [
        { from: [100, 0], to: [0, 20], color: P.magenta },
        { from: [10, 0], to: [90, 20], color: P.orange },
      ],
      points: [
        { x: cur.D, y: cur.p, color: P.magenta },
        { x: cur.S, y: cur.p, color: P.orange },
      ],
      labels: [
        { x: 4, y: 18.6, text: "Demand", color: P.magenta },
        { x: 86, y: 18.6, text: "Supply", color: P.orange, align: "right" },
      ],
    });
    rD.textContent = String(Math.round(cur.D));
    rS.textContent = String(Math.round(cur.S));
    cv.setAttribute(
      "aria-label",
      "Price ₹" + Math.round(cur.p) + ": buyers want " + Math.round(cur.D) + ", sellers offer " + Math.round(cur.S),
    );
  }
  const stopLoop = ME.loop(st.box, frame);
  return {
    update: function (v, o) {
      tgt.p = v.p;
      tgt.D = o.D;
      tgt.S = o.S;
    },
    setLook: function (lk) {
      look = lk === "diagram" ? "diagram" : "real";
    },
    stop: function () {
      stopLoop();
      st.stop();
      graph.stop();
      meter.remove();
    },
  };
}
