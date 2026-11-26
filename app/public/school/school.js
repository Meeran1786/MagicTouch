// MagicTouch School view: one page for the principal, HODs and floor in-charges.
// Shows how every classroom wall is used (time and openings per wall, class, subject
// and activity) and manages the logins. Counts are per wall; nothing about a child.
(() => {
  const TOKEN_KEY = "wallAuthToken", USERNAME_KEY = "wallAuthUsername", DAYS_KEY = "mtSchoolDays";
  const REFRESH_MS = 30000;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const token = () => localStorage.getItem(TOKEN_KEY);
  async function api(method, path, body) {
    const r = await fetch(path, {
      method, cache: "no-store",
      headers: { "Content-Type": "application/json", ...(token() ? { Authorization: "Bearer " + token() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || "The wall server did not answer."); e.status = r.status; throw e; }
    return data;
  }

  // ── formatting ──
  function dur(sec) {
    const m = Math.round(sec / 60);
    if (m < 1) return sec > 0 ? "under 1 min" : "0 min";
    if (m < 60) return m + " min";
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const hours = sec => (sec / 3600).toFixed(sec >= 36000 ? 0 : 1);
  const DAY_FMT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const WEEKDAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });
  const dayDate = d => new Date(d + "T00:00:00Z");
  const fmtDay = d => DAY_FMT.format(dayDate(d));
  function daysBetween(from, to) {
    const out = [];
    for (let t = dayDate(from).getTime(); t <= dayDate(to).getTime(); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
    return out;
  }
  const plural = (n, one, many = one + "s") => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

  // ── state ──
  let CAT = null, LIC = null, data = null, accounts = [], me = null, timer = null;
  let days = [1, 7, 30, 90].includes(+localStorage.getItem(DAYS_KEY)) ? +localStorage.getItem(DAYS_KEY) : 7;
  const wallName = w => w ? (w.label || w.username) : "Removed login";
  const item = id => CAT && CAT.byId[id];
  const levelOf = id => (item(id) || {}).level || "other";
  const levelLabel = k => k === "other" ? "Other" : (CAT.levels.find(l => l.key === k) || { label: k }).label;
  const subjectOf = id => {
    const i = item(id);
    if (!i) return "other";
    return i.source === "wall" ? "early" : i.subject;
  };
  const SUBJECT = { early: "Early years", maths: "Maths", science: "Science", social: "Social", evs: "EVS", other: "Other" };
  const actTitle = id => (item(id) || {}).title || id.replace(/^engine:/, "");

  // ══ sign in ══
  function showAuth(msg) {
    $("svAuth").classList.remove("hidden"); $("svMain").classList.add("hidden");
    $("svError").textContent = msg || "";
  }
  $("svForm").addEventListener("submit", async e => {
    e.preventDefault();
    $("svError").textContent = ""; $("svSubmit").disabled = true;
    try {
      const d = await api("POST", "/api/auth/login", { username: $("svUser").value.trim(), password: $("svPass").value });
      if (d.role !== "school") { await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + d.token } }); throw new Error("This is a classroom wall login. The School view needs a school login."); }
      localStorage.setItem(TOKEN_KEY, d.token); localStorage.setItem(USERNAME_KEY, d.username);
      $("svPass").value = "";
      await start();
    } catch (err) { $("svError").textContent = err.message; }
    finally { $("svSubmit").disabled = false; }
  });
  $("svLogout").addEventListener("click", () => {
    api("POST", "/api/auth/logout").catch(() => {});
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USERNAME_KEY);
    location.reload();
  });

  // ══ tabs ══
  $("svMain").querySelector(".sv-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    document.querySelectorAll(".sv-tabs [data-tab]").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    $("tabUsage").classList.toggle("hidden", b.dataset.tab !== "usage");
    $("tabLogins").classList.toggle("hidden", b.dataset.tab !== "logins");
    $("tabTeams").classList.toggle("hidden", b.dataset.tab !== "teams");
    if (b.dataset.tab === "logins") loadAccounts();
    if (b.dataset.tab === "teams") loadTeams();
  });

  // ══ usage ══
  function drawPeriod() { $("svPeriod").querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(+b.dataset.days === days))); }
  $("svPeriod").addEventListener("click", e => {
    const b = e.target.closest("[data-days]"); if (!b) return;
    days = +b.dataset.days; localStorage.setItem(DAYS_KEY, days); drawPeriod(); loadUsage();
  });

  async function loadUsage() {
    try { data = await api("GET", "/api/school/usage?days=" + days); render(); }
    catch (e) { if (e.status === 401 || e.status === 403) return showAuth(e.status === 403 ? e.message : ""); $("svRange").textContent = "Could not load usage: " + e.message; }
  }

  function sum(rows, key) {
    const m = new Map();
    for (const r of rows) { const k = key(r), v = m.get(k) || { sessions: 0, seconds: 0 }; v.sessions += r.sessions; v.seconds += r.seconds; m.set(k, v); }
    return m;
  }

  function render() {
    const { rows, walls, from, to } = data;
    const byWall = sum(rows, r => r.wall), byApp = sum(rows, r => r.app), byDay = sum(rows, r => r.day);
    const byLevel = sum(rows, r => levelOf(r.app)), bySubject = sum(rows, r => subjectOf(r.app));
    const total = rows.reduce((a, r) => a + r.seconds, 0), opens = rows.reduce((a, r) => a + r.sessions, 0);
    const wallsById = Object.fromEntries(walls.map(w => [w.id, w]));
    // School view logins count as walls only if they were used to run one.
    const activeWalls = walls.filter(w => !w.disabled && (w.role === "wall" || byWall.has(w.id) || w.online));
    const used = [...byWall.keys()].filter(id => wallsById[id]).length;
    const busiest = [...byWall.entries()].sort((a, b) => b[1].seconds - a[1].seconds)[0];

    $("svRange").textContent = from === to ? fmtDay(to) : `${fmtDay(from)} to ${fmtDay(to)}`;

    $("svKpis").innerHTML = [
      ["Walls in use", `${used} of ${activeWalls.length}`, used === activeWalls.length ? "every wall was used" : `${activeWalls.length - used} not used`],
      ["Class time on the walls", hours(total) + " h", dur(total)],
      ["Activities opened", opens.toLocaleString("en-IN"), byApp.size ? plural(byApp.size, "different activity", "different activities") : "none yet"],
      ["Busiest wall", busiest ? esc(wallName(wallsById[busiest[0]])) : "—", busiest ? dur(busiest[1].seconds) : "no use yet"],
    ].map(([k, v, s]) => `<div class="kpi"><small>${k}</small><b>${v}</b><span>${s}</span></div>`).join("");

    // walls right now
    const online = activeWalls.filter(w => w.online);
    $("svLive").innerHTML = `<b>Right now</b>` + (activeWalls.length ? activeWalls.map(w =>
      `<span class="live-chip${w.online ? "" : " off"}"><i></i>${esc(wallName(w))}: ${w.online ? (w.showing ? esc(actTitle(w.showing)) : "menu") : "off"}${w.locked && w.online ? " · locked" : ""}</span>`).join("") : '<span class="empty">No walls yet.</span>')
      + (online.length ? "" : '<span class="empty">No wall is switched on.</span>');

    drawDaily(daysBetween(from, to), byDay);
    hbars($("svByLevel"), [...byLevel.entries()].sort((a, b) => b[1].seconds - a[1].seconds).map(([k, v]) => [levelLabel(k), v]));
    hbars($("svBySubject"), [...bySubject.entries()].sort((a, b) => b[1].seconds - a[1].seconds).map(([k, v]) => [SUBJECT[k] || k, v]));

    // walls table: every wall login, used or not
    const lastDay = new Map();
    rows.forEach(r => { if (!lastDay.get(r.wall) || r.day > lastDay.get(r.wall)) lastDay.set(r.wall, r.day); });
    const topFor = id => {
      const m = sum(rows.filter(r => r.wall === id), r => r.app);
      const t = [...m.entries()].sort((a, b) => b[1].seconds - a[1].seconds)[0];
      return t ? actTitle(t[0]) : "—";
    };
    const wallIds = [...new Set([...activeWalls.map(w => w.id), ...byWall.keys()])];
    wallIds.sort((a, b) => ((byWall.get(b) || {}).seconds || 0) - ((byWall.get(a) || {}).seconds || 0));
    $("svWalls").innerHTML = wallIds.length ? `<table class="t"><thead><tr><th>Wall</th><th class="num">Time</th><th class="num">Openings</th><th>Last used</th><th>Most used</th></tr></thead><tbody>${
      wallIds.map(id => { const w = wallsById[id], v = byWall.get(id) || { sessions: 0, seconds: 0 }, ld = lastDay.get(id);
        return `<tr><td><b>${esc(wallName(w))}</b>${w && w.label ? `<br><small>${esc(w.username)}</small>` : ""}</td><td class="num">${dur(v.seconds)}</td><td class="num">${v.sessions}</td><td>${ld ? (ld === to ? "Today" : fmtDay(ld)) : '<small>Not in this period</small>'}</td><td>${esc(topFor(id))}</td></tr>`; }).join("")
    }</tbody></table>` : '<p class="empty">Add a login for each classroom wall under Logins.</p>';

    const top = [...byApp.entries()].sort((a, b) => b[1].seconds - a[1].seconds).slice(0, 12);
    $("svTop").innerHTML = top.length ? `<table class="t"><thead><tr><th>Activity</th><th>Class</th><th>Subject</th><th class="num">Time</th><th class="num">Openings</th></tr></thead><tbody>${
      top.map(([id, v]) => `<tr><td><b>${esc(actTitle(id))}</b></td><td>${esc(levelLabel(levelOf(id)))}</td><td>${esc(SUBJECT[subjectOf(id)] || subjectOf(id))}</td><td class="num">${dur(v.seconds)}</td><td class="num">${v.sessions}</td></tr>`).join("")
    }</tbody></table>` : '<p class="empty">No activity has been used in this period yet.</p>';
  }

  // Minutes per day, one series (plum), hover for the exact value.
  function drawDaily(dayList, byDay) {
    // Drawn at the box's real width so labels stay readable on a phone.
    const W = Math.max(300, Math.round($("svDaily").clientWidth || 1000)), H = W < 600 ? 200 : 220, L = 44, B = 26, T = 10;
    const vals = dayList.map(d => ((byDay.get(d) || {}).seconds || 0) / 60);
    const max = Math.max(...vals, 0);
    if (!max) { $("svDaily").innerHTML = '<p class="empty">Nothing to show for this period yet.</p>'; return; }
    const step = niceStep(max), top = Math.ceil(max / step) * step;
    const n = dayList.length, slot = (W - L) / n, bw = Math.max(2, Math.min(36, slot - 2));
    const y = v => T + (H - T - B) * (1 - v / top);
    const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    const every = Math.ceil(n / Math.max(3, Math.floor(W / 90)));
    const bars = dayList.map((d, i) => {
      const v = vals[i], x = L + i * slot + (slot - bw) / 2, yy = y(v), h = H - B - yy;
      const s = byDay.get(d) || { sessions: 0, seconds: 0 };
      const tip = `<b>${WEEKDAY.format(dayDate(d))} ${fmtDay(d)}</b>${dur(s.seconds)} · ${plural(s.sessions, "opening")}`;
      const r = Math.min(4, bw / 2, h);
      const path = h > 0 ? `M${x},${H - B}V${yy + r}q0,-${r} ${r},-${r}h${bw - 2 * r}q${r},0 ${r},${r}V${H - B}z` : "";
      return `<g data-tip="${esc(tip)}"><rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${H - T - B}"/>${path ? `<path class="bar" d="${path}"/>` : ""}${
        i % every === 0 ? `<text class="axis" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${n <= 7 ? WEEKDAY.format(dayDate(d)) : fmtDay(d)}</text>` : ""}</g>`;
    }).join("");
    $("svDaily").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutes of class time on the walls for each day">
      ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v === 0 ? "0" : v >= 60 && v % 60 === 0 ? v / 60 + " h" : v + " min"}</text>`).join("")}
      ${bars}</svg>`;
  }
  function niceStep(max) {
    const raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const s = [1, 2, 5, 10].map(k => k * mag).find(k => k >= raw) || 10 * mag;
    return max > 120 ? Math.max(30, Math.ceil(s / 30) * 30) : s;
  }

  function hbars(el, list) {
    if (!list.length) { el.innerHTML = '<p class="empty">Nothing to show for this period yet.</p>'; return; }
    const max = Math.max(...list.map(([, v]) => v.seconds), 1);
    el.innerHTML = `<div class="hbars">${list.map(([name, v]) =>
      `<div class="hb" data-tip="${esc(`<b>${esc(name)}</b>${dur(v.seconds)} · ${plural(v.sessions, "opening")}`)}"><span>${esc(name)}</span><span class="track"><span class="fill" style="width:${(v.seconds / max * 100).toFixed(1)}%"></span></span><span class="v">${dur(v.seconds)}</span></div>`).join("")}</div>`;
  }

  // one tooltip for every chart
  const tip = $("tip");
  document.addEventListener("mousemove", e => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.classList.add("hidden"); return; }
    tip.innerHTML = t.getAttribute("data-tip");
    tip.classList.remove("hidden");
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - r.width - 8, e.clientX + 14) + "px";
    tip.style.top = Math.max(8, e.clientY - r.height - 12) + "px";
  });

  let resizeT = 0;
  addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (data) render(); }, 150); });

  // CSV: one row per day, wall and activity (what the server keeps), for Excel.
  $("svCsv").addEventListener("click", () => {
    if (!data) return;
    const wallsById = Object.fromEntries(data.walls.map(w => [w.id, w]));
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["Date", "Wall", "Login", "Class", "Subject", "Activity", "Openings", "Minutes"].join(",")];
    [...data.rows].sort((a, b) => a.day.localeCompare(b.day) || a.wall - b.wall).forEach(r => {
      const w = wallsById[r.wall];
      lines.push([r.day, q(wallName(w)), q(w ? w.username : ""), q(levelLabel(levelOf(r.app))), q(SUBJECT[subjectOf(r.app)] || ""), q(actTitle(r.app)), r.sessions, (r.seconds / 60).toFixed(1)].join(","));
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" }));
    a.download = `magictouch-usage-${data.from}-to-${data.to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  // ══ logins ══
  async function loadAccounts() {
    try { const d = await api("GET", "/api/school/accounts"); accounts = d.accounts; me = d.me; drawAccounts(); }
    catch (e) { $("svAccounts").innerHTML = `<p class="empty">Could not load logins: ${esc(e.message)}</p>`; }
  }
  function drawAccounts() {
    $("svAccounts").innerHTML = `<table class="t"><thead><tr><th>Name in reports</th><th>Login</th><th>Kind</th><th>Status</th><th></th></tr></thead><tbody>${
      accounts.map(a => `<tr data-id="${a.id}">
        <td><input class="lbl-in" value="${esc(a.label)}" maxlength="60" placeholder="Add a name" aria-label="Name for ${esc(a.username)}" /></td>
        <td>${esc(a.username)}${a.id === me ? " <small>(you)</small>" : ""}</td>
        <td><span class="pill${a.role === "school" ? " school" : ""}">${a.role === "school" ? "School view" : "Classroom wall"}</span></td>
        <td>${a.disabled ? '<span class="pill off">Turned off</span>' : '<span class="pill">On</span>'}</td>
        <td><div class="acts"><button type="button" data-act="pw">New password</button>${a.id === me ? "" : `<button type="button" data-act="toggle">${a.disabled ? "Turn on" : "Turn off"}</button>`}</div></td>
      </tr>`).join("")}</tbody></table>`;
  }
  async function update(id, patch, okMsg) {
    try { await api("POST", "/api/school/accounts/update", { id, ...patch }); msg(okMsg); await loadAccounts(); }
    catch (e) { msg(e.message, true); }
  }
  function msg(text, err) { $("addMsg").textContent = text; $("addMsg").classList.toggle("err", !!err); }
  $("svAccounts").addEventListener("change", e => {
    const inp = e.target.closest(".lbl-in"); if (!inp) return;
    const id = +inp.closest("tr").dataset.id;
    update(id, { label: inp.value }, "Name saved.");
  });
  $("svAccounts").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = +b.closest("tr").dataset.id, a = accounts.find(x => x.id === id);
    if (b.dataset.act === "toggle") return update(id, { disabled: !a.disabled }, a.disabled ? `${a.username} can sign in again.` : `${a.username} is turned off and signed out everywhere.`);
    const pw = genPassword();
    update(id, { password: pw }, `New password for ${a.username}: ${pw}  (write it down; it is shown only now). Their other devices are signed out.`);
  });

  function genPassword() {
    const words = ["mango", "peacock", "tiger", "lotus", "kite", "neem", "river", "monsoon", "banyan", "parrot", "jasmine", "comet"];
    const r = new Uint32Array(3); crypto.getRandomValues(r);
    return `${words[r[0] % words.length]}-${words[r[1] % words.length]}-${100 + (r[2] % 900)}`;
  }
  $("addGen").addEventListener("click", () => { $("addPass").value = genPassword(); });
  $("addRole").addEventListener("change", () => {
    const school = $("addRole").value === "school";
    $("addLabel").placeholder = school ? "Principal, or Science HOD" : "Class 4 B";
    $("addUser").placeholder = school ? "hod-science" : "room-4b";
  });
  $("addForm").addEventListener("submit", async e => {
    e.preventDefault();
    const body = { role: $("addRole").value, label: $("addLabel").value, username: $("addUser").value.trim(), password: $("addPass").value };
    try {
      await api("POST", "/api/school/accounts", body);
      msg(`Added ${body.username}. Password: ${body.password}  (write it down; it is shown only now).`);
      $("addLabel").value = ""; $("addUser").value = ""; $("addPass").value = genPassword();
      await loadAccounts(); loadUsage();
    } catch (err) { msg(err.message, true); }
  });

  // ══ teams ══
  const TEAM_COLORS = ["#631654", "#E96E24", "#2fa86a", "#2f7fc4"];
  let teams = [], mascots = [];
  const tmsg = (t, e) => { $("teamMsg").textContent = t; $("teamMsg").classList.toggle("err", !!e); };
  const mascotImg = t => t.image ? `<img src="${esc(t.image)}" alt="">` : MTCardArt.img(t.mascot);
  async function loadTeams() {
    try { const d = await api("GET", "/api/school/settings"); teams = d.teams.map(t => ({ ...t })); mascots = d.mascots; drawTeams(); }
    catch (e) { tmsg("Could not load teams: " + e.message, true); }
  }
  function drawTeams() {
    $("teamEdit").innerHTML = teams.map((t, i) => `<div class="te" data-i="${i}" style="--c:${TEAM_COLORS[i]}">
        <div class="te-pic">${mascotImg(t)}</div>
        <label>Team ${i + 1}<input class="te-name" value="${esc(t.name)}" maxlength="24" /></label>
        <div class="te-gallery" role="radiogroup" aria-label="Mascot for team ${i + 1}">${mascots.map(m => `<button type="button" data-m="${m}" aria-checked="${!t.image && t.mascot === m}">${MTCardArt.img(m)}</button>`).join("")}</div>
        <label class="te-up">Upload a picture<input type="file" accept="image/png,image/jpeg,image/webp" /></label>
        ${t.image ? '<button type="button" class="link-btn te-clear">Remove uploaded picture</button>' : ""}
      </div>`).join("");
  }
  $("teamEdit").addEventListener("input", e => { const inp = e.target.closest(".te-name"); if (inp) teams[+inp.closest(".te").dataset.i].name = inp.value; });
  $("teamEdit").addEventListener("click", e => {
    const i = +((e.target.closest(".te") || {}).dataset || {}).i;
    const m = e.target.closest("[data-m]");
    if (m) { teams[i].mascot = m.dataset.m; delete teams[i].image; drawTeams(); }
    if (e.target.closest(".te-clear")) { delete teams[i].image; drawTeams(); }
  });
  // Uploaded pictures are shrunk to 240 px in the browser, so they stay small on the wall server.
  $("teamEdit").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const i = +e.target.closest(".te").dataset.i;
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      let url = c.toDataURL("image/webp", 0.85);
      if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png");
      if (url.length > 200 * 1024) url = c.toDataURL("image/jpeg", 0.8);
      if (url.length > 200 * 1024) throw new Error("That picture is too big. Try a smaller one.");
      teams[i].image = url; drawTeams(); tmsg("Picture added. Save teams to use it on the walls.");
    } catch (err) { tmsg(err.message || "Could not read that picture.", true); }
  });
  $("teamSave").addEventListener("click", async () => {
    try { const d = await api("POST", "/api/school/settings", { teams }); teams = d.teams.map(t => ({ ...t })); drawTeams(); tmsg("Saved. Walls show the new teams the next time team play starts."); }
    catch (e) { tmsg(e.message, true); }
  });
  $("teamReset").addEventListener("click", async () => {
    try { const d = await api("POST", "/api/school/settings", { reset: true }); teams = d.teams.map(t => ({ ...t })); drawTeams(); tmsg("Back to the default teams."); }
    catch (e) { tmsg(e.message, true); }
  });

  // ══ boot ══
  async function start() {
    const meInfo = await api("GET", "/api/auth/me");
    if (meInfo.role !== "school") return showAuth("This is a classroom wall login. Sign in with a school login to see the School view.");
    [LIC, CAT] = await Promise.all([api("GET", "/api/licence"), MTCatalog.load()]);
    $("svAuth").classList.add("hidden"); $("svMain").classList.remove("hidden");
    $("svSchool").textContent = LIC.demo ? "Demo licence" : LIC.school;
    $("addPass").value = genPassword();
    drawPeriod();
    await loadUsage();
    clearInterval(timer); timer = setInterval(() => { if (!document.hidden && !$("tabUsage").classList.contains("hidden")) loadUsage(); }, REFRESH_MS);
  }
  (async () => {
    if (!token()) return showAuth();
    try { await start(); }
    catch (e) { if (e.status === 401) { localStorage.removeItem(TOKEN_KEY); showAuth(); } else showAuth(e.message); }
  })();
})();
