// Renders art.cjs to the exact file names and sizes the activities expect.
//   node tools/art/render.cjs
const path = require("path"),
  fs = require("fs");
const { chromium } = require("playwright");
const art = require("./art.cjs");
const APPS = path.resolve(__dirname, "../../public/apps");

const JOBS = [
  [
    "mushroom",
    [
      "gardenspotter4/images/V3.jpg",
      "gardenlang4/images/V3.jpg",
      "fruitsafari4/assets/photos/V3.jpg",
      "fruitquiz4/assets/photos/V3.jpg",
    ],
    "fruitsafari4/assets/bw/V3.png",
  ],
  [
    "pistachio",
    [
      "gardenspotter3/images/Pista.jpg",
      "gardenlang3/images/Pista.jpg",
      "fruitsafari5/assets/photos/Pista.jpg",
      "fruitquiz5/assets/photos/Pista.jpg",
    ],
    "fruitsafari5/assets/bw/Pista.png",
  ],
  [
    "iceapple",
    [
      "gardenspotter2/images/Ice.jpg",
      "gardenlang2/images/Ice.jpg",
      "fruitsafari3/assets/photos/Ice.jpg",
      "fruitquiz3/assets/photos/Ice.jpg",
    ],
    "fruitsafari3/assets/bw/Ice.png",
  ],
  [
    "blueberry",
    ["fruitsafari1/assets/photos/BlueBerry.jpg", "fruitquiz1/assets/photos/BlueBerry.jpg"],
    "fruitsafari1/assets/bw/BlueBerry.png",
  ],
  ["deer", ["animallang1/images/Deer.jpg"], null],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  async function shot(svg, w, h, file, { grey = false, type = "jpeg", transparent = false } = {}) {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(
      `<html><body style="margin:0;background:${transparent ? "transparent" : "#fff"}"><div style="width:${w}px;height:${h}px;display:grid;place-items:center;${grey ? "filter:grayscale(1)" : ""}">${svg.replace("<svg ", `<svg width="${Math.round(w * 0.86)}" height="${Math.round(h * 0.86)}" `)}</div></body></html>`,
    );
    await p.screenshot({ path: file, type, quality: type === "jpeg" ? 90 : undefined, omitBackground: transparent });
  }
  const { execFileSync } = require("child_process");
  const size = (f) =>
    execFileSync("python3", [
      "-c",
      `from PIL import Image;im=Image.open(${JSON.stringify(f)});print(im.size[0],im.size[1])`,
    ])
      .toString()
      .trim()
      .split(" ")
      .map(Number);
  for (const [name, targets, bw] of JOBS) {
    for (const t of targets) {
      const f = path.join(APPS, t);
      const [w, h] = size(f);
      await shot(art[name], w, h, f);
      console.log("drew", t, w, h);
    }
    if (bw) {
      const f = path.join(APPS, bw);
      const [w, h] = size(f);
      await shot(art[name], w, h, f, { grey: true, type: "png" });
      console.log("drew", bw);
    }
  }
  // Parakeet: 10-frame flapping GIF + grey still, replacing an artist-signed GIF.
  const tmp = fs.mkdtempSync("/tmp/parrot-");
  const frames = [0, 14, 28, 40, 48, 40, 28, 14, 0, -10];
  for (let i = 0; i < frames.length; i++)
    await shot(art.parrot(frames[i]), 540, 602, `${tmp}/f${i}.png`, { type: "png" });
  await shot(art.parrot(20, false), 540, 602, path.join(APPS, "junglesafari5/assets/bw/P1.png"), { type: "png" });
  execFileSync("python3", [
    "-c",
    `
from PIL import Image
fr=[Image.open('${tmp}/f%d.png'%i).convert('RGB').convert('P',palette=Image.ADAPTIVE,colors=64) for i in range(${frames.length})]
fr[0].save('${path.join(APPS, "junglesafari5/assets/gifs/P1.gif")}',save_all=True,append_images=fr[1:],duration=90,loop=0,disposal=2)`,
  ]);
  console.log("drew junglesafari5 P1.gif + P1.png");
  await b.close();
})();
