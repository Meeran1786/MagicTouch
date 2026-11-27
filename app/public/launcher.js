// MagicTouch launcher: the wall (projector PC) and the phone remote, in the Studio look.
// One page, two modes: "wall" on a PC, "remote" on a phone (force with ?mode=wall|remote).
// Both sign in with the school login for the classroom and share one state on the
// wall server: which activity is showing, whether the teacher locked the wall, and
// one-shot commands such as "calibrate". Nothing about individual children is stored.
import { loadCatalog } from "/shared/catalog.js";
import { cardArt } from "/shared/studio/card-art.js";
import { teams } from "./teams.js";
const POLL_MS = 1500;
const TOKEN_KEY = "wallAuthToken",
  USERNAME_KEY = "wallAuthUsername";
const RECENT_KEY = "mtRecent",
  PLAY_MODE_KEY = "wallRemotePlayMode";
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const svg = (name, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// ── API ──────────────────────────────────────────────────────────────
const token = () => localStorage.getItem(TOKEN_KEY);
function setSession(t, u) {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(USERNAME_KEY, u);
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}
let ROLE = "wall";
async function api(method, path, body, extra = {}) {
  const r = await fetch(path, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: "Bearer " + token() } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data.error || "The wall server did not answer.");
    e.status = r.status;
    throw e;
  }
  return data;
}
// The wall says it is the wall, so the School view can tell which walls are switched on
// and stop counting time when a wall goes off. The phone polls without it.
const getState = () => api("GET", "/api/state", undefined, mode === "wall" ? { "X-MT-Client": "wall" } : {});
const setState = (patch) => api("POST", "/api/state", patch);

function detectMode() {
  const forced = new URLSearchParams(location.search).get("mode");
  if (forced === "wall" || forced === "remote") {
    localStorage.setItem("wallModeOverride", forced);
    return forced;
  }
  const saved = localStorage.getItem("wallModeOverride");
  if (saved === "wall" || saved === "remote") return saved;
  return matchMedia("(pointer: coarse)").matches && innerWidth <= 820 ? "remote" : "wall";
}
const mode = detectMode();
function showView(id) {
  ["authView", "wallView", "remoteView"].forEach((v) => $(v).classList.toggle("hidden", v !== id));
}

// ── catalogue + licence ─────────────────────────────────────────────
let CAT = null,
  LICENCE = null,
  TEAMS = null;
const licensed = (key) =>
  LICENCE && (LICENCE.levels === "all" || (Array.isArray(LICENCE.levels) && LICENCE.levels.includes(key)));
const levelsShown = () => CAT.levels.filter((l) => licensed(l.key));
const itemsFor = (key) => CAT.items.filter((i) => i.level === key);
const levelLabel = (key) => (CAT.levels.find((l) => l.key === key) || { label: key }).label;
const itemLabel = (id) => (id === "menu" || !CAT.byId[id] ? "Menu" : CAT.byId[id].title);
function subjectsOf(key) {
  const order = [],
    seen = new Set();
  itemsFor(key).forEach((i) => {
    if (!seen.has(i.subject)) {
      seen.add(i.subject);
      order.push(i.subject);
    }
  });
  return order;
}

// ══════════════════════════ SIGN IN ═════════════════════════════════
let isSignup = false;
async function showAuth() {
  showView("authView");
  let cfg = { signup: false, passwordMin: 8 };
  try {
    cfg = await api("GET", "/api/auth/config");
  } catch (e) {
    /* offline: login only */
  }
  $("authToggleRow").classList.toggle("hidden", !cfg.signup);
  if (cfg.signup && !isSignup) toggleSignup(true);
  $("authPassword").minLength = cfg.passwordMin;
}
function toggleSignup(on) {
  isSignup = on;
  $("authTitle").textContent = on ? "Set up this wall" : "Sign in to this wall";
  $("authSub").textContent = on
    ? "Create the school's first login, for example office. It opens the School view, where you can add a login for every classroom wall. Use at least 8 characters for the password."
    : "Use the school login for this classroom. Sign in with the same login on your phone to control the wall.";
  $("authSubmit").textContent = on ? "Create login" : "Sign in";
  $("authToggleBtn").textContent = on ? "I already have a login" : "Set up the school's first login";
  $("authPassword").autocomplete = on ? "new-password" : "current-password";
  $("authError").textContent = "";
}
$("authToggleBtn").addEventListener("click", () => toggleSignup(!isSignup));
$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("authError").textContent = "";
  $("authSubmit").disabled = true;
  try {
    const d = await api("POST", isSignup ? "/api/auth/signup" : "/api/auth/login", {
      username: $("authUsername").value.trim(),
      password: $("authPassword").value,
    });
    setSession(d.token, d.username);
    ROLE = d.role || "wall";
    $("authPassword").value = "";
    await startApp();
  } catch (err) {
    $("authError").textContent = err.message;
  } finally {
    $("authSubmit").disabled = false;
  }
});
function logout() {
  api("POST", "/api/auth/logout").catch(() => {});
  clearSession();
  location.reload();
}

// ══════════════════════════ WALL ════════════════════════════════════
function startWall() {
  showView("wallView");
  const body = $("wallBody"),
    frame = $("appFrame"),
    home = $("homeBtn");
  $("wallUsername").textContent = localStorage.getItem(USERNAME_KEY) || "";
  $("schoolViewLink").classList.toggle("hidden", ROLE !== "school");
  $("schoolChip").textContent = LICENCE.demo ? "Demo licence" : LICENCE.school;
  $("licenceLine").textContent = LICENCE.demo
    ? "Demo licence: every class is shown"
    : `${LICENCE.school} · ${levelsShown().length} classes licensed${LICENCE.validUntil ? " until " + LICENCE.validUntil : ""}`;

  let route = { screen: "home" },
    currentApp = "menu",
    lastTs = 0,
    lastCmdTs = 0,
    lastGameTs = 0,
    locked = false,
    calibrating = false;

  // ── team play ──
  const teamUI = teams.wall({
    bar: $("teamBar"),
    celebrate: $("celebrate"),
    teams: () => TEAMS,
    send: async (g) => {
      const prev = teamUI.game;
      teamUI.render(g, prev);
      try {
        const s = await setState({ game: g });
        lastGameTs = s.gameTs;
      } catch (e) {
        /* the next poll reconciles */
      }
    },
  });
  let teamN = 2;
  function drawTeamSheet() {
    $("teamCount")
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.n === teamN)));
    $("teamPreview").innerHTML = TEAMS.slice(0, teamN)
      .map((t, i) => `<span style="--c:${teams.COLORS[i]}"><i>${teams.mascot(t)}</i>${esc(t.name)}</span>`)
      .join("");
    $("teamStart").textContent = teamUI.game.on ? "Start a new game" : "Start team play";
  }
  $("teamsBtn").addEventListener("click", async () => {
    TEAMS = await teams.load(api);
    drawTeamSheet();
    $("teamSheet").classList.remove("hidden");
  });
  $("teamCount").addEventListener("click", (e) => {
    const b = e.target.closest("[data-n]");
    if (b) {
      teamN = +b.dataset.n;
      drawTeamSheet();
    }
  });
  $("teamCancel").addEventListener("click", () => $("teamSheet").classList.add("hidden"));
  $("teamSheet").addEventListener("click", (e) => {
    if (e.target.id === "teamSheet") $("teamSheet").classList.add("hidden");
  });
  $("teamStart").addEventListener("click", () => {
    $("teamSheet").classList.add("hidden");
    startGame();
  });
  async function startGame() {
    const g = teams.rules.start(teamN);
    teamUI.render(g, null);
    try {
      lastGameTs = (await setState({ game: g })).gameTs;
    } catch (e) {
      /* ignore */
    }
  }

  // input device + calibration (shared with every activity through localStorage)
  const inputMode = () => {
    const m = localStorage.getItem("wallInputMode");
    return m === "hand" || m === "mouse" ? m : "irpen";
  };
  const calKey = () =>
    ({ hand: "wallSharedCalibration", mouse: "wallSharedCalibrationMouse", irpen: "wallSharedCalibrationIR" })[
      inputMode()
    ];
  function isCalibrated() {
    if (inputMode() === "mouse") return true;
    try {
      const d = JSON.parse(localStorage.getItem(calKey()) || "null");
      return !!(d && d.homography && d.screen);
    } catch (e) {
      return false;
    }
  }
  function drawPenChip() {
    const m = inputMode(),
      ok = isCalibrated();
    $("penChip").querySelector("i").className = ok ? "" : "warn";
    $("penChip").querySelector("span").textContent =
      m === "mouse"
        ? "Mouse or touch"
        : `${m === "hand" ? "Hand" : "IR pen"} · ${ok ? "calibrated" : "not calibrated"}`;
  }
  const tick = () => {
    $("clockChip").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 15000);

  // ── screens ──
  function crumb(parts) {
    $("crumb").innerHTML = parts
      .map(
        (p, i) =>
          (i ? '<span class="sep">›</span>' : "") +
          (p.go
            ? `<button type="button" data-go='${esc(JSON.stringify(p.go))}'>${esc(p.label)}</button>`
            : `<span>${esc(p.label)}</span>`),
      )
      .join("");
  }
  $("crumb").addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) go(JSON.parse(b.dataset.go));
  });
  $("brandBtn").addEventListener("click", () => go({ screen: "home" }));

  function recent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter(
        (id) => CAT.byId[id] && licensed(CAT.byId[id].level),
      );
    } catch (e) {
      return [];
    }
  }
  function remember(id) {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent().filter((x) => x !== id)].slice(0, 5)));
  }

  function renderHome() {
    crumb([{ label: "Namaste" + (LICENCE.demo ? "" : ", " + LICENCE.school.split(",")[0]) }]);
    const rec = recent(),
      last = rec[0] && CAT.byId[rec[0]];
    const shown = levelsShown(),
      early = shown.filter((l) => l.group === "early"),
      classes = shown.filter((l) => l.group === "classes"),
      inter = shown.filter((l) => l.group === "inter");
    const count = (k) => itemsFor(k).length;
    const n = (k) => (count(k) === 1 ? "1 activity" : count(k) + " activities");
    const levelBtn = (l, inner, extra = "") =>
      `<button type="button" class="tap ${extra}" data-level="${l.key}" ${count(l.key) ? "" : 'aria-disabled="true"'}>${inner}</button>`;
    body.innerHTML = `<div class="home">
        <section class="cont">
          ${
            last
              ? `<div class="cont-art">${cardArt.html(last)}</div><small>Continue where you stopped</small><h2>${esc(last.title)}</h2><small>${esc(levelLabel(last.level))} · ${esc(CAT.subjectLabel(last.subject))} · ${esc(last.kind)}</small>`
              : `<small>Welcome to MagicTouch</small><h2>Pick a class to begin</h2><small>Your last activities will show here.</small>`
          }
          <div class="recent">${rec.length > 1 ? "<b>Recently used</b>" : ""}${rec
            .slice(1, 4)
            .map(
              (id) =>
                `<button type="button" data-open="${esc(id)}"><span>${cardArt.img(CAT.byId[id].icon)}</span>${esc(CAT.byId[id].title)}</button>`,
            )
            .join("")}</div>
          ${last ? `<button type="button" class="go" data-open="${esc(last.id)}">Continue</button>` : ""}
        </section>
        <div>
          ${early.length ? `<p class="grp">Early years</p><div class="levels-early">${early.map((l) => levelBtn(l, `${svg(l.art)}${esc(l.label)}<small>${n(l.key)}</small>`)).join("")}</div>` : ""}
          ${classes.length ? `<p class="grp">Classes</p><div class="levels-classes">${classes.map((l) => levelBtn(l, esc(l.short), count(l.key) ? "has" : "soon")).join("")}</div>` : ""}
          ${inter.length ? `<p class="grp">Intermediate</p><div class="levels-inter">${inter.map((l) => levelBtn(l, `${svg(l.art)}${esc(l.label)} <small>${count(l.key) ? n(l.key) : "coming soon"}</small>`)).join("")}</div>` : ""}
          ${shown.length ? "" : '<p class="empty-note">This school\'s licence does not include any classes yet. Ask Maqsusi EduTech for the licence file.</p>'}
        </div></div>`;
  }

  function renderLevel(key, subject) {
    const subs = subjectsOf(key);
    subject = subs.includes(subject) ? subject : subs[0];
    crumb([{ label: "Home", go: { screen: "home" } }, { label: levelLabel(key) }]);
    if (!subs.length) {
      body.innerHTML = `<p class="empty-note">Activities for ${esc(levelLabel(key))} are being made. They will appear here after the next content update.</p>`;
      return;
    }
    const items = itemsFor(key).filter((i) => i.subject === subject);
    body.innerHTML = `<div class="subj">
        <nav class="rail" aria-label="Subjects">${subs.map((s) => `<button type="button" class="tap${s === subject ? " on" : ""}" data-subject="${esc(s)}">${svg(CAT.subjectIcon(s))}${esc(CAT.subjectLabel(s))}<em>${itemsFor(key).filter((i) => i.subject === s).length}</em></button>`).join("")}</nav>
        <div class="cards">${items
          .map(
            (i, n) => `<button type="button" class="tap card" data-open="${esc(i.id)}">
            ${cardArt.html(i)}
            <div class="tx"><b>${esc(i.title)}</b><small>${esc(i.subtitle)}</small><div class="tags"><em>${esc(i.kind)}</em>${i.draft ? '<em class="draft">Draft</em>' : ""}</div></div>
          </button>`,
          )
          .join("")}</div></div>`;
    route = { screen: "level", level: key, subject };
  }

  body.addEventListener("click", (e) => {
    const lv = e.target.closest("[data-level]"),
      sb = e.target.closest("[data-subject]"),
      op = e.target.closest("[data-open]");
    if (op) return pick(op.dataset.open);
    if (lv && !lv.hasAttribute("aria-disabled")) return go({ screen: "level", level: lv.dataset.level });
    if (lv) return;
    if (sb) return go({ screen: "level", level: route.level, subject: sb.dataset.subject });
  });
  $("wallBody").addEventListener(
    "click",
    (e) => {
      if (e.target.closest(".cont [data-open]")) e.stopPropagation();
    },
    true,
  );

  function go(r) {
    route = r;
    closeApp();
    if (r.screen === "level") renderLevel(r.level, r.subject);
    else renderHome();
  }

  // ── activities ──
  function closeApp() {
    document.body.classList.remove("app-open");
    frame.classList.add("hidden");
    frame.removeAttribute("src");
    home.classList.add("hidden");
    $("lockBadge").classList.add("hidden");
    currentApp = "menu";
  }
  function startCalibration() {
    if (inputMode() === "mouse") return;
    calibrating = true;
    frame.src = "/calibrate/index.html";
    frame.classList.remove("hidden");
    home.classList.add("hidden");
    frame.addEventListener("load", () => frame.focus(), { once: true });
  }
  function openApp(id) {
    const item = CAT.byId[id];
    if (!item || !licensed(item.level)) {
      closeApp();
      if (route.screen !== "home" && route.screen !== "level") renderHome();
      return;
    }
    currentApp = id;
    if (!isCalibrated()) {
      startCalibration();
      return;
    } // opens the activity afterwards
    calibrating = false;
    remember(id);
    frame.src = item.path;
    frame.classList.remove("hidden");
    document.body.classList.add("app-open");
    home.classList.toggle("hidden", locked);
    $("lockBadge").classList.toggle("hidden", !locked);
    crumb([
      { label: "Home", go: { screen: "home" } },
      { label: levelLabel(item.level), go: { screen: "level", level: item.level, subject: item.subject } },
      { label: item.title },
    ]);
    route = { screen: "level", level: item.level, subject: item.subject };
    renderLevel(item.level, item.subject);
    frame.addEventListener("load", () => frame.focus(), { once: true });
  }
  async function pick(id) {
    openApp(id);
    try {
      lastTs = (await setState({ app: id })).ts;
    } catch (e) {
      /* the next poll reconciles */
    }
  }
  home.addEventListener("click", async () => {
    closeApp();
    if (route.screen === "level") renderLevel(route.level, route.subject);
    else renderHome();
    try {
      lastTs = (await setState({ app: "menu" })).ts;
    } catch (e) {
      /* ignore */
    }
  });

  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.type === "wall-calibrated") {
      calibrating = false;
      drawPenChip();
      if (currentApp !== "menu") openApp(currentApp);
      else closeApp();
    }
    if (e.data.type === "mt-home") home.click();
    if (e.data.type === "mt-calibrate" && !calibrating) startCalibration();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === calKey()) {
      drawPenChip();
      if (!e.newValue && !calibrating && currentApp !== "menu") startCalibration();
    }
  });
  // Activities with a "back to hub" link (href="/") would load a launcher inside the frame: show the menu instead.
  frame.addEventListener("load", () => {
    let p = "";
    try {
      p = frame.contentWindow.location.pathname;
    } catch (e) {
      return;
    }
    if ((p === "/" || p === "/index.html") && !locked) home.click();
  });

  // ── settings ──
  const HINTS = {
    irpen:
      "Children use the MagicTouch IR pen. The IR camera sees the pen tip; calibrate once after the projector is mounted.",
    hand: "Children point with a finger. Uses a normal webcam; works best in a bright room.",
    mouse: "No camera. Use a mouse, a touch screen or an interactive panel. Good for demos and laptops.",
  };
  function drawSettings() {
    const m = inputMode();
    $("inputSeg")
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === m)));
    $("inputHint").textContent = HINTS[m];
    $("calibrateBtn").classList.toggle("hidden", m === "mouse");
    $("musicToggle").setAttribute("aria-pressed", String(localStorage.getItem("wallBgMusicOn") !== "0"));
    $("sfxToggle").setAttribute("aria-pressed", String(localStorage.getItem("mtSfxOn") !== "0"));
  }
  // Music and effects are our own generated sounds (shared/studio/soft-music.js); every activity reads these.
  $("musicToggle").addEventListener("click", () => {
    localStorage.setItem("wallBgMusicOn", localStorage.getItem("wallBgMusicOn") === "0" ? "1" : "0");
    drawSettings();
  });
  $("sfxToggle").addEventListener("click", () => {
    localStorage.setItem("mtSfxOn", localStorage.getItem("mtSfxOn") === "0" ? "1" : "0");
    drawSettings();
  });
  $("settingsBtn").addEventListener("click", () => {
    drawSettings();
    $("settings").classList.remove("hidden");
  });
  $("settingsClose").addEventListener("click", () => $("settings").classList.add("hidden"));
  $("settings").addEventListener("click", (e) => {
    if (e.target.id === "settings") $("settings").classList.add("hidden");
  });
  $("inputSeg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    localStorage.setItem("wallInputMode", b.dataset.mode);
    drawSettings();
    drawPenChip();
  });
  $("calibrateBtn").addEventListener("click", () => {
    $("settings").classList.add("hidden");
    try {
      localStorage.removeItem(calKey());
    } catch (e) {
      /* ignore */
    }
    startCalibration();
  });
  $("wallLogoutBtn").addEventListener("click", logout);

  // ── sync with the phone ──
  function applyState(s, first) {
    if (s.locked !== locked) {
      locked = s.locked;
      if (currentApp !== "menu") {
        home.classList.toggle("hidden", locked);
        $("lockBadge").classList.toggle("hidden", !locked);
      }
    }
    if (s.cmd === "calibrate" && s.cmdTs > lastCmdTs) {
      const fresh = !first;
      lastCmdTs = s.cmdTs;
      if (fresh) {
        try {
          localStorage.removeItem(calKey());
        } catch (e) {
          /* ignore */
        }
        startCalibration();
      }
    }
    if (s.gameTs > lastGameTs) {
      const prev = teamUI.game;
      lastGameTs = s.gameTs;
      if (JSON.stringify(prev) !== JSON.stringify(s.game)) teamUI.render(s.game, first ? null : prev);
    }
    if (s.ts > lastTs) {
      lastTs = s.ts;
      if (s.app !== currentApp && !calibrating) {
        if (s.app === "menu" || !CAT.byId[s.app]) {
          closeApp();
          renderHome();
        } else openApp(s.app);
      }
    }
  }
  drawPenChip();
  renderHome();
  getState()
    .then((s) => applyState(s, true))
    .catch(() => {});
  setInterval(
    () =>
      getState()
        .then((s) => applyState(s, false))
        .catch(() => {}),
    POLL_MS,
  );
}

// ══════════════════════════ PHONE REMOTE ════════════════════════════
function startRemote() {
  showView("remoteView");
  $("remoteUsername").textContent = localStorage.getItem(USERNAME_KEY) || "";
  $("remoteSchoolLink").classList.toggle("hidden", ROLE !== "school");
  $("remoteLogoutBtn").addEventListener("click", logout);
  const frame = $("remoteAppFrame"),
    back = $("remoteHomeBtn"),
    status = $("remoteStatus");
  let playMode = localStorage.getItem(PLAY_MODE_KEY) === "here" ? "here" : "wall";
  let state = { app: "menu", locked: false },
    level = (levelsShown().find((l) => itemsFor(l.key).length) || {}).key;

  let lastGame = null;
  const teamUI = teams.remote({
    el: $("rTeams"),
    teams: () => TEAMS,
    send: async (g) => {
      teamUI.render(g);
      try {
        const s = await setState({ game: g });
        lastGame = JSON.stringify(s.game);
      } catch (e) {
        status.textContent = e.message;
      }
    },
  });
  teamUI.render({ on: false });

  function drawModes() {
    $("modeSendWall").setAttribute("aria-checked", String(playMode === "wall"));
    $("modePlayHere").setAttribute("aria-checked", String(playMode === "here"));
  }
  $("modeSendWall").addEventListener("click", () => {
    playMode = "wall";
    localStorage.setItem(PLAY_MODE_KEY, playMode);
    drawModes();
  });
  $("modePlayHere").addEventListener("click", () => {
    playMode = "here";
    localStorage.setItem(PLAY_MODE_KEY, playMode);
    drawModes();
  });

  function drawLevels() {
    $("rLevels").innerHTML = levelsShown()
      .filter((l) => itemsFor(l.key).length)
      .map(
        (l) => `<button type="button" data-level="${l.key}" aria-pressed="${l.key === level}">${esc(l.label)}</button>`,
      )
      .join("");
  }
  function drawList() {
    if (!level) {
      $("rList").innerHTML = '<p class="r-sub">No activities in this school\'s licence yet.</p>';
      return;
    }
    $("rList").innerHTML = subjectsOf(level)
      .map(
        (s) =>
          `<p class="r-sub">${esc(CAT.subjectLabel(s))}</p>` +
          itemsFor(level)
            .filter((i) => i.subject === s)
            .map(
              (i) =>
                `<button type="button" class="r-item${i.id === state.app ? " cur" : ""}" data-open="${esc(i.id)}"><span class="e">${cardArt.img(i.icon)}</span><span><b>${esc(i.title)}</b><small>${esc(i.kind)}${i.draft ? " · Draft" : ""}</small></span></button>`,
            )
            .join(""),
      )
      .join("");
  }
  $("rLevels").addEventListener("click", (e) => {
    const b = e.target.closest("[data-level]");
    if (b) {
      level = b.dataset.level;
      drawLevels();
      drawList();
    }
  });
  $("rList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-open]");
    if (!b) return;
    const id = b.dataset.open;
    if (playMode === "here") {
      frame.src = CAT.byId[id].path;
      frame.classList.remove("hidden");
      back.classList.remove("hidden");
      return;
    }
    status.textContent = "Sending to the wall…";
    try {
      state = await setState({ app: id });
      draw();
      status.textContent = "On the wall: " + itemLabel(id);
    } catch (err) {
      status.textContent = "Could not reach the wall: " + err.message;
    }
  });
  back.addEventListener("click", () => {
    frame.removeAttribute("src");
    frame.classList.add("hidden");
    back.classList.add("hidden");
  });

  $("rHome").addEventListener("click", async () => {
    try {
      state = await setState({ app: "menu" });
      draw();
      status.textContent = "The wall is showing the menu.";
    } catch (e) {
      status.textContent = e.message;
    }
  });
  $("rCalibrate").addEventListener("click", async () => {
    try {
      await setState({ command: "calibrate" });
      status.textContent = "Calibration started on the wall. Touch each glowing dot with the pen.";
    } catch (e) {
      status.textContent = e.message;
    }
  });
  $("rLock").addEventListener("click", async () => {
    try {
      state = await setState({ locked: !state.locked });
      draw();
      status.textContent = state.locked ? "Wall locked: children can't leave the activity." : "Wall unlocked.";
    } catch (e) {
      status.textContent = e.message;
    }
  });

  function draw() {
    $("nowPlaying").textContent = itemLabel(state.app);
    $("rLock").setAttribute("aria-pressed", String(!!state.locked));
    drawList();
  }
  async function refresh() {
    try {
      const s = await getState();
      const changed = s.app !== state.app || s.locked !== state.locked;
      const gs = JSON.stringify(s.game || { on: false });
      if (gs !== lastGame) {
        lastGame = gs;
        teamUI.render(s.game);
      }
      state = s;
      $("remoteDot").className = "on";
      $("remoteConn").textContent = "Connected to " + (localStorage.getItem(USERNAME_KEY) || "the wall");
      if (changed) draw();
    } catch (e) {
      $("remoteDot").className = "";
      $("remoteConn").textContent = "Can't reach the wall server";
    }
  }
  drawModes();
  drawLevels();
  draw();
  refresh();
  setInterval(refresh, POLL_MS);
}

// ══════════════════════════ BOOT ════════════════════════════════════
async function startApp() {
  [LICENCE, CAT, TEAMS] = await Promise.all([api("GET", "/api/licence"), loadCatalog(), teams.load(api)]);
  if (mode === "wall") startWall();
  else startRemote();
}
(async function boot() {
  if (!token()) return showAuth();
  try {
    ROLE = (await api("GET", "/api/auth/me")).role || "wall";
  } catch (e) {
    if (e.status === 401) {
      clearSession();
      return showAuth();
    }
  }
  try {
    await startApp();
  } catch (e) {
    if (e.status === 401) {
      clearSession();
      showAuth();
    } else {
      showAuth();
      $("authError").textContent = e.message;
    }
  }
})();
