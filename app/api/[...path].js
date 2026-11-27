// Cloud deployment (Vercel) entry point: every /api/* request goes to the same
// framework-free handler the classroom server uses. Needs DATABASE_URL (Neon).
import { createApi } from "../server/api.js";
import { createPostgresStore } from "../server/store-postgres.js";

let apiPromise = null;
function getApi() {
  if (!apiPromise) apiPromise = createPostgresStore(process.env.DATABASE_URL)
    .then(store => createApi({ store, allowSignup: process.env.MT_SIGNUP || "first", timeZone: process.env.MT_TZ || "Asia/Kolkata" }));
  return apiPromise;
}

export default async function handler(req, res) {
  const api = await getApi();
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const out = await api.handle({ method: req.method, path: req.url.split("?")[0], query: Object.fromEntries(new URL(req.url, "http://x").searchParams), headers: req.headers, body: body || {}, ip });
  res.setHeader("Cache-Control", "no-store");
  res.status(out.status).json(out.body);
}
