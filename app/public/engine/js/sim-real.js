// "Real" look for the simulations: a lab bench with a power supply, a colour-banded
// resistor, a moving-needle ammeter, a glowing bulb and flowing electrons; graph paper
// with a slope triangle and a car driving along the line; a mango stall at a mandi with
// buyers and crates. The plain "Diagram" look stays in simulate.js; the school chooses the
// default (School view → Teams & looks) and a teacher can switch on the screen.
// All drawing is our own SVG.

export const simReal = (function () {
  const R = {};
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function f(n, dp) {
    return (+n).toFixed(dp);
  }

  // ── Ohm's law on a lab bench ────────────────────────────────────────────
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
    // 4-band colour code, 1 Ω to 99 Ω
    const v = Math.round(ohms);
    let d1;
    let d2;
    let mul;
    if (v < 10) {
      d1 = v;
      d2 = 0;
      mul = "#c8a24a";
    } // ×0.1 = gold
    else {
      d1 = Math.floor(v / 10);
      d2 = v % 10;
      mul = BAND[0];
    }
    return [BAND[d1], BAND[d2], mul, "#c8a24a"];
  }
  R.circuit = function (v, o) {
    const V = v.V,
      Rr = v.R,
      I = o.I,
      k = clamp(I / 12, 0, 1),
      glow = Math.pow(k, 0.55);
    const fil = k < 0.05 ? "#5a2a1a" : k < 0.3 ? "#d2461b" : k < 0.6 ? "#ff8a1f" : "#fff1a8";
    const wire = "M90 172V70H590V168 M590 292V362H170V332";
    const loop = "M90 172V70H590V230V362H170V250H90Z"; // electrons follow the loop (through the supply)
    const dur = I > 0 ? clamp(18 / I, 0.9, 40) : 0;
    let dots = "";
    if (I > 0)
      for (let i = 0; i < 14; i++)
        dots +=
          '<circle r="4.2" fill="#7fd0ff" stroke="#1d5f8f" stroke-width="1"><animateMotion dur="' +
          dur +
          's" repeatCount="indefinite" begin="-' +
          ((dur * i) / 14).toFixed(2) +
          's" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="' +
          loop +
          '"/></circle>';
    const b = bands(Rr),
      ang = -120 + 240 * clamp(I / 12, 0, 1),
      knob = -135 + 270 * clamp((V - 1) / 11, 0, 1);
    return (
      '<svg viewBox="0 0 680 420" class="real">' +
      '<defs><linearGradient id="bench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6efe6"/><stop offset=".62" stop-color="#efe3d3"/><stop offset=".62" stop-color="#b9824f"/><stop offset="1" stop-color="#8c5a31"/></linearGradient>' +
      '<linearGradient id="psu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f5a"/><stop offset="1" stop-color="#2a2d34"/></linearGradient>' +
      '<radialGradient id="glow"><stop offset="0" stop-color="#fff6c8" stop-opacity="' +
      0.95 * glow +
      '"/><stop offset=".45" stop-color="#ffd25a" stop-opacity="' +
      0.55 * glow +
      '"/><stop offset="1" stop-color="#ffb02e" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="glass" cx=".35" cy=".3"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".5" stop-color="' +
      (k > 0.05 ? "#fff4c4" : "#eef3f7") +
      '" stop-opacity=".55"/><stop offset="1" stop-color="#c9d6df" stop-opacity=".5"/></radialGradient>' +
      '<linearGradient id="res" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1dfb8"/><stop offset=".5" stop-color="#e2c48c"/><stop offset="1" stop-color="#c7a265"/></linearGradient>' +
      '<filter id="lcd"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<rect width="680" height="420" fill="url(#bench)"/>' +
      '<path d="M0 262H680" stroke="#a87445" stroke-width="2" opacity=".5"/>' +
      // wires: copper core shows at the ends; red to +, black back to −
      '<path d="' +
      wire.split(" M")[0] +
      '" fill="none" stroke="#b3222f" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' +
      wire.split(" M")[0] +
      '" fill="none" stroke="#ff8a8f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".55" transform="translate(-1.5 -1.5)"/>' +
      '<path d="M' +
      wire.split(" M")[1] +
      '" fill="none" stroke="#1f1f24" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M' +
      wire.split(" M")[1] +
      '" fill="none" stroke="#7d7f8a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".6" transform="translate(-1.5 -1.5)"/>' +
      dots +
      // power supply
      '<rect x="34" y="172" width="196" height="160" rx="14" fill="url(#psu)"/><rect x="34" y="172" width="196" height="14" rx="7" fill="#5c626e"/>' +
      '<rect x="52" y="198" width="120" height="50" rx="6" fill="#0d1710" stroke="#000" stroke-width="2"/>' +
      '<text x="160" y="236" text-anchor="end" font-family="Consolas,Menlo,monospace" font-size="32" font-weight="700" fill="#7CFF9B" filter="url(#lcd)">' +
      f(V, 1) +
      '</text><text x="168" y="214" font-size="11" fill="#7CFF9B" opacity=".8">V</text>' +
      '<g transform="translate(200 223) rotate(' +
      knob +
      ')"><circle r="19" fill="#d9dde3" stroke="#8c929c" stroke-width="3"/><path d="M0 -15V-5" stroke="#2a2d34" stroke-width="4" stroke-linecap="round"/></g>' +
      '<text x="52" y="274" font-size="12" fill="#b9bec8" font-family="Calibri,Carlito,sans-serif" letter-spacing="1">DC POWER SUPPLY</text><text x="52" y="292" font-size="11" fill="#8c929c" font-family="Calibri,Carlito,sans-serif">0 – 12 V</text>' +
      '<circle cx="90" cy="178" r="11" fill="#c8242f" stroke="#6d0f17" stroke-width="3"/><text x="90" y="183" font-size="14" font-weight="700" text-anchor="middle" fill="#fff">+</text>' +
      '<circle cx="170" cy="326" r="11" fill="#1f1f24" stroke="#000" stroke-width="3"/><text x="170" y="331" font-size="16" font-weight="700" text-anchor="middle" fill="#fff">−</text>' +
      // resistor with colour bands
      '<g transform="translate(300 70)"><path d="M-62 0H-46M46 0H62" stroke="#c0c4ca" stroke-width="5"/>' +
      '<path d="M-46 -15Q-46 -22 -38 -22H-30Q-24 -16 -16 -16H16Q24 -16 30 -22H38Q46 -22 46 -15V15Q46 22 38 22H30Q24 16 16 16H-16Q-24 16 -30 22H-38Q-46 22 -46 15Z" fill="url(#res)" stroke="#9c7a43" stroke-width="1.5"/>' +
      '<rect x="-34" y="-20" width="8" height="40" fill="' +
      b[0] +
      '"/><rect x="-16" y="-16" width="8" height="32" fill="' +
      b[1] +
      '"/><rect x="0" y="-16" width="8" height="32" fill="' +
      b[2] +
      '"/><rect x="28" y="-20" width="7" height="40" fill="' +
      b[3] +
      '"/>' +
      '<rect x="-46" y="-21" width="92" height="7" rx="3" fill="#fff" opacity=".35"/></g>' +
      '<g transform="translate(300 122)"><rect x="-44" y="-17" width="88" height="30" rx="15" fill="#fff" stroke="#e2d6cc"/><text y="5" font-size="18" font-weight="700" text-anchor="middle" fill="#631654" font-family="Calibri,Carlito,sans-serif">' +
      f(Rr, 0) +
      " Ω</text></g>" +
      // ammeter
      '<g transform="translate(470 70)"><circle r="50" fill="#2f333b"/><circle r="43" fill="#fbf8f1"/>' +
      (function () {
        let t = "";
        for (let j = 0; j <= 12; j++) {
          const a = ((-120 + 20 * j) * Math.PI) / 180,
            r1 = j % 2 ? 35 : 31;
          t +=
            '<path d="M' +
            f(Math.sin(a) * r1, 1) +
            " " +
            f(-Math.cos(a) * r1, 1) +
            "L" +
            f(Math.sin(a) * 40, 1) +
            " " +
            f(-Math.cos(a) * 40, 1) +
            '" stroke="#3D0E37" stroke-width="' +
            (j % 2 ? 1.2 : 2) +
            '"/>' +
            (j % 4 === 0
              ? '<text x="' +
                f(Math.sin(a) * 23, 1) +
                '" y="' +
                f(-Math.cos(a) * 23 + 4, 1) +
                '" font-size="10" text-anchor="middle" fill="#3D0E37">' +
                j +
                "</text>"
              : "");
        }
        return t;
      })() +
      '<path d="M-30 18A35 35 0 0 1 30 18" fill="none" stroke="#CC3054" stroke-width="3" opacity=".35" transform="rotate(180)"/>' +
      '<text y="22" font-size="14" font-weight="700" text-anchor="middle" fill="#631654">A</text>' +
      '<g style="transition:transform .5s cubic-bezier(.3,1.4,.5,1)" transform="rotate(' +
      f(ang, 1) +
      ')"><path d="M0 6L0 -38" stroke="#CC3054" stroke-width="3" stroke-linecap="round"/></g><circle r="5" fill="#3D0E37"/></g>' +
      '<g transform="translate(470 144)"><rect x="-54" y="-17" width="108" height="30" rx="15" fill="#631654"/><text y="5" font-size="18" font-weight="700" text-anchor="middle" fill="#fff" font-family="Calibri,Carlito,sans-serif">I = ' +
      f(I, 2) +
      " A</text></g>" +
      // bulb
      '<circle cx="590" cy="214" r="' +
      (60 + 70 * glow) +
      '" fill="url(#glow)"/>' +
      '<path d="M590 168Q552 170 552 212Q552 236 572 252H608Q628 236 628 212Q628 170 590 168Z" fill="url(#glass)" stroke="#9fb0bc" stroke-width="2"/>' +
      '<path d="M578 252V232L584 214M602 252V232L596 214" stroke="#777" stroke-width="2" fill="none"/>' +
      '<path d="M584 214l3 -7 3 7 3 -7 3 7" stroke="' +
      fil +
      '" stroke-width="' +
      (2 + 2 * glow) +
      '" fill="none" stroke-linejoin="round"' +
      (k > 0.05 ? ' filter="url(#lcd)"' : "") +
      "/>" +
      '<rect x="570" y="252" width="40" height="34" rx="4" fill="#b7bcc4"/><path d="M570 260H610M570 268H610M570 276H610" stroke="#8b919b" stroke-width="2"/><rect x="580" y="286" width="20" height="8" rx="3" fill="#2f333b"/>' +
      '<g transform="translate(470 392)"><rect x="-200" y="-18" width="400" height="34" rx="17" fill="#fff" opacity=".92"/><text y="5" font-size="18" text-anchor="middle" fill="#3D0E37" font-family="Calibri,Carlito,sans-serif">I = V ÷ R = ' +
      f(V, 0) +
      " ÷ " +
      f(Rr, 0) +
      ' = <tspan font-weight="700" fill="#631654">' +
      f(I, 2) +
      " A</tspan></text></g>" +
      '<text x="40" y="404" font-size="12" fill="#f6efe6" opacity=".85" font-family="Calibri,Carlito,sans-serif">● electrons flow from − to +</text>' +
      "</svg>"
    );
  };

  // ── y = mx + c on graph paper, with a car on the line ───────────────────
  R.line = function (v, o, goal) {
    const S = 20;
    const X = function (x) {
      return 200 + x * S;
    };
    const Y = function (y) {
      return 200 - y * S;
    };
    const m = v.m;
    const c = v.c;
    let s = '<svg viewBox="0 0 400 400" class="real">';
    s += '<rect width="400" height="400" fill="#fffdf6"/>';
    for (let i = 0; i <= 80; i++) {
      const p = i * 5;
      s +=
        '<path d="M' +
        p +
        " 0V400M0 " +
        p +
        'H400" stroke="' +
        (i % 4 ? "#e9f0f6" : "#cfdde9") +
        '" stroke-width="' +
        (i % 4 ? 0.6 : 1) +
        '"/>';
    }
    s +=
      '<path d="M0 200H392M200 400V8" stroke="#3D0E37" stroke-width="2.2"/><path d="M392 195l8 5-8 5zM195 8l5 -8 5 8z" fill="#3D0E37"/>';
    for (let i = -8; i <= 8; i += 2)
      if (i) {
        s +=
          '<text x="' +
          X(i) +
          '" y="216" font-size="10" text-anchor="middle" fill="#6e6170">' +
          i +
          '</text><text x="190" y="' +
          (Y(i) + 4) +
          '" font-size="10" text-anchor="end" fill="#6e6170">' +
          i +
          "</text>";
      }
    s +=
      '<text x="388" y="190" font-size="14" font-style="italic" fill="#3D0E37">x</text><text x="208" y="16" font-size="14" font-style="italic" fill="#3D0E37">y</text>';
    if (goal && goal.line) {
      const gm = goal.line[0],
        gc = goal.line[1];
      s +=
        '<line x1="' +
        X(-10) +
        '" y1="' +
        Y(gm * -10 + gc) +
        '" x2="' +
        X(10) +
        '" y2="' +
        Y(gm * 10 + gc) +
        '" stroke="#2E7D46" stroke-width="5" stroke-dasharray="12 8" opacity=".8"/>';
    }
    const x1 = -10,
      x2 = 10,
      path = "M" + X(x1) + " " + Y(m * x1 + c) + "L" + X(x2) + " " + Y(m * x2 + c);
    s += '<path d="' + path + '" stroke="#CC3054" stroke-width="5" stroke-linecap="round"/>';
    // slope triangle from x=0 to x=2 (run 2, rise 2m)
    const r0 = Y(c),
      r1 = Y(c + 2 * m);
    if (m !== 0)
      s +=
        '<path d="M' +
        X(0) +
        " " +
        r0 +
        "H" +
        X(2) +
        "V" +
        r1 +
        '" fill="none" stroke="#E96E24" stroke-width="2.5" stroke-dasharray="5 4"/><text x="' +
        X(1) +
        '" y="' +
        (r0 + (m > 0 ? 16 : -8)) +
        '" font-size="12" text-anchor="middle" fill="#E96E24" font-weight="700">run 2</text><text x="' +
        (X(2) + 6) +
        '" y="' +
        ((r0 + r1) / 2 + 4) +
        '" font-size="12" fill="#E96E24" font-weight="700">rise ' +
        2 * m +
        "</text>";
    s +=
      '<circle cx="' +
      X(0) +
      '" cy="' +
      r0 +
      '" r="6" fill="#631654" stroke="#fff" stroke-width="2"/><text x="' +
      (X(0) - 10) +
      '" y="' +
      (r0 - 10) +
      '" font-size="12" text-anchor="end" fill="#631654" font-weight="700">(0, ' +
      c +
      ")</text>";
    // the car drives along the line, tilted to its slope
    s +=
      '<g><g transform="translate(0 -9)"><rect x="-15" y="-7" width="30" height="11" rx="4" fill="#2f7fc4"/><path d="M-8 -7L-4 -14H6L10 -7Z" fill="#9fd0f5" stroke="#2f7fc4" stroke-width="2"/><circle cx="-8" cy="5" r="4.5" fill="#2a2d34"/><circle cx="9" cy="5" r="4.5" fill="#2a2d34"/></g>' +
      '<animateMotion dur="7s" repeatCount="indefinite" rotate="auto" keyPoints="0;1;0" keyTimes="0;.5;1" calcMode="linear" path="' +
      path +
      '"/></g>';
    s +=
      '<rect x="8" y="8" width="200" height="44" rx="10" fill="#fff" stroke="#e2d6cc"/><text x="18" y="39" font-size="25" font-weight="800" fill="#631654">y = ' +
      m +
      "x " +
      (c < 0 ? "− " + -c : "+ " + c) +
      "</text>";
    return s + "</svg>";
  };

  // ── Mango prices at a mandi stall ──────────────────────────────────────
  function mango(x, y, s) {
    return (
      '<g transform="translate(' +
      x +
      " " +
      y +
      ") scale(" +
      s +
      ')"><path d="M0 -9C9 -10 13 -2 11 5C9 11 1 12 -5 9C-11 6 -11 -6 0 -9Z" fill="#f6b21a"/><path d="M-4 -4C-1 -7 4 -7 6 -5" stroke="#fff" stroke-width="2" opacity=".55" fill="none" stroke-linecap="round"/><path d="M1 -9q2 -5 6 -6" stroke="#5a7d2a" stroke-width="2" fill="none"/><path d="M6 -14q6 -2 8 2q-6 2 -8 -2z" fill="#3e9b4f"/></g>'
    );
  }
  function person(x, y, c, h) {
    return (
      '<g transform="translate(' +
      x +
      " " +
      y +
      ')"><circle cx="0" cy="-' +
      (h + 12) +
      '" r="9" fill="#8a5a3c"/><path d="M-9 -' +
      (h + 18) +
      'q9 -8 18 0" fill="#2a1d1a"/><path d="M-12 0V-' +
      (h - 4) +
      "Q-12 -" +
      (h + 4) +
      " 0 -" +
      (h + 4) +
      "Q12 -" +
      (h + 4) +
      " 12 -" +
      (h - 4) +
      'V0Z" fill="' +
      c +
      '"/></g>'
    );
  }
  R.market = function (v, o) {
    const p = v.p,
      D = o.D,
      Sx = o.S,
      eq = Math.abs(D - Sx) <= 1,
      short = D > Sx;
    const buyers = Math.round(D / 10),
      crates = Math.round(Sx / 10),
      cols = ["#CC3054", "#2f7fc4", "#2fa86a", "#E96E24", "#7d3fb5", "#631654"];
    let s =
      '<svg viewBox="0 0 640 400" class="real"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9c2"/><stop offset="1" stop-color="#fff7ea"/></linearGradient></defs>';
    s +=
      '<rect width="640" height="400" fill="url(#sky)"/><rect y="318" width="640" height="82" fill="#d9b98c"/><path d="M0 318H640" stroke="#b8956a" stroke-width="3"/>';
    // stall with awning
    s +=
      '<rect x="330" y="120" width="12" height="200" fill="#8c5a31"/><rect x="610" y="120" width="12" height="200" fill="#8c5a31"/>';
    for (let i = 0; i < 8; i++)
      s +=
        '<path d="M' +
        (320 + i * 38) +
        " 90H" +
        (358 + i * 38) +
        "L" +
        (358 + i * 38) +
        " 128Q" +
        (339 + i * 38) +
        " 142 " +
        (320 + i * 38) +
        ' 128Z" fill="' +
        (i % 2 ? "#F3A328" : "#631654") +
        '"/>';
    s += '<rect x="316" y="78" width="320" height="16" rx="4" fill="#3D0E37"/>';
    s +=
      '<rect x="330" y="250" width="292" height="70" fill="#a8703f"/><rect x="326" y="244" width="300" height="12" rx="3" fill="#c48a52"/>';
    // crates: one per 10 mangoes on offer
    for (let i = 0; i < crates; i++) {
      const cx = 342 + (i % 5) * 56,
        cy = 238 - Math.floor(i / 5) * 44;
      s +=
        '<g><rect x="' +
        cx +
        '" y="' +
        (cy - 30) +
        '" width="50" height="34" rx="3" fill="#c99a5b" stroke="#8c5a31" stroke-width="2"/><path d="M' +
        cx +
        " " +
        (cy - 18) +
        "H" +
        (cx + 50) +
        "M" +
        cx +
        " " +
        (cy - 6) +
        "H" +
        (cx + 50) +
        '" stroke="#8c5a31" stroke-width="1.5"/>' +
        mango(cx + 13, cy - 31, 0.9) +
        mango(cx + 26, cy - 34, 0.9) +
        mango(cx + 38, cy - 31, 0.9) +
        "</g>";
    }
    // price board
    s +=
      '<g transform="translate(476 172)"><rect x="-62" y="-42" width="124" height="70" rx="8" fill="#24352b" stroke="#8c5a31" stroke-width="5"/><text y="-16" font-size="13" text-anchor="middle" fill="#e6efe3" font-family="Calibri,Carlito,sans-serif">Mango, each</text><text y="16" font-size="30" font-weight="700" text-anchor="middle" fill="#fff6c2" font-family="Calibri,Carlito,sans-serif">₹' +
      p +
      "</text></g>";
    // buyers queue: one person per 10 mangoes wanted
    for (let i = 0; i < buyers; i++) {
      const bx = 290 - (i % 5) * 56,
        by = 330 - Math.floor(i / 5) * 26;
      s += person(bx, by, cols[i % cols.length], 44 + ((i * 7) % 14));
    }
    // read-outs
    s +=
      '<g transform="translate(150 40)"><rect x="-130" y="-24" width="260" height="44" rx="22" fill="#fff" stroke="#e2d6cc"/><text y="6" font-size="19" text-anchor="middle" fill="#CC3054" font-weight="700" font-family="Calibri,Carlito,sans-serif">Buyers want ' +
      D +
      " mangoes</text></g>";
    s +=
      '<g transform="translate(476 40)"><rect x="-140" y="-24" width="280" height="44" rx="22" fill="#fff" stroke="#e2d6cc"/><text y="6" font-size="19" text-anchor="middle" fill="#E96E24" font-weight="700" font-family="Calibri,Carlito,sans-serif">Sellers bring ' +
      Sx +
      " mangoes</text></g>";
    const msg = eq
      ? "Balanced! At ₹" + p + " every mango finds a buyer"
      : short
        ? "Shortage: " + (D - Sx) + " more wanted than on offer"
        : "Surplus: " + (Sx - D) + " mangoes left unsold";
    s +=
      '<g transform="translate(320 375)"><rect x="-240" y="-22" width="480" height="40" rx="20" fill="' +
      (eq ? "#2fa86a" : short ? "#CC3054" : "#E96E24") +
      '"/><text y="5" font-size="18" text-anchor="middle" fill="#fff" font-weight="700" font-family="Calibri,Carlito,sans-serif">' +
      msg +
      "</text></g>";
    return s + "</svg>";
  };

  return R;
})();
