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
  const clock = {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
  const store = createFileStore(path.join(dir, "store.json"));
  const api = createApi({ store, now: clock.now, log: { error() {} }, ...opts });
  const call = (method, p, body, token, ip = "1.1.1.1", extra = {}) => {
    const [pathname, qs] = p.split("?");
    return api.handle({
      method,
      path: pathname,
      query: Object.fromEntries(new URLSearchParams(qs || "")),
      body,
      ip,
      headers: { ...(token ? { authorization: "Bearer " + token } : {}), ...extra },
    });
  };
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
  assert.equal(
    (await call("POST", "/api/auth/signup", { username: "room1", password: "classroom1" })).status,
    409,
    "case-insensitive",
  );
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
  assert.deepEqual((await call("GET", "/api/state", {}, tok)).body, {
    app: "menu",
    ts: 0,
    locked: false,
    cmd: null,
    cmdTs: 0,
    game: { on: false },
    gameTs: 0,
  });
  clock.advance(5);
  const s = await call("POST", "/api/state", { app: "engine:c10-science-ohms-law" }, tok);
  assert.equal(s.body.app, "engine:c10-science-ohms-law");
  assert.ok(s.body.ts > 0);
  assert.equal((await call("POST", "/api/state", { locked: true }, tok)).body.locked, true);
  assert.equal((await call("POST", "/api/state", { app: "<script>" }, tok)).status, 400);
  const c = await call("POST", "/api/state", { command: "calibrate" }, tok);
  assert.equal(c.body.cmd, "calibrate");
  assert.ok(c.body.cmdTs > 0);
  assert.equal((await call("POST", "/api/state", { command: "rm -rf" }, tok)).status, 400);
});

test("licence: demo by default, school licence when given", async () => {
  const { call } = setup();
  const tok = (await call("POST", "/api/auth/signup", { username: "room-4b", password: "classroom1" })).body.token;
  assert.equal((await call("GET", "/api/licence")).status, 401);
  assert.equal((await call("GET", "/api/licence", {}, tok)).body.demo, true);
  const { store } = setup();
  const api2 = createApi({
    store,
    licence: () => ({ school: "Sunrise School", levels: ["nursery", "class-4"] }),
    log: { error() {} },
  });
  const t2 = (
    await api2.handle({
      method: "POST",
      path: "/api/auth/signup",
      body: { username: "room1", password: "classroom1" },
      headers: {},
    })
  ).body.token;
  const l = await api2.handle({ method: "GET", path: "/api/licence", headers: { authorization: "Bearer " + t2 } });
  assert.deepEqual(l.body.levels, ["nursery", "class-4"]);
  assert.equal(l.body.demo, false);
});

test("server serves files, blocks path traversal, sends security headers", async () => {
  const { store } = setup();
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), "mtpub-"));
  fs.writeFileSync(path.join(pub, "index.html"), "<h1>hi</h1>");
  fs.writeFileSync(path.join(path.dirname(pub), "secret.txt"), "secret");
  const srv = createServer({ store, publicDir: pub, log: { error() {} } });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
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
  } finally {
    srv.close();
  }
});

// ── School view ──
async function schoolSetup() {
  const s = setup();
  const admin = (await s.call("POST", "/api/auth/signup", { username: "office", password: "principal1" })).body;
  return { ...s, admin };
}

test("first login is the school's; it adds classroom logins, a wall can't see the School view", async () => {
  const { call, admin } = await schoolSetup();
  assert.equal(admin.role, "school");
  assert.equal((await call("GET", "/api/auth/me", {}, admin.token)).body.role, "school");
  const add = await call(
    "POST",
    "/api/school/accounts",
    { username: "room-4b", label: "Class 4 B", password: "classroom1" },
    admin.token,
  );
  assert.equal(add.status, 200);
  assert.equal(add.body.account.role, "wall");
  assert.equal(
    (await call("POST", "/api/school/accounts", { username: "room-4b", password: "classroom1" }, admin.token)).status,
    409,
  );
  assert.equal(
    (await call("POST", "/api/school/accounts", { username: "x", password: "classroom1" }, admin.token)).status,
    400,
  );
  const wall = (await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).body;
  assert.equal(wall.role, "wall");
  assert.equal((await call("GET", "/api/school/usage", {}, wall.token)).status, 403);
  assert.equal((await call("GET", "/api/school/accounts", {}, wall.token)).status, 403);
  assert.equal(
    (await call("POST", "/api/school/accounts", { username: "room-5", password: "classroom1" }, wall.token)).status,
    403,
  );
  const list = (await call("GET", "/api/school/accounts", {}, admin.token)).body.accounts;
  assert.deepEqual(
    list.map((a) => [a.username, a.role, a.label]),
    [
      ["office", "school", "School office"],
      ["room-4b", "wall", "Class 4 B"],
    ],
  );
  assert.ok(!JSON.stringify(list).includes("hash") && !JSON.stringify(list).includes("salt"));
});

test("turning a login off or resetting its password signs it out", async () => {
  const { call, admin } = await schoolSetup();
  const id = (await call("POST", "/api/school/accounts", { username: "room-4b", password: "classroom1" }, admin.token))
    .body.account.id;
  const wall = (await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).body.token;
  await call("POST", "/api/school/accounts/update", { id, disabled: true }, admin.token);
  assert.equal((await call("GET", "/api/state", {}, wall)).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).status, 401);
  await call("POST", "/api/school/accounts/update", { id, disabled: false, password: "newpass99" }, admin.token);
  assert.equal((await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { username: "room-4b", password: "newpass99" })).status, 200);
  const me = (await call("GET", "/api/auth/me", {}, admin.token)).body;
  const adminId = (await call("GET", "/api/school/accounts", {}, admin.token)).body.me;
  assert.equal(me.role, "school");
  assert.equal(
    (await call("POST", "/api/school/accounts/update", { id: adminId, disabled: true }, admin.token)).status,
    400,
    "can't lock yourself out",
  );
  assert.equal(
    (await call("POST", "/api/school/accounts/update", { id: adminId, role: "wall" }, admin.token)).status,
    400,
  );
});

test("usage: time per wall and activity, capped, cut at the last poll, nothing per child", async () => {
  const { call, clock, admin, store, dir } = await schoolSetup();
  await call(
    "POST",
    "/api/school/accounts",
    { username: "room-4b", label: "Class 4 B", password: "classroom1" },
    admin.token,
  );
  const wall = (await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).body.token;
  const poll = () => api_poll(call, wall);
  await call("POST", "/api/state", { app: "engine:c4-maths" }, wall);
  for (let i = 0; i < 10; i++) {
    clock.advance(60_000);
    await poll();
  } // 10 minutes, wall online
  await call("POST", "/api/state", { locked: true }, wall); // locking doesn't restart the clock
  clock.advance(5 * 60_000);
  await poll(); // 15 minutes
  await call("POST", "/api/state", { app: "alphabets" }, wall); // switch: maths closes at 15 min
  await poll();
  clock.advance(3 * 60 * 60_000); // wall switched off for 3 hours
  await call("POST", "/api/state", { app: "menu" }, wall); // alphabets: cut at last poll + grace
  await call("POST", "/api/state", { app: "menu" }, wall);
  const u = await call("GET", "/api/school/usage?days=7", {}, admin.token);
  const r = (await call("GET", "/api/school/usage", {}, admin.token)).body;
  assert.equal(u.status, 200);
  const maths = r.rows.find((x) => x.app === "engine:c4-maths"),
    abc = r.rows.find((x) => x.app === "alphabets");
  assert.equal(maths.sessions, 1);
  assert.equal(maths.seconds, 15 * 60);
  assert.equal(abc.seconds, 2 * 60, "time after the wall stopped polling is not counted");
  assert.equal(r.rows.length, 2, "menu is not counted");
  assert.equal(r.walls.find((w) => w.username === "room-4b").label, "Class 4 B");
  await store.flush();
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "store.json"), "utf8"));
  assert.deepEqual(Object.keys(raw.usage).length, 2);
});

test("usage: an activity still on the wall shows live, and the period filter works", async () => {
  const { call, clock, admin } = await schoolSetup();
  const wall = admin.token; // a one-room school drives its wall with the school login
  await call("POST", "/api/state", { app: "engine:c10-science-ohms-law" }, wall);
  clock.advance(90_000);
  await api_poll(call, wall);
  const r = (await call("GET", "/api/school/usage?days=1", {}, admin.token)).body;
  const office = r.walls.find((w) => w.username === "office");
  assert.equal(office.showing, "engine:c10-science-ohms-law");
  assert.equal(office.online, true);
  assert.equal(r.rows[0].seconds, 90);
  clock.advance(10 * 864e5);
  const later = (await call("GET", "/api/school/usage?days=7", {}, admin.token)).body;
  assert.equal(later.rows.length, 0, "older than the period and no longer live");
});

test("version 1 data files migrate: the first login becomes the school's", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mt-"));
  fs.writeFileSync(
    path.join(dir, "store.json"),
    JSON.stringify({
      version: 1,
      nextUserId: 3,
      users: [
        { id: 1, username: "room-4b", hash: "x", salt: "y" },
        { id: 2, username: "room-5", hash: "x", salt: "y" },
      ],
      sessions: [],
    }),
  );
  const store = createFileStore(path.join(dir, "store.json"));
  assert.deepEqual(
    (await store.listUsers()).map((u) => u.role),
    ["school", "wall"],
  );
});

test("teams: defaults, the school renames them, walls play a game", async () => {
  const { call, admin } = await schoolSetup();
  await call("POST", "/api/school/accounts", { username: "room-4b", password: "classroom1" }, admin.token);
  const wall = (await call("POST", "/api/auth/login", { username: "room-4b", password: "classroom1" })).body.token;
  const d = (await call("GET", "/api/school/settings", {}, wall)).body;
  assert.deepEqual(
    d.teams.map((t) => t.name),
    ["Peacocks", "Tigers", "Elephants", "Parrots"],
  );
  const mine = [
    { name: "Ganga", mascot: "🐬" },
    { name: "Yamuna", mascot: "🪷" },
    { name: "Godavari", mascot: "🦜", image: "data:image/png;base64,iVBORw0KGgo=" },
    { name: "Krishna <b>", mascot: "nope" },
  ];
  assert.equal((await call("POST", "/api/school/settings", { teams: mine }, wall)).status, 403);
  const saved = (await call("POST", "/api/school/settings", { teams: mine }, admin.token)).body.teams;
  assert.equal(saved[3].name, "Krishna b");
  assert.equal(saved[3].mascot, "🦜", "unknown mascot falls back to the default");
  assert.ok(saved[2].image.startsWith("data:image/png"));
  assert.equal((await call("GET", "/api/school/settings", {}, wall)).body.teams[0].name, "Ganga");
  assert.equal((await call("POST", "/api/school/settings", { teams: [{ name: "A" }] }, admin.token)).status, 400);
  assert.equal(
    (
      await call(
        "POST",
        "/api/school/settings",
        { teams: mine.map((t) => ({ ...t, image: "data:text/html;base64,PHNjcmlwdD4=" })) },
        admin.token,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("POST", "/api/school/settings", { reset: true }, admin.token)).body.teams[0].name,
    "Peacocks",
  );
  assert.equal((await call("GET", "/api/school/settings", {}, wall)).body.simLook, "real");
  assert.equal(
    (await call("POST", "/api/school/settings", { simLook: "diagram" }, admin.token)).body.simLook,
    "diagram",
  );
  assert.equal(
    (await call("GET", "/api/school/settings", {}, wall)).body.teams[0].name,
    "Peacocks",
    "changing the look keeps the teams",
  );
  assert.equal((await call("POST", "/api/school/settings", { simLook: "x" }, admin.token)).status, 400);
  const g = (await call("POST", "/api/state", { game: { on: true, n: 3, scores: [2, "5", -4, 9], turn: 7 } }, wall))
    .body;
  assert.deepEqual(g.game, { on: true, n: 3, scores: [2, 5, 0], turn: 2, ended: false });
  assert.ok(g.gameTs > 0);
  assert.deepEqual((await call("POST", "/api/state", { game: { on: false } }, wall)).body.game, { on: false });
  assert.equal((await call("POST", "/api/state", { game: "x" }, wall)).status, 400);
});

function api_poll(call, token) {
  return call("GET", "/api/state", {}, token, "1.1.1.1", { "x-mt-client": "wall" });
}
