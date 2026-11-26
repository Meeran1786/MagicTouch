// MagicTouch wall API: room logins + "which activity is on the wall".
// Framework-free: handle() takes a plain request and returns {status, body}, so the
// same code runs in the classroom server (server/index.js) and in cloud functions.
//
// Version 1 stores NO student data. There are two kinds of login:
//   wall   - one classroom wall (for example "room-4b"); its state is the activity
//            on show and whether the teacher has locked it.
//   school - the School view for the principal, HODs and floor in-charges: usage of
//            every wall, and managing the logins. It can also drive a wall itself.
// Usage is counted per wall and per activity (how often, how long), never per child.
import crypto from "node:crypto";

export const LIMITS = {
  passwordMin: 8,
  passwordMax: 200,
  sessionDays: 30,
  loginFailsPerWindow: 8,
  loginWindowMs: 15 * 60 * 1000,
  signupsPerHour: 10,
};

const ROLES = new Set(["wall", "school"]);
const LABEL_MAX = 60;
// Activity time: a session ends when the wall changes activity. A wall that is switched
// off mid-activity stops polling, so time is cut at the last poll (+ a short grace)
// and never counts more than one long period.
export const USAGE = { capMs: 60 * 60 * 1000, graceMs: 2 * 60 * 1000, minMs: 5 * 1000, keepDays: 400, maxDays: 120 };
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const APP_ID_RE = /^[a-zA-Z0-9:_.-]{1,80}$/;
const DAY = 24 * 60 * 60 * 1000;

const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { hash: crypto.scryptSync(password, salt, 64).toString("hex"), salt };
}
export function verifyPassword(password, salt, expected) {
  const a = Buffer.from(hashPassword(password, salt).hash, "hex");
  const b = Buffer.from(String(expected || ""), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Counts failures in a sliding window, per key. In memory: resets on restart,
// which is fine for a classroom PC; a cloud deployment should add a shared limiter.
function createLimiter(max, windowMs, now) {
  const hits = new Map();
  return {
    blocked(key) {
      const t = now(), arr = (hits.get(key) || []).filter(x => t - x < windowMs);
      hits.set(key, arr);
      return arr.length >= max;
    },
    hit(key) { const arr = hits.get(key) || []; arr.push(now()); hits.set(key, arr); },
    clear(key) { hits.delete(key); },
  };
}

// What the school has bought. Without a licence file the wall runs as a demo with every class.
export const DEMO_LICENCE = { school: "Demo school", levels: "all", demo: true };
const COMMANDS = new Set(["calibrate"]);

// Team play: default teams every school gets, which the school can rename and give its own mascot.
// Mascot = one of our gallery pictures (emoji key) or a small picture the school uploads.
export const MASCOTS = ["🦚", "🐅", "🐘", "🦜", "🦁", "🐬", "🦋", "🐼", "🦅", "🐢", "🦒", "🐝", "🌻", "🪷", "⭐", "🚀"];
export const DEFAULT_TEAMS = [
  { name: "Peacocks", mascot: "🦚" }, { name: "Tigers", mascot: "🐅" },
  { name: "Elephants", mascot: "🐘" }, { name: "Parrots", mascot: "🦜" },
];
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const IMAGE_MAX = 200 * 1024; // characters of base64, about 150 KB of picture
function cleanTeams(list) {
  if (!Array.isArray(list) || list.length !== 4) return null;
  const out = [];
  for (const t of list) {
    const name = String((t && t.name) || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24);
    if (!name) return null;
    const team = { name };
    if (t.image) { if (typeof t.image !== "string" || t.image.length > IMAGE_MAX || !IMAGE_RE.test(t.image)) return null; team.image = t.image; }
    team.mascot = MASCOTS.includes(t.mascot) ? t.mascot : DEFAULT_TEAMS[out.length].mascot;
    out.push(team);
  }
  return out;
}
// A game on one wall: how many teams play, their stars, whose turn it is.
function cleanGame(g) {
  if (!g || typeof g !== "object") return null;
  if (!g.on) return { on: false };
  const n = Math.min(4, Math.max(2, parseInt(g.n, 10) || 2));
  const scores = Array.from({ length: n }, (_, i) => Math.min(999, Math.max(0, parseInt((g.scores || [])[i], 10) || 0)));
  const turn = Math.min(n - 1, Math.max(0, parseInt(g.turn, 10) || 0));
  return { on: true, n, scores, turn, ended: !!g.ended };
}

// Calendar day in the school's time zone (default India), e.g. "2026-11-26".
export function dayKey(ms, timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export function createApi({ store, allowSignup = "first", licence = DEMO_LICENCE, now = () => Date.now(), timeZone = "Asia/Kolkata", log = console } = {}) {
  const lastSeen = new Map(); // wall id -> last time that wall polled (memory only, never written)
  const loginFails = createLimiter(LIMITS.loginFailsPerWindow, LIMITS.loginWindowMs, now);
  const signups = createLimiter(LIMITS.signupsPerHour, 60 * 60 * 1000, now);
  const ok = body => ({ status: 200, body });
  const err = (status, error) => ({ status, body: { error } });

  function bearer(headers) {
    const m = /^Bearer\s+([a-f0-9]{64})$/i.exec(headers.authorization || "");
    return m ? m[1].toLowerCase() : null;
  }

  async function newSession(user) {
    const token = crypto.randomBytes(32).toString("hex");
    await store.createSession({ tokenHash: sha256(token), userId: user.id, expiresAt: now() + LIMITS.sessionDays * DAY });
    return { token, username: user.username, role: user.role || "wall", label: user.label || "" };
  }

  async function currentUser(headers) {
    const token = bearer(headers);
    if (!token) return null;
    const h = sha256(token);
    const s = await store.findSession(h);
    if (!s) return null;
    if (s.expiresAt <= now() || s.disabled) { await store.deleteSession(h); return null; }
    // Sliding expiry, refreshed at most once a day so polling doesn't rewrite the store.
    if (s.expiresAt - now() < (LIMITS.sessionDays - 1) * DAY) await store.extendSession(h, now() + LIMITS.sessionDays * DAY);
    return { id: s.userId, username: s.username, role: s.role || "wall", label: s.label || "", tokenHash: h };
  }

  async function signupAllowed() {
    if (allowSignup === true || allowSignup === "always") return true;
    if (allowSignup === "first") return (await store.countUsers()) === 0;
    return false;
  }

  // Close the activity a wall was showing and add its time to that day's totals.
  async function closeUsage(userId, prev, t) {
    if (!prev || !prev.app || prev.app === "menu" || !prev.since) return;
    const seen = lastSeen.get(userId);
    const end = Math.min(t, prev.since + USAGE.capMs, seen && seen >= prev.since ? seen + USAGE.graceMs : t);
    const ms = end - prev.since;
    if (ms < USAGE.minMs) return;
    await store.addUsage({ day: dayKey(prev.since, timeZone), userId, app: prev.app, sessions: 1, seconds: Math.round(ms / 1000) });
  }

  const school = user => user && user.role === "school";
  const cleanLabel = v => String(v ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, LABEL_MAX);
  const pubAccount = u => ({ id: u.id, username: u.username, label: u.label || "", role: u.role || "wall", disabled: !!u.disabled, createdAt: u.createdAt || null });

  const routes = {
    "GET /api/auth/config": async () => ok({ signup: await signupAllowed(), passwordMin: LIMITS.passwordMin }),

    "POST /api/auth/signup": async ({ body, ip }) => {
      if (!(await signupAllowed())) return err(403, "New wall accounts are created by the school admin. Ask them for this room's login.");
      if (signups.blocked(ip)) return err(429, "Too many new accounts from this device. Try again in an hour.");
      const username = String(body.username || "").trim(), password = String(body.password || "");
      if (!USERNAME_RE.test(username)) return err(400, "Use 3 to 32 letters, numbers, dots, dashes or underscores for the wall name.");
      if (password.length < LIMITS.passwordMin || password.length > LIMITS.passwordMax) return err(400, `Use a password of at least ${LIMITS.passwordMin} characters.`);
      if (await store.findUserByName(username)) return err(409, "That wall name is already taken.");
      signups.hit(ip);
      // The first login on a new server is the school's own: it opens the School view and
      // can add a login for every classroom wall. It also works as a wall, so a one-room
      // school needs nothing else.
      const role = (await store.countUsers()) === 0 ? "school" : "wall";
      const user = await store.createUser({ username, role, label: role === "school" ? "School office" : "", ...hashPassword(password) });
      return ok(await newSession(user));
    },

    "POST /api/auth/login": async ({ body, ip }) => {
      const username = String(body.username || "").trim(), password = String(body.password || "");
      if (!username || !password) return err(400, "Enter the wall name and password.");
      const keys = [`ip:${ip}`, `user:${username.toLowerCase()}`];
      if (keys.some(k => loginFails.blocked(k))) return err(429, "Too many wrong tries. Wait 15 minutes, then try again.");
      const user = await store.findUserByName(username);
      if (!user || user.disabled || !verifyPassword(password, user.salt, user.hash)) {
        keys.forEach(k => loginFails.hit(k));
        return err(401, "Wrong wall name or password.");
      }
      keys.forEach(k => loginFails.clear(k));
      return ok(await newSession(user));
    },

    "POST /api/auth/logout": async ({ headers }) => {
      const t = bearer(headers);
      if (t) await store.deleteSession(sha256(t));
      return ok({ ok: true });
    },

    "GET /api/auth/me": async ({ user }) => user ? ok({ username: user.username, role: user.role, label: user.label }) : err(401, "Not logged in."),

    // Which classes the school's licence covers; the wall and the phone only show those.
    "GET /api/licence": async ({ user }) => {
      if (!user) return err(401, "Not logged in.");
      const l = typeof licence === "function" ? await licence() : licence;
      return ok({ school: l.school || "", levels: l.levels || [], demo: !!l.demo, validUntil: l.validUntil || null });
    },

    "GET /api/state": async ({ user, headers }) => {
      if (!user) return err(401, "Not logged in.");
      if (headers["x-mt-client"] === "wall") lastSeen.set(user.id, now());
      const { since, ...state } = await store.getState(user.id);
      return ok(state);
    },

    "POST /api/state": async ({ user, body }) => {
      if (!user) return err(401, "Not logged in.");
      const patch = {};
      let prev = null;
      if (body.app !== undefined) {
        if (typeof body.app !== "string" || !APP_ID_RE.test(body.app)) return err(400, "Unknown activity.");
        prev = await store.getState(user.id);
        patch.app = body.app; patch.ts = now();
        if (prev.app !== body.app) patch.since = body.app === "menu" ? 0 : now();
      }
      if (body.locked !== undefined) { patch.locked = !!body.locked; patch.ts = patch.ts || now(); }
      // One-shot commands from the teacher's phone (e.g. start the pen calibration on the wall).
      if (body.command !== undefined) {
        if (!COMMANDS.has(body.command)) return err(400, "Unknown command.");
        patch.cmd = body.command; patch.cmdTs = now();
      }
      if (body.game !== undefined) {
        const g = cleanGame(body.game);
        if (!g) return err(400, "Unknown team game.");
        patch.game = g; patch.gameTs = now();
      }
      if (!Object.keys(patch).length) return err(400, "Nothing to change.");
      if (prev && prev.app !== patch.app) await closeUsage(user.id, prev, now());
      const { since, ...state } = await store.setState(user.id, patch);
      return ok(state);
    },

    // Team names and mascots: every login reads them (the wall and the phone show them);
    // only a school login changes them.
    "GET /api/school/settings": async ({ user }) => {
      if (!user) return err(401, "Not logged in.");
      const st = (await store.getSettings()) || {};
      return ok({ teams: st.teams || DEFAULT_TEAMS, mascots: MASCOTS, defaults: DEFAULT_TEAMS });
    },
    "POST /api/school/settings": async ({ user, body }) => {
      if (!user) return err(401, "Not logged in.");
      if (!school(user)) return err(403, "Only a school login can change team names.");
      const teams = body.reset ? DEFAULT_TEAMS : cleanTeams(body.teams);
      if (!teams) return err(400, "Give each of the four teams a name (up to 24 letters). Pictures must be PNG, JPG or WebP under 150 KB.");
      const st = (await store.getSettings()) || {};
      await store.setSettings({ ...st, teams });
      return ok({ teams });
    },

    // ── School view: principal, HODs, floor in-charges ──
    "GET /api/school/usage": async ({ user, query }) => {
      if (!user) return err(401, "Not logged in.");
      if (!school(user)) return err(403, "The School view needs a school login.");
      const days = Math.min(USAGE.maxDays, Math.max(1, parseInt(query.days, 10) || 7));
      const t = now(), to = dayKey(t, timeZone), from = dayKey(t - (days - 1) * 864e5, timeZone);
      const [accounts, rows] = await Promise.all([store.listUsers(), store.getUsage(from, to)]);
      const walls = [];
      for (const u of accounts) {
        const st = await store.getState(u.id);
        const seen = lastSeen.get(u.id) || 0;
        const live = st.app && st.app !== "menu" && st.since && seen > t - USAGE.graceMs;
        // Time of the activity still on show counts in the totals too.
        if (live) rows.push({ day: dayKey(st.since, timeZone), userId: u.id, app: st.app, sessions: 1, seconds: Math.round(Math.min(t - st.since, USAGE.capMs) / 1000), live: true });
        walls.push({ ...pubAccount(u), online: seen > t - USAGE.graceMs, showing: live ? st.app : null, locked: !!st.locked });
      }
      return ok({ from, to, days, timeZone, walls, rows: rows.filter(r => r.day >= from && r.day <= to).map(({ day, userId, app, sessions, seconds }) => ({ day, wall: userId, app, sessions, seconds })) });
    },

    "GET /api/school/accounts": async ({ user }) => {
      if (!user) return err(401, "Not logged in.");
      if (!school(user)) return err(403, "The School view needs a school login.");
      return ok({ accounts: (await store.listUsers()).map(pubAccount), me: user.id });
    },

    "POST /api/school/accounts": async ({ user, body }) => {
      if (!user) return err(401, "Not logged in.");
      if (!school(user)) return err(403, "Only a school login can add logins.");
      const username = String(body.username || "").trim(), password = String(body.password || "");
      const role = ROLES.has(body.role) ? body.role : "wall";
      if (!USERNAME_RE.test(username)) return err(400, "Use 3 to 32 letters, numbers, dots, dashes or underscores for the login.");
      if (password.length < LIMITS.passwordMin || password.length > LIMITS.passwordMax) return err(400, `Use a password of at least ${LIMITS.passwordMin} characters.`);
      if (await store.findUserByName(username)) return err(409, "That login is already taken.");
      const u = await store.createUser({ username, role, label: cleanLabel(body.label), ...hashPassword(password) });
      return ok({ account: pubAccount({ ...u, role, label: cleanLabel(body.label) }) });
    },

    "POST /api/school/accounts/update": async ({ user, body }) => {
      if (!user) return err(401, "Not logged in.");
      if (!school(user)) return err(403, "Only a school login can change logins.");
      const id = Number(body.id);
      const target = (await store.listUsers()).find(u => u.id === id);
      if (!target) return err(404, "No such login.");
      const patch = {};
      if (body.label !== undefined) patch.label = cleanLabel(body.label);
      if (body.role !== undefined) {
        if (!ROLES.has(body.role)) return err(400, "Unknown kind of login.");
        if (id === user.id && body.role !== "school") return err(400, "You can't remove the School view from your own login.");
        patch.role = body.role;
      }
      if (body.disabled !== undefined) {
        if (id === user.id && body.disabled) return err(400, "You can't turn off your own login.");
        patch.disabled = !!body.disabled;
      }
      if (body.password !== undefined) {
        const pw = String(body.password);
        if (pw.length < LIMITS.passwordMin || pw.length > LIMITS.passwordMax) return err(400, `Use a password of at least ${LIMITS.passwordMin} characters.`);
        Object.assign(patch, hashPassword(pw));
      }
      if (!Object.keys(patch).length) return err(400, "Nothing to change.");
      await store.updateUser(id, patch);
      // A new password or a turned-off login signs that login out everywhere (but not you).
      if (patch.hash || patch.disabled) await store.deleteSessionsFor(id, id === user.id ? user.tokenHash : null);
      return ok({ account: pubAccount((await store.listUsers()).find(u => u.id === id)) });
    },
  };

  return {
    async handle({ method, path, headers = {}, body = {}, query = {}, ip = "local" }) {
      const route = routes[`${method} ${path}`];
      if (!route) return Object.keys(routes).some(k => k.endsWith(" " + path)) ? err(405, "Method not allowed.") : err(404, "Not found.");
      try {
        const user = await currentUser(headers);
        return await route({ headers, body: body && typeof body === "object" ? body : {}, query: query || {}, ip, user });
      } catch (e) {
        log.error("[api]", method, path, e);
        return err(500, "Something went wrong on the wall server. Try again.");
      }
    },
  };
}
