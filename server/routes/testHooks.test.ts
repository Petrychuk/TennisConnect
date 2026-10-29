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
import { CapturedEmailStore } from "../services/emailCapture";
import { classifyEmail, generateRunId, isOwnedByRun, runScopedEmail } from "../seeds/e2e/identities";

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
const LOCAL_DEV: TestHookConfig = { nodeEnv: "development", dbEnv: undefined, secret: SECRET };

// Run ownership (layer 4): this test's run, and another concurrent run.
const RUN = generateRunId(1_790_000_000_000, Buffer.from("00112233445566aa", "hex"));
const OTHER_RUN = generateRunId(1_790_000_000_001, Buffer.from("ffeeddccbbaa9988", "hex"));
const ORGANISER_EMAIL = runScopedEmail(RUN, "organiser");
const P1_EMAIL = runScopedEmail(RUN, "p1");
const P2_EMAIL = runScopedEmail(RUN, "p2");

interface FakeUser {
  id: string;
  email: string;
  name: string;
  slug: string;
  isTestUser: boolean;
}

function makeWorld() {
  const users: FakeUser[] = [
    { id: "organiser", email: ORGANISER_EMAIL, name: "Org", slug: "org", isTestUser: true },
    { id: "p1", email: P1_EMAIL, name: "P1", slug: "p1", isTestUser: true },
    { id: "p2", email: P2_EMAIL, name: "P2", slug: "p2", isTestUser: true },
    // Test users this run does NOT own:
    { id: "other-run-organiser", email: runScopedEmail(OTHER_RUN, "organiser"), name: "Other", slug: "other-org", isTestUser: true },
    { id: "other-run-player", email: runScopedEmail(OTHER_RUN, "p1"), name: "Other P", slug: "other-p", isTestUser: true },
    { id: "legacy-player", email: "test_player_1700000000000_abcd1234@tennisconnect.test", name: "Legacy", slug: "legacy", isTestUser: true },
    // Shared seeded fixture account (may take part in any run's session):
    { id: "fixture-player", email: "e2e-fixture-player-01@tennisconnect.test", name: "Fixture", slug: "fx", isTestUser: true },
    { id: "real-user", email: "real.person@gmail.com", name: "Real", slug: "real", isTestUser: false },
  ];
  const organizations = [
    { id: "org-test", ownerId: "organiser" },
    { id: "org-real", ownerId: "real-user" },
    { id: "org-other-run", ownerId: "other-run-organiser" },
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

  const emails = new CapturedEmailStore();
  emails.add({ to: "p1@tennisconnect.test", subject: "Confirm your email", text: "Go https://staging.example/verify-email?token=abc", html: "" });
  emails.add({ to: "real.person@gmail.com", subject: "Reset your password", text: "https://staging.example/reset?token=REAL-USER-TOKEN", html: "" });

  // Fake Stage 3 cleanup service - records calls; behaviour of the real
  // service is covered by server/services/e2eRunCleanup.pg.test.ts.
  const cleanupCalls: string[] = [];
  let cleanupRefusal: string | null = null;
  const runCleanupDeps = {
    async plan(runId: string) {
      cleanupCalls.push(`plan:${runId}`);
      return { runId, users: [], organizationIds: [], counts: {} as any, storagePrefixes: [], refusals: [], storageFiles: 0, storageCleanup: "disabled" as const };
    },
    async apply(runId: string) {
      cleanupCalls.push(`apply:${runId}`);
      if (cleanupRefusal) {
        const error = Object.assign(new Error(`[e2e-cleanup] refusing to clean up: ${cleanupRefusal}`), {
          name: "RunCleanupError",
          plan: { refusals: [cleanupRefusal] },
        });
        throw error;
      }
      return { plan: { runId } as any, storage: { removed: 0, skipped: false }, organizations: null, usersDeleted: 2 };
    },
    async residue() {
      cleanupCalls.push("residue");
      return [{ runId: "r0000000-0000000000000000", users: 1, oldestCreatedAt: null }];
    },
  };
  const refuseCleanup = (reason: string) => {
    cleanupRefusal = reason;
  };

  return { users, writes, tokensIssued, storage, emails, cleanupCalls, runCleanupDeps, refuseCleanup };
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
    capturedEmails: world.emails,
    getPreflight: () => ({
      dbEnv: config.dbEnv ?? "unknown",
      commit: "a".repeat(40),
      emailTransport: "capture",
      stripeMode: "test",
      stripeWebhookConfigured: true,
      storageHost: "staging-project.supabase.co",
    }),
    runCleanup: world.runCleanupDeps,
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

const secretOnly = { "X-E2E-Test-Secret": SECRET };
const auth = { ...secretOnly, "X-E2E-Run-Id": RUN };

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
  ["issue-verification-token", { email: P1_EMAIL }],
  ["seed-players", { count: 2 }],
  ["seed-session", validSession()],
  ["preflight", {}],
  ["emails", { to: "p1@tennisconnect.test" }],
  ["cleanup-run", {}],
  ["run-residue", {}],
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
      const res = await call("issue-verification-token", { email: P1_EMAIL.toUpperCase() }, auth);
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

  await test("preflight reports environment modes only - no secret values", () =>
    withServer(STAGING, async (call) => {
      const res = await call("preflight", {}, auth);
      assert.equal(res.status, 200, res.text);
      assert.deepEqual(Object.keys(res.json).sort(), ["commit", "dbEnv", "emailTransport", "storageHost", "stripeMode", "stripeWebhookConfigured"]);
      assert.equal(res.json.emailTransport, "capture");
      assert.ok(!res.text.includes(SECRET));
    }));

  await test("captured emails are returned for a test recipient, newest first, with links", () =>
    withServer(STAGING, async (call) => {
      const res = await call("emails", { to: "P1@tennisconnect.test", subjectContains: "confirm" }, auth);
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.emails.length, 1);
      assert.deepEqual(res.json.emails[0].links, ["https://staging.example/verify-email?token=abc"]);
      assert.equal(res.json.emails[0].html, undefined, "html is not returned");
    }));

  await test("captured emails to non-test recipients are never returned, even with the secret", () =>
    withServer(STAGING, async (call) => {
      const res = await call("emails", { to: "real.person@gmail.com" }, auth);
      assert.equal(res.status, 403);
      assert.ok(!res.text.includes("REAL-USER-TOKEN"));
      const spoof = await call("emails", { to: "real.person@gmail.com,p1@tennisconnect.test" }, auth);
      assert.equal(spoof.status, 403);
    }));

  await test("email query rejects malformed filters", () =>
    withServer(STAGING, async (call) => {
      assert.equal((await call("emails", { to: "p1@tennisconnect.test", sinceMs: "yesterday" }, auth)).status, 400);
      assert.equal((await call("emails", { to: "p1@tennisconnect.test", subjectContains: 5 }, auth)).status, 400);
    }));

  // ---------- Run ownership (layer 4) ----------

  await test("Staging: record-creating hooks require X-E2E-Run-Id (400, nothing written)", () =>
    withServer(STAGING, async (call, world) => {
      for (const [path, body] of HOOK_CALLS.filter(([path]) => !["preflight", "emails", "run-residue"].includes(path))) {
        const res = await call(path, body, secretOnly);
        assert.equal(res.status, 400, path);
        assert.match(res.json.message, /X-E2E-Run-Id is required/);
      }
      assert.deepEqual(world.writes, []);
      assert.deepEqual(world.tokensIssued, []);
      // Read-only hooks need no run.
      assert.equal((await call("preflight", {}, secretOnly)).status, 200);
      assert.equal((await call("emails", { to: "p1@tennisconnect.test" }, secretOnly)).status, 200);
    }));

  await test("a malformed run id is refused everywhere (also locally), nothing written", async () => {
    for (const config of [STAGING, LOCAL_DEV]) {
      await withServer(config, async (call, world) => {
        for (const bad of ["abc", "r123-xyz", `${RUN}-extra`, RUN.toUpperCase()]) {
          for (const path of ["seed-players", "seed-session", "issue-verification-token"]) {
            const body = HOOK_CALLS.find(([name]) => name === path)![1];
            assert.equal((await call(path, body, { ...secretOnly, "X-E2E-Run-Id": bad })).status, 400, `${path} ${bad}`);
          }
        }
        assert.deepEqual(world.writes, []);
      });
    }
  });

  await test("seed-players creates users owned by exactly the calling run", () =>
    withServer(STAGING, async (call) => {
      const res = await call("seed-players", { count: 3 }, auth);
      assert.equal(res.status, 200, res.text);
      for (const player of res.json.players as { email: string }[]) {
        assert.equal(classifyEmail(player.email).kind, "run", player.email);
        assert.ok(isOwnedByRun(player.email, RUN), player.email);
        assert.ok(!isOwnedByRun(player.email, OTHER_RUN));
      }
    }));

  await test("seed-session: another run's (or an unowned) creator is refused, nothing written", () =>
    withServer(STAGING, async (call, world) => {
      for (const createdBy of ["other-run-organiser", "legacy-player"]) {
        const res = await call("seed-session", { ...validSession(), organizationId: "org-other-run", createdBy }, auth);
        assert.equal(res.status, 403, createdBy);
      }
      assert.deepEqual(world.writes, []);
    }));

  await test("seed-session: participants from another run or no run are refused; fixture accounts allowed", () =>
    withServer(STAGING, async (call, world) => {
      for (const userId of ["other-run-player", "legacy-player"]) {
        const res = await call("seed-session", { ...validSession(), registrations: [{ userId }], matches: [] }, auth);
        assert.equal(res.status, 403, userId);
        assert.match(res.json.message, /belong to this test run/);
        const asPlayer = await call(
          "seed-session",
          { ...validSession(), matches: [{ teamAIds: ["p1"], teamBIds: [userId], teamAGames: 6, teamBGames: 1 }] },
          auth
        );
        assert.equal(asPlayer.status, 403, `${userId} as match player`);
      }
      assert.deepEqual(world.writes, []);
      const ok = await call("seed-session", { ...validSession(), registrations: [{ userId: "p1" }, { userId: "fixture-player" }], matches: [] }, auth);
      assert.equal(ok.status, 200, ok.text);
    }));

  await test("issue-verification-token: only for the calling run's users", () =>
    withServer(STAGING, async (call, world) => {
      for (const email of [runScopedEmail(OTHER_RUN, "p1"), "test_player_1700000000000_abcd1234@tennisconnect.test"]) {
        const res = await call("issue-verification-token", { email }, auth);
        assert.equal(res.status, 403, email);
      }
      assert.deepEqual(world.tokensIssued, []);
      assert.equal((await call("issue-verification-token", { email: P1_EMAIL }, auth)).status, 200);
    }));

  await test("local development without a run id keeps the previous behaviour", () =>
    withServer(LOCAL_DEV, async (call) => {
      const players = await call("seed-players", { count: 1 }, secretOnly);
      assert.equal(players.status, 200, players.text);
      assert.match(players.json.players[0].email, /^seed_player_.*@tennisconnect\.test$/);
      const token = await call("issue-verification-token", { email: "test_player_1700000000000_abcd1234@tennisconnect.test" }, secretOnly);
      assert.equal(token.status, 200, token.text);
    }));

  // ---------- Stage 3 run-scoped cleanup hooks ----------

  await test("cleanup-run: dry run by default - plans, never applies", () =>
    withServer(STAGING, async (call, world) => {
      const res = await call("cleanup-run", {}, auth);
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.mode, "dry-run");
      assert.deepEqual(world.cleanupCalls, [`plan:${RUN}`]);
      const explicit = await call("cleanup-run", { apply: false, confirmRunId: RUN }, auth);
      assert.equal(explicit.json.mode, "dry-run");
      assert.ok(!world.cleanupCalls.some((c) => c.startsWith("apply")));
    }));

  await test("cleanup-run: needs a run id everywhere (also locally) - 400, nothing called", async () => {
    for (const config of [STAGING, LOCAL_DEV]) {
      await withServer(config, async (call, world) => {
        const res = await call("cleanup-run", { apply: true, confirmRunId: RUN }, secretOnly);
        assert.equal(res.status, 400, res.text);
        assert.deepEqual(world.cleanupCalls, []);
      });
    }
  });

  await test("cleanup-run: apply needs confirmRunId repeating the header", () =>
    withServer(STAGING, async (call, world) => {
      for (const body of [{ apply: true }, { apply: true, confirmRunId: OTHER_RUN }, { apply: true, confirmRunId: "" }, { apply: "yes", confirmRunId: RUN }]) {
        const res = await call("cleanup-run", body, auth);
        assert.equal(res.status, 400, JSON.stringify(body));
      }
      assert.deepEqual(world.cleanupCalls, []);
      const ok = await call("cleanup-run", { apply: true, confirmRunId: RUN }, auth);
      assert.equal(ok.status, 200, ok.text);
      assert.equal(ok.json.mode, "apply");
      assert.deepEqual(world.cleanupCalls, [`apply:${RUN}`]);
    }));

  await test("cleanup-run: a refusal answers 409 with the reasons", () =>
    withServer(STAGING, async (call, world) => {
      world.refuseCleanup("1 registration(s) in this run's sessions by users outside the run");
      const res = await call("cleanup-run", { apply: true, confirmRunId: RUN }, auth);
      assert.equal(res.status, 409, res.text);
      assert.deepEqual(res.json.refusals, ["1 registration(s) in this run's sessions by users outside the run"]);
    }));

  await test("run-residue: read-only listing", () =>
    withServer(STAGING, async (call, world) => {
      const res = await call("run-residue", {}, secretOnly);
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.runs.length, 1);
      assert.deepEqual(world.cleanupCalls, ["residue"]);
    }));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
