// MagicTouch wall API: room logins + "which activity is on the wall".
// Framework-free: handle() takes a plain request and returns {status, body}, so the
// same code runs in the classroom server (server/index.js) and in cloud functions.
//
// Version 1 stores NO student data. An account is a classroom wall login
// (for example "room-4b"); the only state kept is the active activity and
// whether the teacher has locked the wall.
import crypto from "node:crypto";

export const LIMITS = {
  passwordMin: 8,
  passwordMax: 200,
  sessionDays: 30,
  loginFailsPerWindow: 8,
  loginWindowMs: 15 * 60 * 1000,
  signupsPerHour: 10,
};

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

export function createApi({ store, allowSignup = "first", licence = DEMO_LICENCE, now = () => Date.now(), log = console } = {}) {
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
    return { token, username: user.username };
  }

  async function currentUser(headers) {
    const token = bearer(headers);
    if (!token) return null;
    const h = sha256(token);
    const s = await store.findSession(h);
    if (!s) return null;
    if (s.expiresAt <= now()) { await store.deleteSession(h); return null; }
    // Sliding expiry, refreshed at most once a day so polling doesn't rewrite the store.
    if (s.expiresAt - now() < (LIMITS.sessionDays - 1) * DAY) await store.extendSession(h, now() + LIMITS.sessionDays * DAY);
    return { id: s.userId, username: s.username, tokenHash: h };
  }

  async function signupAllowed() {
    if (allowSignup === true || allowSignup === "always") return true;
    if (allowSignup === "first") return (await store.countUsers()) === 0;
    return false;
  }

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
      const user = await store.createUser({ username, ...hashPassword(password) });
      return ok(await newSession(user));
    },

    "POST /api/auth/login": async ({ body, ip }) => {
      const username = String(body.username || "").trim(), password = String(body.password || "");
      if (!username || !password) return err(400, "Enter the wall name and password.");
      const keys = [`ip:${ip}`, `user:${username.toLowerCase()}`];
      if (keys.some(k => loginFails.blocked(k))) return err(429, "Too many wrong tries. Wait 15 minutes, then try again.");
      const user = await store.findUserByName(username);
      if (!user || !verifyPassword(password, user.salt, user.hash)) {
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

    "GET /api/auth/me": async ({ user }) => user ? ok({ username: user.username }) : err(401, "Not logged in."),

    // Which classes the school's licence covers; the wall and the phone only show those.
    "GET /api/licence": async ({ user }) => {
      if (!user) return err(401, "Not logged in.");
      const l = typeof licence === "function" ? await licence() : licence;
      return ok({ school: l.school || "", levels: l.levels || [], demo: !!l.demo, validUntil: l.validUntil || null });
    },

    "GET /api/state": async ({ user }) => {
      if (!user) return err(401, "Not logged in.");
      return ok(await store.getState(user.id));
    },

    "POST /api/state": async ({ user, body }) => {
      if (!user) return err(401, "Not logged in.");
      const patch = {};
      if (body.app !== undefined) {
        if (typeof body.app !== "string" || !APP_ID_RE.test(body.app)) return err(400, "Unknown activity.");
        patch.app = body.app; patch.ts = now();
      }
      if (body.locked !== undefined) { patch.locked = !!body.locked; patch.ts = patch.ts || now(); }
      // One-shot commands from the teacher's phone (e.g. start the pen calibration on the wall).
      if (body.command !== undefined) {
        if (!COMMANDS.has(body.command)) return err(400, "Unknown command.");
        patch.cmd = body.command; patch.cmdTs = now();
      }
      if (!Object.keys(patch).length) return err(400, "Nothing to change.");
      return ok(await store.setState(user.id, patch));
    },
  };

  return {
    async handle({ method, path, headers = {}, body = {}, ip = "local" }) {
      const route = routes[`${method} ${path}`];
      if (!route) return Object.keys(routes).some(k => k.endsWith(" " + path)) ? err(405, "Method not allowed.") : err(404, "Not found.");
      try {
        const user = await currentUser(headers);
        return await route({ headers, body: body && typeof body === "object" ? body : {}, ip, user });
      } catch (e) {
        log.error("[api]", method, path, e);
        return err(500, "Something went wrong on the wall server. Try again.");
      }
    },
  };
}
