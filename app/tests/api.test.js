import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApi, LIMITS } from "../server/api.js";
import { createFileStore } from "../server/store-file.js";
import { createServer } from "../server/index.js";

function setup(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mt-"));
  let t = 1_000_000;
  const clock = { now: () => t, advance: ms => { t += ms; } };
  const store = createFileStore(path.join(dir, "store.json"));
  const api = createApi({ store, now: clock.now, log: { error() {} }, ...opts });
  const call = (method, p, body, token, ip = "1.1.1.1") =>
    api.handle({ method, path: p, body, ip, headers: token ? { authorization: "Bearer " + token } : {} });
  return { dir, store, api, call, clock };
}

test("first account can be created, then sign-up closes", async () => {
  const { call } = setup();
  assert.equal((await call("GET", "/api/auth/config")).body.signup, true);
  const a = await call("POST", "/api/auth/signup", { username: "room-4b", password: "classroom1" });
  assert.equal(a.status, 200);
  assert.match(a.body.token, /^[a-f0-9]{64}$/);
  assert.equal((await call("GET", "/api/auth/config")).body.signup, false);
  assert.equal((await call("POST", "/api/auth/signup", { username: "room-4c", password: "classroom1" })).status, 403);
});

test("password and username rules", async () => {
  const { call } = setup({ allowSignup: "always" });
  assert.equal((await call("POST", "/api/auth/signup", { username: "ab", password: "classroom1" })).status, 400);
  assert.equal((await call("POST", "/api/auth/signup", { username: "room1", password: "short" })).status, 400);
  assert.equal((await call("POST", "/api/auth/signup", { username: "Room1", password: "classroom1" })).status, 200);
  assert.equal((await call("POST", "/api/auth/signup", { username: "room1", password: "classroom1" })).status, 409, "case-insensitive");
});

test("tokens are stored hashed, never in plain text", async () => {
  const { call, store, dir } = setup();
  const { body } = await call("POST", "/api/auth/signup", { username: "room-4b", password: "classroom1" });
  await store.flush();
  const raw = fs.readFileSync(path.join(dir, "store.json"), "utf8");
  assert.ok(!raw.includes(body.token));
  assert.ok(!raw.includes("classroom1"));
});

test("login, wrong password and lockout after repeated failures", async () => {
  const { call, clock } = setup();
  await call("POST", "/api/auth/signup", { username: "room-4b", password: "classroom1" });
  assert.equal((await call("POST", "/api/auth/login", { username: "ROOM-4B", password: "classroom1" })).status, 200);
  for (let i = 0; i < LIMITS.loginFailsPerWindow; i++) {
    assert.equal((await call("POST", "/api/auth/login", { username: "room-4b", password: "nope-nope" })).status, 401);
  }
  assert.equal((await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).status, 429);
  clock.advance(LIMITS.loginWindowMs + 1);
  assert.equal((await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).status, 200);
});

test("sessions expire and logout ends only that device", async () => {
  const { call, clock } = setup();
  const wall = (await call("POST", "/api/auth/signup", { username: "room-4b", password: "classroom1" })).body.token;
  const phone = (await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).body.token;
  await call("POST", "/api/auth/logout", {}, phone);
  assert.equal((await call("GET", "/api/auth/me", {}, phone)).status, 401);
  assert.equal((await call("GET", "/api/auth/me", {}, wall)).status, 200);
  clock.advance((LIMITS.sessionDays + 1) * 864e5);
  assert.equal((await call("GET", "/api/auth/me", {}, wall)).status, 401);
});

test("wall state: switch activity, lock, validation", async () => {
  const { call, clock } = setup();
  const tok = (await call("POST", "/api/auth/signup", { username: "room-4b", password: "classroom1" })).body.token;
  assert.equal((await call("GET", "/api/state")).status, 401);
  assert.deepEqual((await call("GET", "/api/state", {}, tok)).body, { app: "menu", ts: 0, locked: false });
  clock.advance(5);
  const s = await call("POST", "/api/state", { app: "engine:c10-science-ohms-law" }, tok);
  assert.equal(s.body.app, "engine:c10-science-ohms-law");
  assert.ok(s.body.ts > 0);
  assert.equal((await call("POST", "/api/state", { locked: true }, tok)).body.locked, true);
  assert.equal((await call("POST", "/api/state", { app: "<script>" }, tok)).status, 400);
});

test("server serves files, blocks path traversal, sends security headers", async () => {
  const { store } = setup();
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), "mtpub-"));
  fs.writeFileSync(path.join(pub, "index.html"), "<h1>hi</h1>");
  fs.writeFileSync(path.join(path.dirname(pub), "secret.txt"), "secret");
  const srv = createServer({ store, publicDir: pub, engineDir: pub, log: { error() {} } });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const r = await fetch(base + "/");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await fetch(base + "/..%2fsecret.txt")).status, 404);
    assert.equal((await fetch(base + "/engine/..%2f..%2fsecret.txt")).status, 404);
    const part = await fetch(base + "/index.html", { headers: { Range: "bytes=0-3" } });
    assert.equal(part.status, 206);
    assert.equal(await part.text(), "<h1>");
    const api = await fetch(base + "/api/auth/config");
    assert.equal((await api.json()).signup, true);
  } finally { srv.close(); }
});
