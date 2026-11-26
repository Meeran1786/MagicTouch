// File store: one JSON file on the classroom PC. No database, works offline.
// Writes are atomic (temp file + rename) and serialised, so a power cut mid-write
// leaves the previous good copy in place.
import fs from "node:fs";
import path from "node:path";

const EMPTY = () => ({ version: 2, nextUserId: 1, users: [], sessions: [], usage: {} });

// Version 1 files had no kinds of login: the first login becomes the school's own.
function migrate(data) {
  if (data.users.length && !data.users.some(u => u.role)) data.users.forEach((u, i) => { u.role = i === 0 ? "school" : "wall"; });
  data.usage = data.usage || {};
  data.version = 2;
  return data;
}

export function createFileStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = EMPTY();
  if (fs.existsSync(file)) {
    try { data = migrate({ ...EMPTY(), ...JSON.parse(fs.readFileSync(file, "utf8")) }); }
    catch (e) { throw new Error(`Could not read ${file}: ${e.message}. Fix or move the file, then restart.`); }
  }
  let writing = Promise.resolve();
  function save() {
    const snapshot = JSON.stringify(data, null, 1);
    writing = writing.then(async () => {
      const tmp = file + ".tmp";
      await fs.promises.writeFile(tmp, snapshot, { mode: 0o600 });
      await fs.promises.rename(tmp, file);
    });
    return writing;
  }
  const lc = s => String(s).toLowerCase();
  const pub = u => u && { id: u.id, username: u.username, role: u.role || "wall", label: u.label || "", disabled: !!u.disabled, createdAt: u.createdAt };
  const view = u => ({ app: u.app, ts: u.ts, locked: !!u.locked, cmd: u.cmd || null, cmdTs: u.cmdTs || 0, since: u.since || 0 });
  const EDITABLE = ["label", "role", "disabled", "hash", "salt"];

  return {
    kind: "file",
    async countUsers() { return data.users.length; },
    async findUserByName(username) { return data.users.find(u => lc(u.username) === lc(username)) || null; },
    async createUser({ username, hash, salt, role = "wall", label = "" }) {
      const u = { id: data.nextUserId++, username, hash, salt, role, label, disabled: false, app: "menu", ts: 0, locked: false, createdAt: Date.now() };
      data.users.push(u);
      await save();
      return pub(u);
    },
    async createSession({ tokenHash, userId, expiresAt }) {
      data.sessions.push({ tokenHash, userId, expiresAt, createdAt: Date.now() });
      await save();
    },
    async findSession(tokenHash) {
      const s = data.sessions.find(x => x.tokenHash === tokenHash);
      if (!s) return null;
      const u = data.users.find(x => x.id === s.userId);
      return u ? { userId: u.id, username: u.username, role: u.role || "wall", label: u.label || "", disabled: !!u.disabled, expiresAt: s.expiresAt } : null;
    },
    async extendSession(tokenHash, expiresAt) {
      const s = data.sessions.find(x => x.tokenHash === tokenHash);
      if (s) { s.expiresAt = expiresAt; await save(); }
    },
    async deleteSession(tokenHash) {
      const n = data.sessions.length;
      data.sessions = data.sessions.filter(x => x.tokenHash !== tokenHash);
      if (data.sessions.length !== n) await save();
    },
    async deleteSessionsFor(userId, keepTokenHash = null) {
      const n = data.sessions.length;
      data.sessions = data.sessions.filter(x => x.userId !== userId || x.tokenHash === keepTokenHash);
      if (data.sessions.length !== n) await save();
    },
    async purgeExpired(now, oldestDay = null) {
      const n = data.sessions.length, m = Object.keys(data.usage).length;
      data.sessions = data.sessions.filter(x => x.expiresAt > now);
      if (oldestDay) for (const k of Object.keys(data.usage)) if (k.slice(0, 10) < oldestDay) delete data.usage[k];
      if (data.sessions.length !== n || Object.keys(data.usage).length !== m) await save();
    },
    async listUsers() { return data.users.map(pub); },
    async updateUser(id, patch) {
      const u = data.users.find(x => x.id === id);
      if (!u) return null;
      for (const k of EDITABLE) if (patch[k] !== undefined) u[k] = patch[k];
      await save();
      return pub(u);
    },
    // Usage is kept as daily totals per wall and activity: no event log, nothing per child.
    async addUsage({ day, userId, app, sessions, seconds }) {
      const k = `${day}|${userId}|${app}`;
      const r = data.usage[k] || (data.usage[k] = { sessions: 0, seconds: 0 });
      r.sessions += sessions; r.seconds += seconds;
      await save();
    },
    async getUsage(fromDay, toDay) {
      const out = [];
      for (const [k, v] of Object.entries(data.usage)) {
        const [day, uid, ...rest] = k.split("|");
        if (day >= fromDay && day <= toDay) out.push({ day, userId: Number(uid), app: rest.join("|"), sessions: v.sessions, seconds: v.seconds });
      }
      return out;
    },
    async getState(userId) {
      const u = data.users.find(x => x.id === userId);
      return u ? view(u) : { app: "menu", ts: 0, locked: false, cmd: null, cmdTs: 0, since: 0 };
    },
    async setState(userId, patch) {
      const u = data.users.find(x => x.id === userId);
      if (!u) return null;
      for (const k of ["app", "ts", "locked", "cmd", "cmdTs", "since"]) if (patch[k] !== undefined) u[k] = patch[k];
      await save();
      return view(u);
    },
    flush() { return writing; },
  };
}
