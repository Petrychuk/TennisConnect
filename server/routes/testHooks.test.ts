// npx tsx server/routes/testHooks.test.ts   (or: npm run test:test-hooks)
//
// /api/test-hooks/* end to end over a real HTTP server on loopback: the
// real router (server/routes/testHooksRouter.ts), real Express JSON
// parsing, real headers and status codes.
//
// WHAT IS FAKED: storage, the token issuer and password hashing - all
// in-memory and recording every write, so no database (and no real
// Staging or Production data) is ever touched. testHooksRouter.ts imports
// no storage code at runtime, so no DATABASE_URL etc. is needed either.

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { createTestHooksRouter, type TestHooksDeps } from "./testHooksRouter";
import type { TestHookConfig } from "../lib/testHookSecurity";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

// ---------- Test data ----------

// Generated per run - never a real credential.
const SECRET = `route-${"s".repeat(40)}-${Math.random().toString(36).slice(2)}`;

const STAGING: TestHookConfig = { nodeEnv: "production", dbEnv: "staging", secret: SECRET };
const PRODUCTION: TestHookConfig = { nodeEnv: "production", dbEnv: "production", secret: SECRET };

interface FakeUser {
  id: string;
  email: string;
  name: string;
  slug: string;
  isTestUser: boolean;
}

function makeWorld() {
  const users: FakeUser[] = [
    { id: "organiser", email: "organiser@tennisconnect.test", name: "Org", slug: "org", isTestUser: true },
    { id: "p1", email: "p1@tennisconnect.test", name: "P1", slug: "p1", isTestUser: true },
    { id: "p2", email: "p2@tennisconnect.test", name: "P2", slug: "p2", isTestUser: true },
    { id: "real-user", email: "real.person@gmail.com", name: "Real", slug: "real", isTestUser: false },
  ];
  const organizations = [
    { id: "org-test", ownerId: "organiser" },
    { id: "org-real", ownerId: "real-user" },
  ];
  const seasons = [{ id: "season-test", organizationId: "org-test" }];
  const series = [{ id: "series-test", organizationId: "org-test", seasonId: "season-test" }];

  const writes: string[] = [];
  const tokensIssued: string[] = [];
  let nextId = 1;

  const storage = {
    getUserByEmail: async (email: string) => users.find((u) => u.email.toLowerCase() === email.toLowerCase()),
    getUser: async (id: string) => users.find((u) => u.id === id),
    getOrganizationById: async (id: string) => organizations.find((o) => o.id === id),
    getSeasonById: async (id: string) => seasons.find((s) => s.id === id),
    getSeriesById: async (id: string) => series.find((s) => s.id === id),
    createUser: async (input: any) => {
      const user = { ...input, id: `new-${nextId++}`, slug: `slug-${nextId}` };
      users.push(user);
      writes.push(`createUser:${input.email}:isTestUser=${input.isTestUser}`);
      return user;
    },
    testSeedSession: async (input: any) => {
      writes.push(`session:${input.organizationId}`);
      return { id: `session-${nextId++}`, ...input };
    },
    testSeedRegistration: async (sessionId: string, userId: string) => {
      writes.push(`registration:${userId}`);
      return { id: `reg-${nextId++}` };
    },
    testSeedSessionRound: async () => {
      writes.push("round");
      return { id: `round-${nextId++}` };
    },
    testSeedMatch: async () => {
      writes.push("match");
      return { id: `match-${nextId++}` };
    },
  };

  return { users, writes, tokensIssued, storage };
}

async function withServer(
  config: TestHookConfig,
  fn: (call: (path: string, body: unknown, headers?: Record<string, string>) => Promise<{ status: number; text: string; json: any }>, world: ReturnType<typeof makeWorld>) => Promise<void>
) {
  const world = makeWorld();
  const deps: TestHooksDeps = {
    storage: world.storage as unknown as TestHooksDeps["storage"],
    issueVerificationToken: async (userId) => {
      world.tokensIssued.push(userId);
      return { token: `token-for-${userId}`, expiresAt: new Date(Date.now() + 60_000) };
    },
    hashPassword: async (password) => `hashed:${password.length}`,
    getConfig: () => config,
  };

  const app = express();
  app.use(express.json());
  app.use("/api/test-hooks", createTestHooksRouter(deps));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const call = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/test-hooks/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: res.status, text, json };
  };

  try {
    await fn(call, world);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const auth = { "X-E2E-Test-Secret": SECRET };

const validSession = () => ({
  organizationId: "org-test",
  createdBy: "organiser",
  title: "Seeded",
  startAt: "2026-10-01T09:00:00.000Z",
  seasonId: "season-test",
  seriesId: "series-test",
  registrations: [{ userId: "p1", checkedIn: true }, { userId: "p2", checkedIn: true }],
  matches: [{ teamAIds: ["p1"], teamBIds: ["p2"], teamAGames: 6, teamBGames: 4 }],
});

const HOOK_CALLS: [string, unknown][] = [
  ["issue-verification-token", { email: "p1@tennisconnect.test" }],
  ["seed-players", { count: 2 }],
  ["seed-session", validSession()],
];

// Capture everything the router logs, to prove the secret never appears.
const logged: string[] = [];
for (const level of ["log", "warn", "error", "info"] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
    original(...args);
  };
}

async function main() {
  console.log("test-hooks routes");

  await test("missing secret -> 401 on every hook, nothing written", () =>
    withServer(STAGING, async (call, world) => {
      for (const [path, body] of HOOK_CALLS) {
        const res = await call(path, body);
        assert.equal(res.status, 401, path);
      }
      assert.deepEqual(world.writes, []);
      assert.deepEqual(world.tokensIssued, []);
    }));

  await test("incorrect secret -> 401 on every hook, nothing written", () =>
    withServer(STAGING, async (call, world) => {
      for (const [path, body] of HOOK_CALLS) {
        const res = await call(path, body, { "X-E2E-Test-Secret": SECRET.slice(0, -1) + "Z" });
        assert.equal(res.status, 401, path);
      }
      assert.deepEqual(world.writes, []);
    }));

  await test("the guard also covers paths that don't exist", () =>
    withServer(STAGING, async (call) => {
      assert.equal((await call("anything-else", {})).status, 401);
    }));

  await test("correct secret on Staging -> issue-verification-token works for a test user", () =>
    withServer(STAGING, async (call, world) => {
      const res = await call("issue-verification-token", { email: "P1@tennisconnect.test" }, auth);
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.token, "token-for-p1");
      assert.deepEqual(world.tokensIssued, ["p1"]);
    }));

  await test("correct secret on Staging -> seed-players keeps the 30 cap and isTestUser", () =>
    withServer(STAGING, async (call, world) => {
      const res = await call("seed-players", { count: 500 }, auth);
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.players.length, 30);
      assert.ok(world.writes.every((w) => w.endsWith("isTestUser=true")));
      assert.ok(res.json.players.every((p: { email: string }) => p.email.endsWith("@tennisconnect.test")));
    }));

  await test("correct secret on Staging -> seed-session writes valid test-owned data", () =>
    withServer(STAGING, async (call, world) => {
      const res = await call("seed-session", validSession(), auth);
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.registrationIds.length, 2);
      assert.equal(res.json.matchIds.length, 1);
      assert.deepEqual(world.writes, ["session:org-test", "registration:p1", "registration:p2", "round", "match"]);
    }));

  await test("Production -> 404 on every hook even with the correct secret (and with NODE_ENV=development)", async () => {
    for (const config of [PRODUCTION, { ...PRODUCTION, nodeEnv: "development" }]) {
      await withServer(config, async (call, world) => {
        for (const [path, body] of HOOK_CALLS) {
          const res = await call(path, body, auth);
          assert.equal(res.status, 404, `${path} on ${JSON.stringify(config.nodeEnv)}`);
        }
        assert.deepEqual(world.writes, []);
        assert.deepEqual(world.tokensIssued, []);
      });
    }
  });

  await test("no server secret configured -> 404 (hooks disabled), header ignored", () =>
    withServer({ ...STAGING, secret: undefined }, async (call, world) => {
      for (const [path, body] of HOOK_CALLS) {
        assert.equal((await call(path, body, auth)).status, 404, path);
      }
      assert.deepEqual(world.writes, []);
    }));

  await test("ordinary users cannot receive verification tokens", () =>
    withServer(STAGING, async (call, world) => {
      const res = await call("issue-verification-token", { email: "real.person@gmail.com" }, auth);
      assert.equal(res.status, 403);
      assert.equal(res.json.token, undefined);
      assert.deepEqual(world.tokensIssued, []);
    }));

  await test("seed-session refuses non-test-owned Organiser Hub data, writing nothing", () =>
    withServer(STAGING, async (call, world) => {
      const attempts = [
        { ...validSession(), organizationId: "org-real" },
        { ...validSession(), createdBy: "real-user", organizationId: "org-real", seasonId: undefined, seriesId: undefined },
        { ...validSession(), registrations: [{ userId: "real-user" }] },
        { ...validSession(), matches: [{ teamAIds: ["p1"], teamBIds: ["real-user"], teamAGames: 6, teamBGames: 0 }] },
        { ...validSession(), seasonId: "season-elsewhere" },
      ];
      for (const body of attempts) {
        const res = await call("seed-session", body, auth);
        assert.equal(res.status, 403, JSON.stringify(body));
      }
      assert.deepEqual(world.writes, []);
    }));

  await test("the secret is never returned or logged", () =>
    withServer(STAGING, async (call) => {
      const bodies: string[] = [];
      for (const [path, body] of HOOK_CALLS) {
        bodies.push((await call(path, body, auth)).text);
        bodies.push((await call(path, body)).text);
        bodies.push((await call(path, body, { "X-E2E-Test-Secret": "wrong" })).text);
      }
      await withServer({ ...STAGING, secret: undefined }, async (disabledCall) => {
        bodies.push((await disabledCall("seed-players", {}, auth)).text);
      });
      for (const text of bodies.concat(logged)) {
        assert.ok(!text.includes(SECRET), `secret leaked in: ${text.slice(0, 80)}`);
      }
    }));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
