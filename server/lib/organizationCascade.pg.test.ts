// E2E_TEST_PG_URL=postgres://postgres@127.0.0.1:5432/tc_it npx tsx --test server/lib/organizationCascade.pg.test.ts
//
// Organisation / account deletion against a REAL Postgres (a throwaway
// local schema built from shared/schema.ts - see server/test-support).
// Skipped unless E2E_TEST_PG_URL points at a loopback server; CI's
// db-integration job provides one.

import test from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, sql } from "drizzle-orm";
import {
  communityMemberships,
  externalActivities,
  matches,
  messages,
  organizationMembers,
  organizations,
  organizerRequests,
  registrations,
  seasons,
  series,
  sessionRounds,
  sessionTemplates,
  sessionUpdates,
  tennisSessions,
  tournamentHistory,
  users,
} from "@shared/schema";
import { createTestDb, testPgUrl, type TestDb } from "../test-support/pgTestDb";
import { makeFixtures } from "../test-support/dbFixtures";
import { cascadeDeleteOrganizations } from "./organizationCascade";
import { deleteUserRows } from "./userCascade";

const url = testPgUrl();
const skip = url ? false : "set E2E_TEST_PG_URL to a local Postgres to run database integration tests";

async function withDb(fn: (t: TestDb, f: ReturnType<typeof makeFixtures>) => Promise<void>) {
  const t = await createTestDb(url!);
  try {
    await fn(t, makeFixtures(t.db));
  } finally {
    await t.dispose();
  }
}

/** Postgres foreign_key_violation (23503) - Drizzle wraps it as error.cause. */
function isForeignKeyViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23503" || e?.cause?.code === "23503";
}

async function count(t: TestDb, table: any, where: any) {
  const [row] = await t.db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return row.n;
}

/** An organisation with everything that hangs off it. */
async function buildOrganisation(f: ReturnType<typeof makeFixtures>, ownerId: string, playerId: string) {
  const org = await f.organization(ownerId);
  const season = await f.season(org.id, ownerId);
  const ser = await f.series(org.id, season.id, ownerId);
  const template = await f.template(org.id, ownerId);
  const parent = await f.session(org.id, ownerId, { seasonId: season.id, seriesId: ser.id, status: "completed" });
  const child = await f.session(org.id, ownerId, { parentSessionId: parent.id });
  const update = await f.sessionUpdate(parent.id, ownerId);
  const registration = await f.registration(parent.id, playerId);
  const round = await f.round(parent.id);
  const match = await f.match(parent.id, round.id, [ownerId], [playerId]);
  await f.communityMember(org.id, playerId);
  await f.orgMember(org.id, ownerId);
  return { org, season, ser, template, parent, child, update, registration, round, match };
}

test("raw organisation delete fails while seasons exist (the bug this stage fixes)", { skip }, () =>
  withDb(async (t, f) => {
    const owner = await f.user("owner@tennisconnect.test");
    const org = await f.organization(owner.id);
    await f.season(org.id, owner.id);
    await assert.rejects(t.db.delete(organizations).where(eq(organizations.id, org.id)), (error: unknown) => isForeignKeyViolation(error));
  })
);

test("cascade removes an organisation with seasons, series, templates, sessions, updates, rounds, matches", { skip }, () =>
  withDb(async (t, f) => {
    const owner = await f.user("owner@tennisconnect.test");
    const player = await f.user("player@tennisconnect.test");
    const a = await buildOrganisation(f, owner.id, player.id);

    // Optional references from elsewhere - must be detached, not deleted.
    const sessionMessage = await f.message(owner.id, player.id, { relatedSessionId: a.parent.id, relatedOrganizationId: a.org.id });
    const partnered = await f.externalActivity({ partnerId: a.org.id, duplicateOfSessionId: a.parent.id });
    const history = await f.tournamentHistory(player.id, { sessionId: a.parent.id });

    // A second organisation that must be untouched.
    const otherOwner = await f.user("other-owner@tennisconnect.test");
    const b = await buildOrganisation(f, otherOwner.id, player.id);

    const result = await t.db.transaction((tx) => cascadeDeleteOrganizations(tx, [a.org.id]));
    assert.deepEqual(result, {
      organizations: 1, sessions: 2, seasons: 1, series: 1, sessionTemplates: 1,
      sessionUpdates: 1, registrations: 1, rounds: 1, matches: 1, memberships: 2,
    });

    // Organisation A and everything under it are gone.
    assert.equal(await count(t, organizations, eq(organizations.id, a.org.id)), 0);
    assert.equal(await count(t, tennisSessions, eq(tennisSessions.organizationId, a.org.id)), 0);
    assert.equal(await count(t, seasons, eq(seasons.organizationId, a.org.id)), 0);
    assert.equal(await count(t, series, eq(series.organizationId, a.org.id)), 0);
    assert.equal(await count(t, sessionTemplates, eq(sessionTemplates.organizationId, a.org.id)), 0);
    assert.equal(await count(t, sessionUpdates, eq(sessionUpdates.sessionId, a.parent.id)), 0);
    assert.equal(await count(t, registrations, eq(registrations.sessionId, a.parent.id)), 0);
    assert.equal(await count(t, sessionRounds, eq(sessionRounds.sessionId, a.parent.id)), 0);
    assert.equal(await count(t, matches, eq(matches.sessionId, a.parent.id)), 0);
    assert.equal(await count(t, communityMemberships, eq(communityMemberships.organizationId, a.org.id)), 0);
    assert.equal(await count(t, organizationMembers, eq(organizationMembers.organizationId, a.org.id)), 0);

    // Referencing rows survive, detached.
    const [msg] = await t.db.select().from(messages).where(eq(messages.id, sessionMessage.id));
    assert.equal(msg.relatedSessionId, null);
    assert.equal(msg.relatedOrganizationId, null);
    const [activity] = await t.db.select().from(externalActivities).where(eq(externalActivities.id, partnered.id));
    assert.equal(activity.partnerId, null);
    assert.equal(activity.duplicateOfSessionId, null);
    const [hist] = await t.db.select().from(tournamentHistory).where(eq(tournamentHistory.id, history.id));
    assert.equal(hist.sessionId, null);

    // Users and organisation B are untouched.
    assert.equal(await count(t, users, inArray(users.id, [owner.id, player.id, otherOwner.id])), 3);
    assert.equal(await count(t, organizations, eq(organizations.id, b.org.id)), 1);
    assert.equal(await count(t, tennisSessions, eq(tennisSessions.organizationId, b.org.id)), 2);
    assert.equal(await count(t, seasons, eq(seasons.organizationId, b.org.id)), 1);
    assert.equal(await count(t, registrations, eq(registrations.sessionId, b.parent.id)), 1);
    assert.equal(await count(t, matches, eq(matches.sessionId, b.parent.id)), 1);
  })
);

test("cascade inside a transaction rolls back completely on error", { skip }, () =>
  withDb(async (t, f) => {
    const owner = await f.user("owner@tennisconnect.test");
    const player = await f.user("player@tennisconnect.test");
    const a = await buildOrganisation(f, owner.id, player.id);
    await assert.rejects(
      t.db.transaction(async (tx) => {
        await cascadeDeleteOrganizations(tx, [a.org.id]);
        throw new Error("abort after cascade");
      }),
      /abort after cascade/
    );
    assert.equal(await count(t, organizations, eq(organizations.id, a.org.id)), 1);
    assert.equal(await count(t, seasons, eq(seasons.organizationId, a.org.id)), 1);
    assert.equal(await count(t, tennisSessions, eq(tennisSessions.organizationId, a.org.id)), 2);
  })
);

test("cascade of an empty list or unknown id changes nothing", { skip }, () =>
  withDb(async (t, f) => {
    const owner = await f.user("owner@tennisconnect.test");
    const org = await f.organization(owner.id);
    assert.equal((await cascadeDeleteOrganizations(t.db, [])).organizations, 0);
    assert.equal((await cascadeDeleteOrganizations(t.db, ["00000000-0000-0000-0000-000000000000"])).organizations, 0);
    assert.equal(await count(t, organizations, eq(organizations.id, org.id)), 1);
  })
);

test("account deletion: owner of a session-less organisation WITH seasons can be deleted", { skip }, () =>
  withDb(async (t, f) => {
    const owner = await f.user("owner@tennisconnect.test");
    const org = await f.organization(owner.id);
    await f.season(org.id, owner.id);
    await f.template(org.id, owner.id);
    await t.db.transaction(async (tx) => {
      await cascadeDeleteOrganizations(tx, [org.id]);
      assert.equal(await deleteUserRows(tx, [owner.id]), 1);
    });
    assert.equal(await count(t, users, eq(users.id, owner.id)), 0);
  })
);

test("account deletion: an admin who reviewed a discovery activity can be deleted (reviewed_by detached)", { skip }, () =>
  withDb(async (t, f) => {
    const admin = await f.user("admin2@tennisconnect.test", { isAdmin: true });
    const applicant = await f.user("applicant@tennisconnect.test");
    const activity = await f.externalActivity({ reviewedBy: admin.id });
    const request = await f.organizerRequest(applicant.id, admin.id);
    assert.equal(await t.db.transaction((tx) => deleteUserRows(tx, [admin.id])), 1);
    const [act] = await t.db.select().from(externalActivities).where(eq(externalActivities.id, activity.id));
    assert.equal(act.reviewedBy, null);
    const [req] = await t.db.select().from(organizerRequests).where(eq(organizerRequests.id, request.id));
    assert.equal(req.reviewedBy, null);
    assert.equal(await count(t, users, eq(users.id, applicant.id)), 1);
  })
);

test("account deletion fails closed (rolls back) while the user still owns an organisation", { skip }, () =>
  withDb(async (t, f) => {
    const owner = await f.user("owner@tennisconnect.test");
    const org = await f.organization(owner.id);
    await assert.rejects(t.db.transaction((tx) => deleteUserRows(tx, [owner.id])), (error: unknown) => isForeignKeyViolation(error));
    assert.equal(await count(t, users, eq(users.id, owner.id)), 1);
    assert.equal(await count(t, organizations, eq(organizations.id, org.id)), 1);
  })
);
