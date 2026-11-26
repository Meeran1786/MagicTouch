#!/usr/bin/env node
// MagicTouch wall server. Runs on the classroom PC, no internet needed.
//
//   node server/index.js            → http://localhost:8090/
//
// Serves the wall app (public/), our activity engine (../webcam/ at /engine/)
// and the small API in api.js. Phones on the same Wi-Fi open the LAN address
// it prints to use the remote.
//
// Settings (environment variables):
//   PORT=8090            port to listen on
//   HOST=0.0.0.0         0.0.0.0 lets phones on the Wi-Fi reach it; 127.0.0.1 = this PC only
//   MT_DATA_DIR=./data   where the wall logins are kept (store.json)
//   MT_SIGNUP=first      first = only the first wall account can be created from the
//                        login screen; always = anyone can; never = nobody can
//   MT_LICENCE=...       the school's licence file (default: data/licence.json)
//   DATABASE_URL=...     use Postgres (Neon) instead of the local file
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi, DEMO_LICENCE, USAGE, dayKey } from "./api.js";
import { createFileStore } from "./store-file.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, "..");

export const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".webm": "video/webm",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".bin": "application/octet-stream",
  ".wasm": "application/wasm", ".data": "application/octet-stream", ".task": "application/octet-stream",
  ".tflite": "application/octet-stream", ".binarypb": "application/octet-stream",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "same-origin",
};

// The school's licence: data/licence.json (or MT_LICENCE). Read on each request, so a new
// licence file takes effect without a restart. No file = demo licence with every class.
export function licenceLoader(file) {
  return () => {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { if (e.code !== "ENOENT") console.error("[licence] could not read", file, e.message); return DEMO_LICENCE; }
  };
}

export function createServer({ store, publicDir = path.join(APP_DIR, "public"), engineDir = path.resolve(APP_DIR, "../webcam"), signup = "first", licence = DEMO_LICENCE, log = console } = {}) {
  const api = createApi({ store, allowSignup: signup, licence, timeZone: process.env.MT_TZ || "Asia/Kolkata", log });
  const mounts = [["/engine/", engineDir], ["/", publicDir]];

  function resolveFile(urlPath) {
    let p;
    try { p = decodeURIComponent(urlPath); } catch { return null; }
    if (p.includes("\0")) return null;
    for (const [prefix, dir] of mounts) {
      if (!p.startsWith(prefix)) continue;
      const rel = p.slice(prefix.length);
      const full = path.resolve(dir, "." + path.posix.normalize("/" + rel));
      if (full !== dir && !full.startsWith(dir + path.sep)) return null; // path traversal
      let f = full;
      try { if (fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); } catch { return null; }
      return fs.existsSync(f) ? f : null;
    }
    return null;
  }

  function send(res, status, headers, body) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  }

  // Small JSON bodies only; the school's team settings may carry two or three small mascot pictures.
  const bodyLimit = p => p === "/api/school/settings" ? 640 * 1024 : 16 * 1024;
  async function readJson(req, limit) {
    return new Promise(resolve => {
      let size = 0; const chunks = [];
      req.on("data", c => { size += c.length; if (size > limit) { req.destroy(); resolve(null); } else chunks.push(c); });
      req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { resolve({}); } });
      req.on("error", () => resolve(null));
    });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://wall.local");
    if (url.pathname.startsWith("/api/")) {
      const body = req.method === "POST" ? await readJson(req, bodyLimit(url.pathname)) : {};
      if (body === null) return send(res, 413, { "Content-Type": "application/json" }, JSON.stringify({ error: "Request too large." }));
      const out = await api.handle({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body, ip: req.socket.remoteAddress || "?" });
      return send(res, out.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, JSON.stringify(out.body));
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { "Content-Type": "text/plain" }, "Method not allowed");
    const file = resolveFile(url.pathname);
    if (!file) return send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
    const ext = path.extname(file).toLowerCase();
    const stat = fs.statSync(file);
    const headers = {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Accept-Ranges": "bytes",
      // Code and pages revalidate; media is cached hard (file names don't change between releases).
      "Cache-Control": [".html", ".js", ".mjs", ".css", ".json"].includes(ext) ? "no-cache" : "public, max-age=604800",
      "Last-Modified": stat.mtime.toUTCString(),
    };
    if (req.headers["if-modified-since"] && new Date(req.headers["if-modified-since"]) >= new Date(stat.mtime.toUTCString())) {
      return send(res, 304, headers);
    }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && (range[1] || range[2])) {
      let start = range[1] ? +range[1] : Math.max(0, stat.size - +range[2]);
      let end = range[1] && range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) return send(res, 416, { "Content-Range": `bytes */${stat.size}` });
      res.writeHead(206, { ...SECURITY_HEADERS, ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...SECURITY_HEADERS, ...headers, "Content-Length": stat.size });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === "IPv4" && !a.internal).map(a => a.address);
}

async function main() {
  const port = +(process.env.PORT || 8090);
  const host = process.env.HOST || "0.0.0.0";
  let store;
  if (process.env.DATABASE_URL) {
    const { createPostgresStore } = await import("./store-postgres.js");
    store = await createPostgresStore(process.env.DATABASE_URL);
  } else {
    store = createFileStore(path.resolve(process.env.MT_DATA_DIR || path.join(APP_DIR, "data"), "store.json"));
  }
  const dataDir = path.resolve(process.env.MT_DATA_DIR || path.join(APP_DIR, "data"));
  const server = createServer({ store, signup: process.env.MT_SIGNUP || "first", licence: licenceLoader(process.env.MT_LICENCE || path.join(dataDir, "licence.json")) });
  server.listen(port, host, () => {
    console.log(`MagicTouch wall is running.\n  On this PC:   http://localhost:${port}/`);
    if (host === "0.0.0.0") lanAddresses().forEach(a => console.log(`  Phone remote: http://${a}:${port}/  (same Wi-Fi)`));
    console.log(`  Logins kept in: ${store.kind === "file" ? path.resolve(process.env.MT_DATA_DIR || path.join(APP_DIR, "data")) : "Postgres"}\n  Press Ctrl+C to stop.`);
  });
  // Tidy up once an hour: expired sign-ins, and usage totals older than USAGE.keepDays.
  const tidy = () => store.purgeExpired(Date.now(), dayKey(Date.now() - USAGE.keepDays * 864e5)).catch(e => console.error("[tidy]", e.message));
  tidy(); setInterval(tidy, 60 * 60 * 1000).unref();
  const stop = async () => { server.close(); await store.flush(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
