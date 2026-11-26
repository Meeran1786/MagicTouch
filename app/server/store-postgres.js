// Optional cloud store (Neon / any Postgres reachable over Neon's HTTP driver).
// Used only when DATABASE_URL is set. The classroom default is the file store.
export async function createPostgresStore(url) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  await sql`CREATE TABLE IF NOT EXISTS mt_users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    active_app TEXT NOT NULL DEFAULT 'menu',
    active_app_ts BIGINT NOT NULL DEFAULT 0,
    locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS cmd TEXT`;
  await sql`ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS cmd_ts BIGINT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS app_since BIGINT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS role TEXT`;
  await sql`ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false`;
  // Databases from before login kinds: the first login becomes the school's own.
  await sql`UPDATE mt_users SET role = CASE WHEN id = (SELECT min(id) FROM mt_users) THEN 'school' ELSE 'wall' END WHERE role IS NULL AND NOT EXISTS (SELECT 1 FROM mt_users WHERE role IS NOT NULL)`;
  await sql`UPDATE mt_users SET role = 'wall' WHERE role IS NULL`;
  await sql`CREATE TABLE IF NOT EXISTS mt_usage (
    day TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES mt_users(id) ON DELETE CASCADE,
    app TEXT NOT NULL,
    sessions INTEGER NOT NULL DEFAULT 0,
    seconds BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, user_id, app))`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mt_users_username_lower ON mt_users (lower(username))`;
  await sql`CREATE TABLE IF NOT EXISTS mt_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES mt_users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  const row = r => r && { app: r.app, ts: Number(r.ts), locked: !!r.locked, cmd: r.cmd || null, cmdTs: Number(r.cmdts || 0), since: Number(r.since || 0) };
  const acct = r => r && { id: r.id, username: r.username, role: r.role || "wall", label: r.label || "", disabled: !!r.disabled, createdAt: r.created_at ? new Date(r.created_at).getTime() : null };
  return {
    kind: "postgres",
    async countUsers() { return Number((await sql`SELECT count(*)::int AS n FROM mt_users`)[0].n); },
    async findUserByName(username) {
      const r = (await sql`SELECT id, username, password_hash AS hash, password_salt AS salt, role, disabled FROM mt_users WHERE lower(username) = lower(${username})`)[0];
      return r || null;
    },
    async createUser({ username, hash, salt, role = "wall", label = "" }) {
      return acct((await sql`INSERT INTO mt_users (username, password_hash, password_salt, role, label) VALUES (${username}, ${hash}, ${salt}, ${role}, ${label}) RETURNING id, username, role, label, disabled, created_at`)[0]);
    },
    async createSession({ tokenHash, userId, expiresAt }) {
      await sql`INSERT INTO mt_sessions (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${expiresAt})`;
    },
    async findSession(tokenHash) {
      const r = (await sql`SELECT s.user_id AS "userId", u.username, u.role, u.label, u.disabled, s.expires_at AS "expiresAt" FROM mt_sessions s JOIN mt_users u ON u.id = s.user_id WHERE s.token_hash = ${tokenHash}`)[0];
      return r ? { ...r, expiresAt: Number(r.expiresAt) } : null;
    },
    async extendSession(tokenHash, expiresAt) { await sql`UPDATE mt_sessions SET expires_at = ${expiresAt} WHERE token_hash = ${tokenHash}`; },
    async deleteSession(tokenHash) { await sql`DELETE FROM mt_sessions WHERE token_hash = ${tokenHash}`; },
    async deleteSessionsFor(userId, keepTokenHash = null) {
      await sql`DELETE FROM mt_sessions WHERE user_id = ${userId} AND token_hash IS DISTINCT FROM ${keepTokenHash}`;
    },
    async purgeExpired(now, oldestDay = null) {
      await sql`DELETE FROM mt_sessions WHERE expires_at <= ${now}`;
      if (oldestDay) await sql`DELETE FROM mt_usage WHERE day < ${oldestDay}`;
    },
    async listUsers() { return (await sql`SELECT id, username, role, label, disabled, created_at FROM mt_users ORDER BY id`).map(acct); },
    async updateUser(id, p) {
      const cur = (await sql`SELECT role, label, disabled, password_hash AS hash, password_salt AS salt FROM mt_users WHERE id = ${id}`)[0];
      if (!cur) return null;
      const n = { ...cur, ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) };
      return acct((await sql`UPDATE mt_users SET role = ${n.role}, label = ${n.label}, disabled = ${n.disabled}, password_hash = ${n.hash}, password_salt = ${n.salt} WHERE id = ${id} RETURNING id, username, role, label, disabled, created_at`)[0]);
    },
    async addUsage({ day, userId, app, sessions, seconds }) {
      await sql`INSERT INTO mt_usage (day, user_id, app, sessions, seconds) VALUES (${day}, ${userId}, ${app}, ${sessions}, ${seconds})
        ON CONFLICT (day, user_id, app) DO UPDATE SET sessions = mt_usage.sessions + EXCLUDED.sessions, seconds = mt_usage.seconds + EXCLUDED.seconds`;
    },
    async getUsage(fromDay, toDay) {
      return (await sql`SELECT day, user_id AS "userId", app, sessions, seconds FROM mt_usage WHERE day >= ${fromDay} AND day <= ${toDay}`)
        .map(r => ({ ...r, sessions: Number(r.sessions), seconds: Number(r.seconds) }));
    },
    async getState(userId) {
      return row((await sql`SELECT active_app AS app, active_app_ts AS ts, locked, cmd, cmd_ts AS cmdts, app_since AS since FROM mt_users WHERE id = ${userId}`)[0]) || { app: "menu", ts: 0, locked: false, cmd: null, cmdTs: 0, since: 0 };
    },
    async setState(userId, patch) {
      const cur = await this.getState(userId);
      const n = { ...cur, ...patch };
      return row((await sql`UPDATE mt_users SET active_app = ${n.app}, active_app_ts = ${n.ts}, locked = ${n.locked}, cmd = ${n.cmd}, cmd_ts = ${n.cmdTs}, app_since = ${n.since} WHERE id = ${userId} RETURNING active_app AS app, active_app_ts AS ts, locked, cmd, cmd_ts AS cmdts, app_since AS since`)[0]);
    },
    flush() { return Promise.resolve(); },
  };
}
