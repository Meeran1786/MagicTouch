// Opens every activity on the wall (mouse mode, no camera) and reports any that
// crash, fail to load a file, or try to reach the internet.
//   PORT=8090 node server/index.js &   then   node tests/browser/run-all.cjs
// Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const BASE = process.env.MT_URL || "http://localhost:8090";
const OUT = path.join(__dirname, "out");
const WAIT = +(process.env.MT_WAIT || 2500);
const IGNORE = [/favicon\.ico$/, /AudioContext was not allowed/i, /play\(\) failed because the user didn't interact/i, /NotAllowedError/];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("wallInputMode", "mouse"); } catch (e) { /* ignore */ } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/?mode=wall");
  await page.waitForFunction(() => !!window.MTCatalog);
  const items = await page.evaluate(async () => (await MTCatalog.load()).items.map(i => ({ id: i.id, path: i.path, title: i.title })));
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  const results = [];
  for (const it of items.filter(i => !only || only.test(i.id))) {
    const problems = [];
    const onErr = e => problems.push("crash: " + e.message.split("\n")[0]);
    const onCon = m => { if (m.type() === "error" && !IGNORE.some(r => r.test(m.text()))) problems.push("console: " + m.text().slice(0, 160)); };
    const onReq = r => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) problems.push("internet: " + u.slice(0, 120)); };
    const onRes = r => { if (r.status() >= 400 && !IGNORE.some(x => x.test(r.url()))) problems.push(`missing ${r.status()}: ${r.url().replace(BASE, "")}`); };
    page.on("pageerror", onErr); page.on("console", onCon); page.on("request", onReq); page.on("response", onRes);
    try { await page.goto(BASE + it.path, { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(WAIT); }
    catch (e) { problems.push("load: " + e.message.split("\n")[0]); }
    await page.mouse.click(640, 400).catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, it.id.replace(/\W/g, "_") + ".jpg"), type: "jpeg", quality: 60 }).catch(() => {});
    page.off("pageerror", onErr); page.off("console", onCon); page.off("request", onReq); page.off("response", onRes);
    const uniq = [...new Set(problems)];
    results.push({ id: it.id, title: it.title, ok: !uniq.length, problems: uniq });
    process.stdout.write(uniq.length ? "x" : ".");
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 1));
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length} of ${results.length} activities opened cleanly.`);
  bad.forEach(r => console.log(`  ${r.id}: ${r.problems.slice(0, 4).join(" | ")}`));
  process.exit(bad.length ? 1 : 0);
})();
