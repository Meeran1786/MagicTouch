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
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mt_users_username_lower ON mt_users (lower(username))`;
  await sql`CREATE TABLE IF NOT EXISTS mt_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES mt_users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  const row = r => r && { app: r.app, ts: Number(r.ts), locked: !!r.locked };
  return {
    kind: "postgres",
    async countUsers() { return Number((await sql`SELECT count(*)::int AS n FROM mt_users`)[0].n); },
    async findUserByName(username) {
      const r = (await sql`SELECT id, username, password_hash AS hash, password_salt AS salt FROM mt_users WHERE lower(username) = lower(${username})`)[0];
      return r || null;
    },
    async createUser({ username, hash, salt }) {
      return (await sql`INSERT INTO mt_users (username, password_hash, password_salt) VALUES (${username}, ${hash}, ${salt}) RETURNING id, username`)[0];
    },
    async createSession({ tokenHash, userId, expiresAt }) {
      await sql`INSERT INTO mt_sessions (token_hash, user_id, expires_at) VALUES (${tokenHash}, ${userId}, ${expiresAt})`;
    },
    async findSession(tokenHash) {
      const r = (await sql`SELECT s.user_id AS "userId", u.username, s.expires_at AS "expiresAt" FROM mt_sessions s JOIN mt_users u ON u.id = s.user_id WHERE s.token_hash = ${tokenHash}`)[0];
      return r ? { ...r, expiresAt: Number(r.expiresAt) } : null;
    },
    async extendSession(tokenHash, expiresAt) { await sql`UPDATE mt_sessions SET expires_at = ${expiresAt} WHERE token_hash = ${tokenHash}`; },
    async deleteSession(tokenHash) { await sql`DELETE FROM mt_sessions WHERE token_hash = ${tokenHash}`; },
    async purgeExpired(now) { await sql`DELETE FROM mt_sessions WHERE expires_at <= ${now}`; },
    async getState(userId) {
      return row((await sql`SELECT active_app AS app, active_app_ts AS ts, locked FROM mt_users WHERE id = ${userId}`)[0]) || { app: "menu", ts: 0, locked: false };
    },
    async setState(userId, patch) {
      const cur = await this.getState(userId);
      const n = { ...cur, ...patch };
      return row((await sql`UPDATE mt_users SET active_app = ${n.app}, active_app_ts = ${n.ts}, locked = ${n.locked} WHERE id = ${userId} RETURNING active_app AS app, active_app_ts AS ts, locked`)[0]);
    },
    flush() { return Promise.resolve(); },
  };
}
