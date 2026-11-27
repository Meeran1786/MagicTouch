// Opens every activity in the engine (mouse mode, no camera), touches it, and reports any
// that crash, fail to load a file, or try to reach the internet.
//   PORT=8090 node server/index.js &   then   npm run test:browser [id-pattern]
// Uses Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const BASE = process.env.MT_URL || "http://localhost:8090";
const OUT = path.join(__dirname, "out");
const WAIT = +(process.env.MT_WAIT || 2500);
const IGNORE = [
  /favicon\.ico$/,
  /AudioContext was not allowed/i,
  /play\(\) failed because the user didn't interact/i,
  /NotAllowedError/,
];
// the first thing a child would touch, by template; the centre of the screen otherwise
const TOUCH = [
  ".ey-card:not([disabled])",
  ".pc-card",
  ".pr-card",
  ".ww-lang",
  ".ps-card",
  ".pq-letter",
  ".cp-one",
  ".bp-balloon",
  ".ss-piece",
  ".pn-white",
  ".sp-spot",
  ".spp-pick",
  ".a3-spin",
  ".mt-card",
  "button.mt-btn",
].join(", ");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("wallInputMode", "mouse");
    } catch {
      /* storage blocked */
    }
  });
  const page = await ctx.newPage();
  const res = await fetch(BASE + "/activities/index.json");
  const items = (await res.json()).map((a) => ({ id: a.id, title: a.title, path: `/engine/?a=${a.id}&wall=1` }));
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  const results = [];
  for (const it of items.filter((i) => !only || only.test(i.id))) {
    const problems = [];
    const onErr = (e) => problems.push("crash: " + e.message.split("\n")[0]);
    const onCon = (m) => {
      if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text())))
        problems.push("console: " + m.text().slice(0, 160));
    };
    const onReq = (r) => {
      const u = r.url();
      if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:"))
        problems.push("internet: " + u.slice(0, 120));
    };
    const onRes = (r) => {
      if (r.status() >= 400 && !IGNORE.some((x) => x.test(r.url())))
        problems.push(`missing ${r.status()}: ${r.url().replace(BASE, "")}`);
    };
    page.on("pageerror", onErr);
    page.on("console", onCon);
    page.on("request", onReq);
    page.on("response", onRes);
    try {
      await page.goto(BASE + it.path, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(WAIT);
      if (!(await page.locator("#mt-area > *").count())) problems.push("empty: the template drew nothing");
    } catch (e) {
      problems.push("load: " + e.message.split("\n")[0]);
    }
    const target = page.locator(TOUCH).first();
    if (await target.isVisible().catch(() => false)) await target.click({ timeout: 2000 }).catch(() => {});
    else await page.mouse.click(640, 400).catch(() => {});
    await page.mouse.move(500, 360, { steps: 6 }).catch(() => {});
    await page.waitForTimeout(600);
    await page
      .screenshot({ path: path.join(OUT, it.id.replace(/\W/g, "_") + ".jpg"), type: "jpeg", quality: 60 })
      .catch(() => {});
    page.off("pageerror", onErr);
    page.off("console", onCon);
    page.off("request", onReq);
    page.off("response", onRes);
    const uniq = [...new Set(problems)];
    results.push({ id: it.id, title: it.title, ok: !uniq.length, problems: uniq });
    process.stdout.write(uniq.length ? "x" : ".");
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 1));
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length} of ${results.length} activities opened cleanly.`);
  bad.forEach((r) => console.log(`  ${r.id}: ${r.problems.slice(0, 4).join(" | ")}`));
  process.exit(bad.length ? 1 : 0);
})();
