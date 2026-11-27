// Checks the one input module (shared/input/pointer.js) end to end in Chromium, with a
// stand-in camera: an IR pen press and lift is a click, a pen drag moves, a hand that
// holds still is a click, and games that follow several pens see every point.
//   PORT=8090 node server/index.js &   then   node tests/browser/input.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = process.env.MT_URL || "http://localhost:8090";
const CAM = { w: 640, h: 480 };

// A camera that sees whatever the test puts in window.__seen (camera pixels).
function fakeCamera(mode) {
  return ({ mode, cam }) => {
    localStorage.setItem("wallInputMode", mode);
    const key = mode === "hand" ? "wallSharedCalibration" : "wallSharedCalibrationIR";
    // camera pixels map straight onto the screen: x / 640, y / 480
    const H = [
      [1 / cam.w, 0, 0],
      [0, 1 / cam.h, 0],
      [0, 0, 1],
    ];
    localStorage.setItem(key, JSON.stringify({ screen: { w: innerWidth, h: innerHeight }, homography: H }));
    window.__seen = [];
    window.MAGICTOUCH_FAKE_TRACKER = {
      settings: { maxArea: 2500 },
      fingers: [],
      finger_x: -1,
      finger_y: -1,
      finger_conf: 0,
      async init() {},
      release() {},
      update() {
        this.fingers = window.__seen.map(([x, y]) => ({ x, y, conf: 1 }));
        const f = this.fingers[0];
        this.finger_x = f ? f.x : -1;
        this.finger_y = f ? f.y : -1;
        this.finger_conf = f ? 1 : 0;
      },
    };
  };
}

async function open(browser, mode) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(fakeCamera(mode), { mode, cam: CAM });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // a bare page with the input module and a button to aim at
  await page.goto(BASE + "/engine/?a=__none__");
  await page.evaluate(async () => {
    document.body.innerHTML =
      '<button id="b" style="position:fixed;left:540px;top:300px;width:200px;height:120px">target</button>';
    window.__log = [];
    for (const t of ["pointerdown", "pointermove", "pointerup", "click"])
      document.getElementById("b").addEventListener(t, (e) => window.__log.push(t + ":" + e.pointerType));
    const input = await import("/shared/input/pointer.js");
    window.__points = [];
    input.onPoints((pts) => (window.__points = pts));
    await input.startInput({ maxPoints: 2 });
  });
  const see = (pts) => page.evaluate((p) => (window.__seen = p), pts);
  const log = () => page.evaluate(() => window.__log.splice(0));
  return { page, see, log, errors };
}
// the button's centre in camera pixels
const AT = [((540 + 100) / 1280) * CAM.w, ((300 + 60) / 720) * CAM.h];

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  const check = async (name, fn) => {
    try {
      await fn();
      console.log("ok   " + name);
    } catch (e) {
      failed++;
      console.log("FAIL " + name + "\n     " + e.message.split("\n")[0]);
    }
  };

  await check("IR pen: press and lift on a button is pointerdown, pointerup and click", async () => {
    const t = await open(browser, "irpen");
    await t.see([AT]);
    await t.page.waitForTimeout(250);
    await t.see([]);
    await t.page.waitForTimeout(400);
    const got = await t.log();
    assert.ok(got.includes("pointerdown:pen"), got.join());
    assert.ok(got.includes("pointerup:pen"), got.join());
    assert.ok(got.includes("click:pen"), got.join());
    assert.deepEqual(t.errors, []);
    await t.page.close();
  });

  await check("IR pen: a flicker of one frame is not a press", async () => {
    const t = await open(browser, "irpen");
    // seen for exactly one frame
    await t.page.evaluate(
      (at) =>
        new Promise((r) => {
          window.__seen = [at];
          requestAnimationFrame(() => {
            window.__seen = [];
            r();
          });
        }),
      AT,
    );
    await t.page.waitForTimeout(400);
    const got = await t.log();
    assert.ok(!got.includes("click:pen"), got.join());
    await t.page.close();
  });

  await check("IR pen: a long drag moves and is not a click", async () => {
    const t = await open(browser, "irpen");
    for (let i = 0; i <= 10; i++) {
      await t.see([[AT[0] - 40 + i * 12, AT[1]]]);
      await t.page.waitForTimeout(40);
    }
    await t.see([]);
    await t.page.waitForTimeout(400);
    const got = await t.log();
    assert.ok(got.includes("pointermove:pen"), got.join());
    assert.ok(!got.includes("click:pen"), got.join());
    await t.page.close();
  });

  await check("Hand: holding still over a button clicks it once", async () => {
    const t = await open(browser, "hand");
    await t.see([AT]);
    await t.page.waitForTimeout(1500);
    const got = await t.log();
    assert.equal(got.filter((x) => x === "click:touch").length, 1, got.join());
    assert.ok(got.includes("pointermove:touch"), got.join());
    await t.page.close();
  });

  await check("Hand: passing over a button does not click it", async () => {
    const t = await open(browser, "hand");
    for (let i = 0; i < 8; i++) {
      await t.see([[AT[0] - 120 + i * 35, AT[1]]]);
      await t.page.waitForTimeout(60);
    }
    await t.see([]);
    await t.page.waitForTimeout(300);
    const got = await t.log();
    assert.ok(!got.includes("click:touch"), got.join());
    await t.page.close();
  });

  await check("Several pens: onPoints reports every point in screen pixels", async () => {
    const t = await open(browser, "irpen");
    await t.see([
      [64, 48],
      [576, 432],
    ]);
    await t.page.waitForTimeout(200);
    const pts = await t.page.evaluate(() => window.__points);
    assert.equal(pts.length, 2);
    assert.ok(Math.abs(pts[0].x - 128) < 1 && Math.abs(pts[0].y - 72) < 1, JSON.stringify(pts));
    assert.ok(Math.abs(pts[1].x - 1152) < 1 && Math.abs(pts[1].y - 648) < 1, JSON.stringify(pts));
    await t.page.close();
  });

  await browser.close();
  console.log(failed ? `${failed} input check(s) failed.` : "All input checks passed.");
  process.exit(failed ? 1 : 0);
})();
