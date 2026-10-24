// npx tsx server/lib/testHookSecurity.test.ts   (or: npm run test:test-hooks)
//
// Pure rules behind /api/test-hooks/* - environment gate, shared-secret
// check, test-account detection and seed-session ownership validation.
// No database, no network: lookups are in-memory fakes.

import assert from "node:assert/strict";
import {
  MAX_SEED_REGISTRATIONS,
  checkTestHookAccess,
  isReservedTestEmail,
  isUsableServerSecret,
  secretsMatch,
  shouldFlagRegistrationAsTestUser,
  testHooksEnvironmentAllowed,
  validateSeedSessionInput,
  type SeedLookups,
  type TestHookConfig,
} from "./testHookSecurity";

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
const SECRET = `unit-${"x".repeat(40)}-${Math.random().toString(36).slice(2)}`;

const staging: TestHookConfig = { nodeEnv: "production", dbEnv: "staging", secret: SECRET };
const development: TestHookConfig = { nodeEnv: "development", dbEnv: "unknown", secret: SECRET };

function fakeLookups() {
  const users = new Map<string, { id: string; isTestUser: boolean }>([
    ["organiser", { id: "organiser", isTestUser: true }],
    ["p1", { id: "p1", isTestUser: true }],
    ["p2", { id: "p2", isTestUser: true }],
    ["p3", { id: "p3", isTestUser: true }],
    ["p4", { id: "p4", isTestUser: true }],
    ["real-user", { id: "real-user", isTestUser: false }],
    ["real-owner", { id: "real-owner", isTestUser: false }],
    ["other-test-user", { id: "other-test-user", isTestUser: true }],
  ]);
  const organizations = new Map([
    ["org-test", { id: "org-test", ownerId: "organiser" }],
    ["org-real", { id: "org-real", ownerId: "real-owner" }],
    ["org-other-test", { id: "org-other-test", ownerId: "other-test-user" }],
  ]);
  const seasons = new Map([
    ["season-test", { id: "season-test", organizationId: "org-test" }],
    ["season-test-2", { id: "season-test-2", organizationId: "org-test" }],
    ["season-real", { id: "season-real", organizationId: "org-real" }],
  ]);
  const series = new Map([
    ["series-test", { id: "series-test", organizationId: "org-test", seasonId: "season-test" }],
    ["series-test-s2", { id: "series-test-s2", organizationId: "org-test", seasonId: "season-test-2" }],
    ["series-real", { id: "series-real", organizationId: "org-real", seasonId: "season-real" }],
  ]);
  const calls: string[] = [];
  const lookups: SeedLookups = {
    getUser: async (id) => (calls.push(`user:${id}`), users.get(id)),
    getOrganizationById: async (id) => (calls.push(`org:${id}`), organizations.get(id)),
    getSeasonById: async (id) => (calls.push(`season:${id}`), seasons.get(id)),
    getSeriesById: async (id) => (calls.push(`series:${id}`), series.get(id)),
  };
  return { lookups, calls };
}

const validSession = () => ({
  organizationId: "org-test",
  createdBy: "organiser",
  title: "Seeded session",
  startAt: "2026-10-01T09:00:00.000Z",
  status: "completed",
  seasonId: "season-test",
  seriesId: "series-test",
  registrations: ["p1", "p2", "p3", "p4"].map((userId) => ({ userId, checkedIn: true })),
  matches: [{ teamAIds: ["p1", "p2"], teamBIds: ["p3", "p4"], teamAGames: 6, teamBGames: 3 }],
});

async function expectRejected(body: unknown, status: 400 | 403, pattern: RegExp) {
  const { lookups } = fakeLookups();
  const result = await validateSeedSessionInput(body, lookups);
  assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(body)}`);
  if (!result.ok) {
    assert.equal(result.status, status);
    assert.match(result.message, pattern);
  }
}

async function main() {
  console.log("testHookSecurity");

  // ---------- Environment ----------

  await test("development and staging are allowed", () => {
    assert.equal(testHooksEnvironmentAllowed({ nodeEnv: "development", dbEnv: undefined }), true);
    assert.equal(testHooksEnvironmentAllowed({ nodeEnv: "production", dbEnv: "staging" }), true);
  });

  await test("DB_ENV=production is rejected regardless of NODE_ENV", () => {
    for (const nodeEnv of ["development", "production", "test", undefined]) {
      assert.equal(testHooksEnvironmentAllowed({ nodeEnv, dbEnv: "production" }), false, String(nodeEnv));
      assert.equal(testHooksEnvironmentAllowed({ nodeEnv, dbEnv: " Production " }), false, String(nodeEnv));
    }
  });

  await test("anything that is not clearly dev/staging is rejected", () => {
    assert.equal(testHooksEnvironmentAllowed({ nodeEnv: "production", dbEnv: "unknown" }), false);
    assert.equal(testHooksEnvironmentAllowed({ nodeEnv: undefined, dbEnv: undefined }), false);
    assert.equal(testHooksEnvironmentAllowed({ nodeEnv: "test", dbEnv: "test" }), false);
  });

  // ---------- Secret ----------

  await test("missing secret -> 401", () => {
    assert.deepEqual(checkTestHookAccess(staging, undefined), { ok: false, status: 401, reason: "missing-secret" });
    assert.deepEqual(checkTestHookAccess(staging, ""), { ok: false, status: 401, reason: "missing-secret" });
  });

  await test("incorrect secret -> 401 (wrong value, same length, prefix, extra char, case)", () => {
    const wrongSameLength = SECRET.slice(0, -1) + (SECRET.endsWith("a") ? "b" : "a");
    for (const wrong of ["nope", wrongSameLength, SECRET.slice(0, -1), SECRET + "x", SECRET.toUpperCase()]) {
      assert.deepEqual(checkTestHookAccess(staging, wrong), { ok: false, status: 401, reason: "invalid-secret" });
    }
  });

  await test("correct secret on staging and development -> allowed", () => {
    assert.deepEqual(checkTestHookAccess(staging, SECRET), { ok: true });
    assert.deepEqual(checkTestHookAccess(development, SECRET), { ok: true });
  });

  await test("production -> 404 even with the correct secret", () => {
    const prod: TestHookConfig = { nodeEnv: "production", dbEnv: "production", secret: SECRET };
    assert.deepEqual(checkTestHookAccess(prod, SECRET), { ok: false, status: 404, reason: "environment" });
    const prodDevNode: TestHookConfig = { nodeEnv: "development", dbEnv: "production", secret: SECRET };
    assert.deepEqual(checkTestHookAccess(prodDevNode, SECRET), { ok: false, status: 404, reason: "environment" });
  });

  await test("server secret missing, empty or too short -> hooks disabled (404), even for a matching header", () => {
    for (const secret of [undefined, "", "   ", "short", "x".repeat(31)]) {
      const config = { ...staging, secret };
      assert.equal(isUsableServerSecret(secret), false);
      assert.deepEqual(checkTestHookAccess(config, secret), { ok: false, status: 404, reason: "not-configured" });
    }
    assert.equal(isUsableServerSecret("x".repeat(32)), true);
  });

  await test("no local-development bypass: dev without a secret is still rejected", () => {
    assert.equal(checkTestHookAccess({ ...development, secret: undefined }, undefined).ok, false);
    assert.equal(checkTestHookAccess(development, undefined).ok, false);
  });

  await test("secretsMatch is exact and never throws on length mismatch", () => {
    assert.equal(secretsMatch(SECRET, SECRET), true);
    assert.equal(secretsMatch("a", SECRET), false);
    assert.equal(secretsMatch(SECRET + SECRET, SECRET), false);
    assert.equal(secretsMatch("", SECRET), false);
  });

  // ---------- Test accounts ----------

  await test("reserved test email domain is matched exactly", () => {
    assert.equal(isReservedTestEmail("test_player_1@tennisconnect.test"), true);
    assert.equal(isReservedTestEmail("Test_Case_Login@TennisConnect.TEST"), true);
    assert.equal(isReservedTestEmail("someone@gmail.com"), false);
    assert.equal(isReservedTestEmail("x@tennisconnect.test.evil.com"), false);
    assert.equal(isReservedTestEmail("x@evil-tennisconnect.test"), false);
    assert.equal(isReservedTestEmail("tennisconnect.test@gmail.com"), false);
    assert.equal(isReservedTestEmail(undefined), false);
  });

  await test("registrations are flagged isTestUser only on dev/staging and only for the reserved domain", () => {
    assert.equal(shouldFlagRegistrationAsTestUser("a@tennisconnect.test", staging), true);
    assert.equal(shouldFlagRegistrationAsTestUser("a@tennisconnect.test", development), true);
    assert.equal(shouldFlagRegistrationAsTestUser("a@gmail.com", staging), false);
    assert.equal(
      shouldFlagRegistrationAsTestUser("a@tennisconnect.test", { nodeEnv: "production", dbEnv: "production" }),
      false
    );
    assert.equal(
      shouldFlagRegistrationAsTestUser("a@tennisconnect.test", { nodeEnv: "development", dbEnv: "production" }),
      false
    );
  });

  // ---------- seed-session: valid test data ----------

  await test("valid test-owned data produces a normalised plan", async () => {
    const { lookups } = fakeLookups();
    const result = await validateSeedSessionInput(validSession(), lookups);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.plan.session.organizationId, "org-test");
      assert.ok(result.plan.session.startAt instanceof Date);
      assert.equal(result.plan.registrations.length, 4);
      assert.equal(result.plan.matches.length, 1);
    }
  });

  await test("optional fields keep their previous defaults ('' season/series -> none, status -> completed)", async () => {
    const { lookups } = fakeLookups();
    const body = { ...validSession(), seasonId: "", seriesId: "", status: undefined, registrations: undefined, matches: undefined };
    const result = await validateSeedSessionInput(body, lookups);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.plan.session.seasonId, undefined);
      assert.equal(result.plan.session.seriesId, undefined);
      assert.equal(result.plan.session.status, "completed");
      assert.deepEqual(result.plan.registrations, []);
    }
  });

  // ---------- seed-session: ownership / test-data boundaries ----------

  await test("ordinary or unknown creator -> 403", async () => {
    await expectRejected({ ...validSession(), createdBy: "real-user" }, 403, /createdBy/);
    await expectRejected({ ...validSession(), createdBy: "does-not-exist" }, 403, /createdBy/);
  });

  await test("organization of an ordinary user -> 403", async () => {
    await expectRejected({ ...validSession(), organizationId: "org-real" }, 403, /organizationId/);
  });

  await test("organization owned by a different test user -> 403", async () => {
    await expectRejected({ ...validSession(), organizationId: "org-other-test" }, 403, /organizationId/);
  });

  await test("unknown organization -> 403 (same answer as non-test, no id probing)", async () => {
    await expectRejected({ ...validSession(), organizationId: "nope" }, 403, /organizationId/);
  });

  await test("season or series from another organization -> 403", async () => {
    await expectRejected({ ...validSession(), seasonId: "season-real", seriesId: undefined }, 403, /seasonId/);
    await expectRejected({ ...validSession(), seriesId: "series-real" }, 403, /seriesId/);
    await expectRejected({ ...validSession(), seasonId: "nope" }, 403, /seasonId/);
  });

  await test("series from another season of the same organization -> 403", async () => {
    await expectRejected({ ...validSession(), seriesId: "series-test-s2" }, 403, /seriesId/);
  });

  await test("ordinary user as registration -> 403", async () => {
    const body = validSession();
    body.registrations.push({ userId: "real-user", checkedIn: false });
    await expectRejected(body, 403, /participant/);
  });

  await test("ordinary user only in a match (not registered) -> 403", async () => {
    const body = validSession();
    body.matches.push({ teamAIds: ["p1"], teamBIds: ["real-user"], teamAGames: 6, teamBGames: 0 });
    await expectRejected(body, 403, /participant/);
  });

  // ---------- seed-session: malformed input ----------

  await test("malformed input -> 400", async () => {
    await expectRejected(null, 400, /JSON object/);
    await expectRejected([], 400, /JSON object/);
    await expectRejected({ ...validSession(), title: "" }, 400, /required/);
    await expectRejected({ ...validSession(), organizationId: 42 }, 400, /non-empty strings/);
    await expectRejected({ ...validSession(), startAt: "not a date" }, 400, /startAt/);
    await expectRejected({ ...validSession(), status: "hacked" }, 400, /status/);
    await expectRejected({ ...validSession(), seasonId: { $ne: null } }, 400, /seasonId/);
    await expectRejected({ ...validSession(), registrations: "p1" }, 400, /registrations/);
    await expectRejected(
      { ...validSession(), registrations: [{ userId: "p1" }, { userId: "p1" }] },
      400,
      /duplicate/
    );
    await expectRejected(
      { ...validSession(), registrations: Array.from({ length: MAX_SEED_REGISTRATIONS + 1 }, (_, i) => ({ userId: `u${i}` })) },
      400,
      /at most/
    );
    await expectRejected(
      { ...validSession(), matches: [{ teamAIds: ["p1"], teamBIds: ["p1"], teamAGames: 6, teamBGames: 0 }] },
      400,
      /both teams/
    );
    await expectRejected(
      { ...validSession(), matches: [{ teamAIds: ["p1"], teamBIds: ["p2"], teamAGames: -1, teamBGames: 0 }] },
      400,
      /games/i
    );
    await expectRejected(
      { ...validSession(), matches: [{ teamAIds: [], teamBIds: ["p2"], teamAGames: 6, teamBGames: 0 }] },
      400,
      /teamAIds/
    );
  });

  await test("malformed input is rejected before any lookup runs", async () => {
    const { lookups, calls } = fakeLookups();
    await validateSeedSessionInput({ ...validSession(), status: "hacked" }, lookups);
    assert.deepEqual(calls, []);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
