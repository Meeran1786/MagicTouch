// File store: one JSON file on the classroom PC. No database, works offline.
// Writes are atomic (temp file + rename) and serialised, so a power cut mid-write
// leaves the previous good copy in place.
import fs from "node:fs";
import path from "node:path";

const EMPTY = () => ({ version: 1, nextUserId: 1, users: [], sessions: [] });

export function createFileStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = EMPTY();
  if (fs.existsSync(file)) {
    try { data = { ...EMPTY(), ...JSON.parse(fs.readFileSync(file, "utf8")) }; }
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
  const pub = u => u && { id: u.id, username: u.username };

  return {
    kind: "file",
    async countUsers() { return data.users.length; },
    async findUserByName(username) { return data.users.find(u => lc(u.username) === lc(username)) || null; },
    async createUser({ username, hash, salt }) {
      const u = { id: data.nextUserId++, username, hash, salt, app: "menu", ts: 0, locked: false, createdAt: Date.now() };
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
      return u ? { userId: u.id, username: u.username, expiresAt: s.expiresAt } : null;
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
    async purgeExpired(now) {
      const n = data.sessions.length;
      data.sessions = data.sessions.filter(x => x.expiresAt > now);
      if (data.sessions.length !== n) await save();
    },
    async getState(userId) {
      const u = data.users.find(x => x.id === userId);
      return u ? { app: u.app, ts: u.ts, locked: !!u.locked } : { app: "menu", ts: 0, locked: false };
    },
    async setState(userId, patch) {
      const u = data.users.find(x => x.id === userId);
      if (!u) return null;
      Object.assign(u, patch);
      await save();
      return { app: u.app, ts: u.ts, locked: !!u.locked };
    },
    flush() { return writing; },
  };
}
