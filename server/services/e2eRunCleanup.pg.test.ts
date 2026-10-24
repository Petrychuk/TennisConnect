// E2E_TEST_PG_URL=postgres://postgres@127.0.0.1:5432/tc_it npx tsx --test server/services/e2eRunCleanup.pg.test.ts
//
// Run-scoped cleanup against a REAL Postgres (throwaway local schema built
// from shared/schema.ts). Skipped unless E2E_TEST_PG_URL points at a
// loopback server; CI's db-integration job provides one.
//
// The world in every test: this run's users and data, ANOTHER run's users
// and data, Stage 2 baseline + fixture accounts with a fixture organisation,
// a legacy test user and a real user - plus files in a fake bucket for all
// of them. Only this run's rows and files may disappear.

import test from "node:test";
import assert from "node:assert/strict";
import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  marketplaceItems,
  matches,
  messages,
  organizations,
  playerProfiles,
  registrations,
  seasons,
  tennisSessions,
  users,
} from "@shared/schema";
import { createTestDb, testPgUrl, type TestDb } from "../test-support/pgTestDb";
import { makeFixtures } from "../test-support/dbFixtures";
import { generateRunId, runScopedEmail } from "../seeds/e2e/identities";
import { applyRunCleanup, listRunResidue, planRunCleanup, type RunStorage } from "./e2eRunCleanup";

const url = testPgUrl();
const skip = url ? false : "set E2E_TEST_PG_URL to a local Postgres to run database integration tests";

const RUN = generateRunId(1_790_000_000_000, Buffer.from("1111111111111111", "hex"));
const OTHER_RUN = generateRunId(1_790_000_000_000, Buffer.from("2222222222222222", "hex"));
const ENABLED = { removeFiles: true } as const;
const DISABLED = { removeFiles: false } as const;

class MemoryBucket implements RunStorage {
  files = new Set<string>();
  removed: string[] = [];
  onRemove?: () => Promise<void>;
  async listFiles(prefix: string) {
    return Array.from(this.files).filter((path) => path.startsWith(prefix));
  }
  async remove(paths: string[]) {
    for (const path of paths) {
      this.files.delete(path);
      this.removed.push(path);
    }
    await this.onRemove?.();
  }
}

async function buildWorld(t: TestDb) {
  const f = makeFixtures(t.db);

  // Stage 2 permanent accounts + fixture organisation.
  const baselinePlayer = await f.user("e2e-player@tennisconnect.test", { isTestUser: true });
  const baselineCoach = await f.user("e2e-coach@tennisconnect.test", { isTestUser: true, role: "coach" });
  const baselineAdmin = await f.user("e2e-admin@tennisconnect.test", { isTestUser: true, isAdmin: true });
  const baselineOrganiser = await f.user("e2e-organiser@tennisconnect.test", { isTestUser: true, isOrganizer: true });
  const fixturePlayer = await f.user("e2e-fixture-player-01@tennisconnect.test", { isTestUser: true });
  await f.playerProfile(baselinePlayer.id);
  const fixtureOrg = await f.organization(baselineOrganiser.id, "[E2E] Harbourside Social Tennis");
  const fixtureSession = await f.session(fixtureOrg.id, baselineOrganiser.id, { status: "published" });
  await f.registration(fixtureSession.id, fixturePlayer.id);
  const fixtureMessage = await f.message(baselinePlayer.id, baselineCoach.id);

  // Non-run people.
  const legacy = await f.user("test_player_1700000000000_abcd1234@tennisconnect.test", { isTestUser: true });
  const real = await f.user("real.person@gmail.com", { isTestUser: false });

  // THIS run: an organiser with a full organisation, and a player.
  const organiser = await f.user(runScopedEmail(RUN, "organiser"), { isTestUser: true, isOrganizer: true });
  const player = await f.user(runScopedEmail(RUN, "player"), { isTestUser: true });
  const org = await f.organization(organiser.id);
  const season = await f.season(org.id, organiser.id);
  const ser = await f.series(org.id, season.id, organiser.id);
  await f.template(org.id, organiser.id);
  const session = await f.session(org.id, organiser.id, { seasonId: season.id, seriesId: ser.id, status: "published" });
  await f.sessionUpdate(session.id, organiser.id);
  await f.registration(session.id, player.id);
  await f.registration(session.id, baselinePlayer.id); // a shared Stage 2 account joined the run's session
  const round = await f.round(session.id);
  await f.match(session.id, round.id, [organiser.id], [player.id]);
  await f.communityMember(org.id, player.id);
  await f.registration(fixtureSession.id, player.id); // run player joined the FIXTURE session
  await f.message(player.id, organiser.id);
  await f.message(player.id, baselineCoach.id);
  await f.message(baselineAdmin.id, organiser.id); // shared admin wrote to a run user
  await f.marketplaceItem(player.id);
  await f.tournamentHistory(player.id);
  await f.playerProfile(player.id);

  // ANOTHER run with its own organisation.
  const otherUser = await f.user(runScopedEmail(OTHER_RUN, "organiser"), { isTestUser: true, isOrganizer: true });
  const otherOrg = await f.organization(otherUser.id);
  const otherSession = await f.session(otherOrg.id, otherUser.id);

  const bucket = new MemoryBucket();
  for (const path of [
    `players/${player.id}/avatar.webp`,
    `players/${player.id}/gallery/1.webp`,
    `players/${player.id}/tournaments/t1/a.jpg`,
    `marketplace/${player.id}/item/1.webp`,
    `sessions/${organiser.id}/cover.webp`,
    `players/${organiser.id}/cover.webp`,
    `players/${otherUser.id}/avatar.webp`,
    `players/${baselinePlayer.id}/avatar.webp`,
    `coaches/${baselineCoach.id}/avatar.webp`,
    `players/${real.id}/avatar.webp`,
    `clubs/some-club/logo.webp`,
  ]) bucket.files.add(path);

  return {
    f, bucket, organiser, player, org, session, fixtureSession, fixtureMessage, fixtureOrg,
    baselinePlayer, baselineCoach, baselineAdmin, baselineOrganiser, fixturePlayer, legacy, real, otherUser, otherOrg, otherSession,
  };
}

async function withWorld(fn: (t: TestDb, w: Awaited<ReturnType<typeof buildWorld>>) => Promise<void>) {
  const t = await createTestDb(url!);
  try {
    await fn(t, await buildWorld(t));
  } finally {
    await t.dispose();
  }
}

const snapshot = async (t: TestDb, ids: string[]) =>
  JSON.stringify(await t.db.select().from(users).where(inArray(users.id, ids)).orderBy(asc(users.id)));
const total = async (t: TestDb, table: any) => (await t.db.select({ n: sql<number>`count(*)::int` }).from(table))[0].n;

test("dry run reports this run's data and deletes nothing", { skip }, () =>
  withWorld(async (t, w) => {
    const before = await total(t, users);
    const plan = await planRunCleanup(t.db, RUN);
    assert.deepEqual(plan.refusals, []);
    assert.deepEqual(plan.users.map((u) => u.email).sort(), [runScopedEmail(RUN, "organiser"), runScopedEmail(RUN, "player")].sort());
    assert.deepEqual(plan.organizationIds, [w.org.id]);
    assert.equal(plan.counts.sessions, 1);
    assert.equal(plan.counts.seasons, 1);
    assert.equal(plan.counts.registrationsInRunSessions, 2);
    assert.equal(plan.counts.messages, 3);
    assert.equal(await total(t, users), before);
  })
);

test("apply deletes exactly this run's rows and files; everything else is untouched", { skip }, () =>
  withWorld(async (t, w) => {
    const keepIds = [w.baselinePlayer.id, w.baselineCoach.id, w.baselineAdmin.id, w.baselineOrganiser.id, w.fixturePlayer.id, w.legacy.id, w.real.id, w.otherUser.id];
    const keptBefore = await snapshot(t, keepIds);

    const result = await applyRunCleanup(t.db, RUN, w.bucket, ENABLED);
    assert.equal(result.usersDeleted, 2);
    assert.equal(result.organizations?.organizations, 1);
    assert.equal(result.organizations?.seasons, 1);
    assert.equal(result.storage.removed, 6);

    // This run is gone.
    assert.equal((await t.db.select().from(users).where(inArray(users.id, [w.organiser.id, w.player.id]))).length, 0);
    assert.equal((await t.db.select().from(organizations).where(eq(organizations.id, w.org.id))).length, 0);
    assert.equal((await t.db.select().from(tennisSessions).where(eq(tennisSessions.id, w.session.id))).length, 0);
    assert.equal((await t.db.select().from(marketplaceItems).where(eq(marketplaceItems.userId, w.player.id))).length, 0);
    assert.equal((await t.db.select().from(playerProfiles).where(eq(playerProfiles.userId, w.player.id))).length, 0);

    // Every other user row is byte-for-byte unchanged (baseline, fixture, legacy, real, other run).
    assert.equal(await snapshot(t, keepIds), keptBefore);
    assert.equal((await t.db.select().from(playerProfiles).where(eq(playerProfiles.userId, w.baselinePlayer.id))).length, 1);

    // Fixture organisation, its session, its other registration and the fixture message survive.
    assert.equal((await t.db.select().from(organizations).where(eq(organizations.id, w.fixtureOrg.id))).length, 1);
    const fixtureRegs = await t.db.select().from(registrations).where(eq(registrations.sessionId, w.fixtureSession.id));
    assert.deepEqual(fixtureRegs.map((r) => r.userId), [w.fixturePlayer.id]);
    assert.equal((await t.db.select().from(messages).where(eq(messages.id, w.fixtureMessage.id))).length, 1);

    // The other run is untouched.
    assert.equal((await t.db.select().from(organizations).where(eq(organizations.id, w.otherOrg.id))).length, 1);
    assert.equal((await t.db.select().from(tennisSessions).where(eq(tennisSessions.id, w.otherSession.id))).length, 1);

    // Only this run's files were removed.
    assert.ok(w.bucket.removed.every((path) => path.includes(w.player.id) || path.includes(w.organiser.id)));
    for (const keep of [`players/${w.otherUser.id}/avatar.webp`, `players/${w.baselinePlayer.id}/avatar.webp`, `coaches/${w.baselineCoach.id}/avatar.webp`, `players/${w.real.id}/avatar.webp`, `clubs/some-club/logo.webp`]) {
      assert.ok(w.bucket.files.has(keep), keep);
    }

    // Idempotent: a second plan finds nothing.
    const again = await planRunCleanup(t.db, RUN);
    assert.equal(again.users.length, 0);
    assert.equal((await applyRunCleanup(t.db, RUN, w.bucket, ENABLED)).usersDeleted, 0);
  })
);

async function assertRefusedAndUntouched(t: TestDb, w: Awaited<ReturnType<typeof buildWorld>>, pattern: RegExp) {
  const usersBefore = await total(t, users);
  const filesBefore = w.bucket.files.size;
  const plan = await planRunCleanup(t.db, RUN);
  assert.ok(plan.refusals.some((r) => pattern.test(r)), plan.refusals.join("; "));
  await assert.rejects(applyRunCleanup(t.db, RUN, w.bucket, ENABLED), (error: Error) => error.name === "RunCleanupError" && pattern.test(error.message));
  assert.equal(await total(t, users), usersBefore);
  assert.equal(w.bucket.files.size, filesBefore, "no file removed on refusal");
}

test("refuses (nothing deleted) when a real user registered for the run's session", { skip }, () =>
  withWorld(async (t, w) => {
    await w.f.registration(w.session.id, w.real.id);
    await assertRefusedAndUntouched(t, w, /registration\(s\).*outside the run/);
  })
);

test("refuses when another run's user joined the run's organisation", { skip }, () =>
  withWorld(async (t, w) => {
    await w.f.communityMember(w.org.id, w.otherUser.id);
    await assertRefusedAndUntouched(t, w, /membership\(s\).*outside the run/);
  })
);

test("refuses when a run user exchanged messages with a real user or a legacy test user", { skip }, () =>
  withWorld(async (t, w) => {
    await w.f.message(w.real.id, w.player.id);
    await assertRefusedAndUntouched(t, w, /message\(s\) exchanged/);
  })
);

test("refuses when a run user created rows in an organisation the run does not own", { skip }, () =>
  withWorld(async (t, w) => {
    await w.f.season(w.fixtureOrg.id, w.player.id);
    await assertRefusedAndUntouched(t, w, /created by run users in organisations the run does not own/);
  })
);

test("refuses when a run-pattern account is not a test user, or is an admin", { skip }, () =>
  withWorld(async (t, w) => {
    await t.db.update(users).set({ isTestUser: false }).where(eq(users.id, w.player.id));
    await assertRefusedAndUntouched(t, w, /not flagged as a test user/);
    await t.db.update(users).set({ isTestUser: true, isAdmin: true }).where(eq(users.id, w.player.id));
    await assertRefusedAndUntouched(t, w, /is an admin/);
  })
);

test("aborts the database step if the run changes during cleanup", { skip }, () =>
  withWorld(async (t, w) => {
    w.bucket.onRemove = async () => {
      if (!(await t.db.select().from(users).where(eq(users.email, runScopedEmail(RUN, "late")))).length) {
        await w.f.user(runScopedEmail(RUN, "late"), { isTestUser: true });
      }
    };
    await assert.rejects(applyRunCleanup(t.db, RUN, w.bucket, ENABLED), /users changed during cleanup/);
    assert.equal((await t.db.select().from(users).where(eq(users.id, w.organiser.id))).length, 1, "DB untouched");
    assert.equal((await t.db.select().from(seasons).where(eq(seasons.organizationId, w.org.id))).length, 1);
  })
);

test("a storage listing outside the run's folders aborts before anything is deleted", { skip }, () =>
  withWorld(async (t, w) => {
    const evil: RunStorage = {
      listFiles: async () => [`players/${w.real.id}/avatar.webp`],
      remove: async () => assert.fail("remove must not be called"),
    };
    await assert.rejects(applyRunCleanup(t.db, RUN, evil, ENABLED), /outside this run's folders/);
    assert.equal((await t.db.select().from(users).where(eq(users.id, w.player.id))).length, 1);
  })
);

test("cleaning one run never touches another run", { skip }, () =>
  withWorld(async (t, w) => {
    await applyRunCleanup(t.db, OTHER_RUN, w.bucket, ENABLED);
    assert.equal((await t.db.select().from(users).where(inArray(users.id, [w.organiser.id, w.player.id]))).length, 2);
    assert.equal((await t.db.select().from(organizations).where(eq(organizations.id, w.org.id))).length, 1);
    assert.ok(w.bucket.files.has(`players/${w.player.id}/avatar.webp`));
    assert.ok(!w.bucket.files.has(`players/${w.otherUser.id}/avatar.webp`));
  })
);

test("residue lists runs that still own users; invalid run ids are rejected", { skip }, () =>
  withWorld(async (t) => {
    const residue = await listRunResidue(t.db);
    assert.deepEqual(residue.map((r) => [r.runId, r.users]).sort(), [[OTHER_RUN, 1], [RUN, 2]].sort());
    await assert.rejects(planRunCleanup(t.db, "not-a-run"), /invalid run id/);
    await assert.rejects(planRunCleanup(t.db, "%"), /invalid run id/);
  })
);

// ---------- Outside rows that point AT the run's data ----------

const runSeasonId = async (t: TestDb, orgId: string) =>
  (await t.db.select({ id: seasons.id }).from(seasons).where(eq(seasons.organizationId, orgId)))[0].id;

test("refuses when another organisation's series uses one of the run's seasons", { skip }, () =>
  withWorld(async (t, w) => {
    await w.f.series(w.otherOrg.id, await runSeasonId(t, w.org.id), w.otherUser.id);
    await assertRefusedAndUntouched(t, w, /series of another organisation use this run's seasons/);
  })
);

test("refuses when another organisation's session is linked to the run's season or session", { skip }, () =>
  withWorld(async (t, w) => {
    await t.db.update(tennisSessions).set({ parentSessionId: w.session.id }).where(eq(tennisSessions.id, w.otherSession.id));
    await assertRefusedAndUntouched(t, w, /session\(s\) of another organisation are linked/);
  })
);

test("refuses when another user's tournament history references the run's session", { skip }, () =>
  withWorld(async (t, w) => {
    await w.f.tournamentHistory(w.fixturePlayer.id, { sessionId: w.session.id });
    await assertRefusedAndUntouched(t, w, /tournament history .* reference this run's sessions/);
  })
);

test("refuses when a discovery activity points at the run's organisation or session", { skip }, () =>
  withWorld(async (t, w) => {
    await w.f.externalActivity({ partnerId: w.org.id });
    await assertRefusedAndUntouched(t, w, /list this run's organisation as partner/);
  })
);

test("refuses when a message between other users references the run's session (incl. no registered sender)", { skip }, () =>
  withWorld(async (t, w) => {
    await t.db.insert(messages).values({
      senderUserId: null,
      senderName: "Guest",
      senderEmail: "guest@tennisconnect.test",
      recipientId: w.baselineCoach.id,
      recipientType: "coach",
      subject: "Linked",
      content: "points at a run session",
      relatedSessionId: w.session.id,
    } as typeof messages.$inferInsert);
    await assertRefusedAndUntouched(t, w, /message\(s\) between other users reference this run's sessions/);
  })
);

test("refuses when a run user reported a match outside the run", { skip }, () =>
  withWorld(async (t, w) => {
    const round = await w.f.round(w.fixtureSession.id);
    const match = await w.f.match(w.fixtureSession.id, round.id, [w.baselinePlayer.id], [w.fixturePlayer.id]);
    await t.db.update(matches).set({ reportedBy: w.player.id }).where(eq(matches.id, match.id));
    await assertRefusedAndUntouched(t, w, /match\(es\) outside this run were reported or confirmed by run users/);
  })
);

// ---------- Uploaded files: deletion only when enabled ----------

test("file cleanup disabled: a run with uploaded files is refused and nothing is deleted", { skip }, () =>
  withWorld(async (t, w) => {
    const usersBefore = await total(t, users);
    const filesBefore = w.bucket.files.size;
    await assert.rejects(applyRunCleanup(t.db, RUN, w.bucket, DISABLED), /file cleanup is disabled/);
    assert.equal(await total(t, users), usersBefore);
    assert.equal(w.bucket.files.size, filesBefore);
    assert.deepEqual(w.bucket.removed, []);
  })
);

test("file cleanup disabled: a run without uploaded files is still cleaned, no storage write", { skip }, () =>
  withWorld(async (t, w) => {
    for (const path of Array.from(w.bucket.files)) {
      if (path.includes(`/${w.player.id}/`) || path.includes(`/${w.organiser.id}/`)) w.bucket.files.delete(path);
    }
    const result = await applyRunCleanup(t.db, RUN, w.bucket, DISABLED);
    assert.equal(result.usersDeleted, 2);
    assert.equal(result.storage.removed, 0);
    assert.deepEqual(w.bucket.removed, [], "no storage write at all");
  })
);

test("no storage adapter: apply refuses (cannot prove there are no files)", { skip }, () =>
  withWorld(async (t) => {
    const usersBefore = await total(t, users);
    await assert.rejects(applyRunCleanup(t.db, RUN, null, ENABLED), /no storage adapter/);
    assert.equal(await total(t, users), usersBefore);
  })
);
