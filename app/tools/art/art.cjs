// Original MagicTouch illustrations that replace stock pictures found in the purchased
// code (Vecteezy watermarks, rawpixel, an artist-signed GIF). Drawn from simple shapes
// for MagicTouch; owned by Maqsusi EduTech. Rendered by render.cjs.
const W = (body, vb = "0 0 400 400") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;

exports.mushroom = W(`
<ellipse cx="200" cy="352" rx="120" ry="16" fill="#e9e1dc"/>
<path d="M150 210 Q140 300 132 338 Q200 362 268 338 Q258 300 250 210 Z" fill="#f4ece2"/>
<path d="M150 210 Q146 280 140 336 Q160 344 176 346 Q166 290 168 212 Z" fill="#e5d8c8"/>
<path d="M140 336 Q200 360 262 336 Q250 352 200 356 Q150 352 140 336Z" fill="#8a6a4c" opacity=".55"/>
<path d="M44 196 Q60 70 200 62 Q340 70 356 196 Q330 226 200 224 Q70 226 44 196 Z" fill="#a8673a"/>
<path d="M60 186 Q84 92 200 84 Q300 90 330 150 Q260 110 196 116 Q110 124 60 186Z" fill="#c4834f"/>
<path d="M120 106 Q170 88 220 92" stroke="#e3ab78" stroke-width="10" stroke-linecap="round" fill="none" opacity=".7"/>
<path d="M58 200 Q200 240 342 200 Q330 214 200 222 Q70 214 58 200Z" fill="#7d4a28"/>
<g fill="#7d4a28" opacity=".35"><circle cx="150" cy="150" r="5"/><circle cx="246" cy="132" r="4"/><circle cx="290" cy="170" r="5"/><circle cx="110" cy="172" r="4"/></g>`);

exports.pistachio = W(`
<ellipse cx="200" cy="330" rx="140" ry="16" fill="#ece6dc"/>
<g transform="rotate(-18 200 200)">
<ellipse cx="200" cy="200" rx="110" ry="140" fill="#e8d6b4"/>
<ellipse cx="200" cy="200" rx="110" ry="140" fill="none" stroke="#c8ad83" stroke-width="6"/>
<path d="M200 66 Q236 200 200 336" fill="none" stroke="#b8976a" stroke-width="5"/>
<path d="M150 120 Q200 100 252 120 Q268 200 250 280 Q200 300 150 280 Q132 200 150 120Z" fill="#8fbf4a"/>
<path d="M160 136 Q200 118 240 136 Q252 200 238 262 Q200 278 162 262 Q148 200 160 136Z" fill="#a9d45c"/>
<path d="M176 150 Q200 140 222 150" stroke="#7a4a7a" stroke-width="10" stroke-linecap="round" fill="none" opacity=".55"/>
<path d="M120 120 Q130 90 160 78" stroke="#fff6e6" stroke-width="10" stroke-linecap="round" fill="none" opacity=".6"/>
</g>`);

exports.iceapple = W(
  `
<ellipse cx="200" cy="474" rx="150" ry="18" fill="#ece6e0"/>
<circle cx="200" cy="300" r="150" fill="#2b1a2a"/>
<path d="M60 250 Q120 160 230 160" stroke="#5a3a52" stroke-width="16" stroke-linecap="round" fill="none" opacity=".7"/>
<ellipse cx="200" cy="170" rx="70" ry="26" fill="#6b4a2a"/>
<path d="M200 150 L204 110" stroke="#5b4026" stroke-width="10" stroke-linecap="round"/>
<g transform="translate(200 330)">
  <ellipse cx="-62" cy="10" rx="54" ry="66" fill="#efe8dc"/><ellipse cx="-62" cy="10" rx="54" ry="66" fill="none" stroke="#d8c7b0" stroke-width="5"/>
  <ellipse cx="62" cy="10" rx="54" ry="66" fill="#efe8dc"/><ellipse cx="62" cy="10" rx="54" ry="66" fill="none" stroke="#d8c7b0" stroke-width="5"/>
  <ellipse cx="0" cy="-30" rx="48" ry="58" fill="#f6f1ea"/><ellipse cx="0" cy="-30" rx="48" ry="58" fill="none" stroke="#d8c7b0" stroke-width="5"/>
  <path d="M-80 -20 Q-70 -40 -50 -46M-14 -66 Q0 -76 16 -70M44 -20 Q60 -36 80 -34" stroke="#fff" stroke-width="9" stroke-linecap="round" fill="none"/>
</g>`,
  "0 0 400 500",
);

exports.blueberry = W(`
<ellipse cx="200" cy="356" rx="160" ry="16" fill="#e8e4ee"/>
<path d="M210 80 Q250 40 300 52 Q270 92 214 96Z" fill="#3f9a5a"/><path d="M214 92 Q250 68 288 60" stroke="#2c7a44" stroke-width="4" fill="none"/>
${[
  [140, 250, 78],
  [262, 252, 80],
  [200, 170, 74],
  [200, 300, 60],
]
  .map(
    ([x, y, r]) => `
<circle cx="${x}" cy="${y}" r="${r}" fill="#3b4a8c"/>
<circle cx="${x}" cy="${y}" r="${r}" fill="url(#bloom)"/>
<path d="M${x - 16} ${y - r + 12} l16 12 l16 -12 l-6 18 l-20 0z" fill="#232c5a"/>
<path d="M${x - r * 0.55} ${y - r * 0.2} Q${x - r * 0.4} ${y - r * 0.62} ${x - r * 0.02} ${y - r * 0.7}" stroke="#c7d0f0" stroke-width="7" stroke-linecap="round" fill="none" opacity=".6"/>`,
  )
  .join("")}
<defs><radialGradient id="bloom" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8c9ad4" stop-opacity=".55"/><stop offset="1" stop-color="#1d2552" stop-opacity=".35"/></radialGradient></defs>`);

// Spotted deer (chital), common in Indian forests.
exports.deer = W(
  `
<ellipse cx="200" cy="500" rx="150" ry="16" fill="#ece6e0"/>
<g stroke="#5b3a22" stroke-width="12" stroke-linecap="round">
  <path d="M136 340 L128 488"/><path d="M168 344 L172 488"/><path d="M252 340 L246 488"/><path d="M284 334 L296 486"/>
</g>
<g fill="#3a2414"><rect x="118" y="480" width="22" height="12" rx="4"/><rect x="162" y="480" width="22" height="12" rx="4"/><rect x="236" y="480" width="22" height="12" rx="4"/><rect x="286" y="478" width="22" height="12" rx="4"/></g>
<path d="M104 300 Q110 240 190 240 Q270 236 304 266 Q326 290 312 336 Q260 362 180 360 Q112 356 104 300Z" fill="#c2763c"/>
<path d="M120 330 Q200 356 300 336 Q260 362 180 360 Q130 356 120 330Z" fill="#f4e6d2"/>
<g fill="#fbf2e6">${[
    [150, 270],
    [180, 262],
    [212, 258],
    [244, 262],
    [272, 272],
    [166, 296],
    [198, 290],
    [230, 290],
    [262, 300],
    [140, 304],
    [292, 300],
    [208, 318],
    [178, 320],
    [246, 322],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/>`)
    .join("")}</g>
<path d="M104 292 Q86 280 92 262 Q104 270 112 284Z" fill="#c2763c"/><path d="M92 262 Q88 254 96 252 Q100 262 98 268Z" fill="#fbf2e6"/>
<path d="M284 270 Q300 200 316 160 L344 168 Q330 220 314 290Z" fill="#c2763c"/>
<path d="M300 170 Q320 120 352 126 Q378 132 384 150 Q372 168 346 172 Q324 176 300 170Z" fill="#c2763c"/>
<path d="M372 150 Q384 156 382 162 Q372 166 366 160Z" fill="#2b1a10"/>
<circle cx="340" cy="144" r="6" fill="#2b1a10"/><circle cx="342" cy="142" r="2" fill="#fff"/>
<path d="M318 128 Q300 108 306 96 Q322 106 330 126Z" fill="#a8602c"/>
<g stroke="#7a5230" stroke-width="7" stroke-linecap="round" fill="none">
  <path d="M326 122 Q314 74 330 30"/><path d="M322 92 Q300 80 296 60"/><path d="M328 54 Q346 44 350 26"/>
  <path d="M340 124 Q350 80 380 50"/><path d="M350 96 Q370 92 384 78"/><path d="M366 64 Q362 46 372 30"/>
</g>`,
  "0 0 420 520",
);

// Rose-ringed parakeet (Indian "parrot"), wing angle a in degrees, for the flapping GIF.
exports.parrot = (a = 0, colour = true) => {
  const g = colour
    ? {
        body: "#3fae4a",
        dark: "#2a8a36",
        light: "#8fd86a",
        beak: "#d6283a",
        ring: "#1c1c1c",
        pink: "#e985a8",
        tail: "#2f8f8a",
      }
    : {
        body: "#8a8a8a",
        dark: "#5e5e5e",
        light: "#bdbdbd",
        beak: "#4a4a4a",
        ring: "#1c1c1c",
        pink: "#a8a8a8",
        tail: "#707070",
      };
  return W(
    `
<g transform="translate(270 300) rotate(-10)">
  <path d="M-30 30 Q-120 160 -250 236 Q-150 120 -60 20Z" fill="${g.tail}"/>
  <path d="M-30 30 Q-100 150 -210 230 Q-120 110 -46 22Z" fill="${g.dark}" opacity=".5"/>
  <ellipse cx="0" cy="0" rx="70" ry="54" fill="${g.body}"/>
  <path d="M-60 20 Q0 60 60 22 Q30 50 -20 50Z" fill="${g.light}" opacity=".6"/>
  <circle cx="64" cy="-56" r="44" fill="${g.body}"/>
  <path d="M34 -30 Q64 -6 100 -30" stroke="${g.ring}" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M38 -22 Q64 0 98 -22" stroke="${g.pink}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M100 -64 Q136 -58 128 -26 Q118 -40 100 -40Z" fill="${g.beak}"/>
  <path d="M100 -44 Q116 -36 116 -26 Q104 -30 98 -36Z" fill="#7a1420"/>
  <circle cx="80" cy="-66" r="10" fill="#fff"/><circle cx="82" cy="-66" r="6" fill="#1c1c1c"/><circle cx="84" cy="-68" r="2" fill="#fff"/>
  <g transform="translate(-6 -10) rotate(${a})">
    <path d="M0 0 Q-40 -120 -150 -150 Q-110 -60 -30 20Z" fill="${g.dark}"/>
    <path d="M-10 -6 Q-40 -96 -128 -132 Q-96 -64 -34 4Z" fill="${g.body}"/>
    <path d="M-30 -40 Q-70 -84 -112 -100M-24 -20 Q-66 -50 -100 -64" stroke="${g.light}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
  </g>
  <path d="M20 46 l-6 26 M34 46 l2 26" stroke="#7a6a5a" stroke-width="6" stroke-linecap="round"/>
</g>`,
    "0 0 540 602",
  );
};
