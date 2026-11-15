// E2E_TEST_PG_URL=postgres://postgres@127.0.0.1:5432/tc_it npx tsx --test server/lib/registrationTx.pg.test.ts
//
// TC-213 (OH-AUDIT-003 / 007 / 008) against a REAL Postgres: registrations,
// capacity and the waiting list under concurrency. Each test gets a throwaway
// schema (server/test-support). Skipped unless E2E_TEST_PG_URL points at a
// loopback server; CI's db-integration job provides one (postgres:16).
//
// The functions under test are the exact ones storage.ts calls
// (server/lib/registrationTx.ts) - they take the executor as a parameter.

import test from "node:test";
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { registrationAuditEvents, registrations, tennisSessions } from "@shared/schema";
import { createTestDb, testPgUrl, type TestDb } from "../test-support/pgTestDb";
import { makeFixtures } from "../test-support/dbFixtures";
import {
  acceptInvitation,
  cancelPlayerRegistration,
  lateRegisterPlayer,
  moveRegistrationToWaitlist,
  registerPlayer,
  removeRegistrationById,
  updateSessionCapacity,
} from "./registrationTx";
import { LiveRuleError } from "./liveErrors";

const url = testPgUrl();
const skip = url ? false : "set E2E_TEST_PG_URL to a local Postgres to run database integration tests";

const DAY = 24 * 3600 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY);

type F = ReturnType<typeof makeFixtures>;

async function withDb(fn: (t: TestDb, f: F) => Promise<void>) {
  const t = await createTestDb(url!);
  try {
    await fn(t, makeFixtures(t.db));
  } finally {
    await t.dispose();
  }
}

/** An organiser's published session (a week out) and `n` players. */
async function setup(f: F, extra: Partial<typeof tennisSessions.$inferInsert>, n: number) {
  const owner = await f.user("owner@tennisconnect.test");
  const org = await f.organization(owner.id);
  const session = await f.session(org.id, owner.id, { status: "published", startAt: inDays(7), maxParticipants: 2, waitingListEnabled: true, ...extra });
  const players = [];
  for (let i = 0; i < n; i++) players.push(await f.user(`p${i}@tennisconnect.test`));
  return { session, players: players.map((p) => p.id) };
}

/** A registration row as it is, with an explicit join time so waiting-list order is deterministic. */
async function place(t: TestDb, sessionId: string, userId: string, status: string, minutesAgo = 0, extra: Record<string, unknown> = {}) {
  const [row] = await t.db
    .insert(registrations)
    .values({ sessionId, userId, status, createdAt: new Date(Date.now() - minutesAgo * 60_000), ...extra })
    .returning();
  return row;
}

async function statusOf(t: TestDb, sessionId: string): Promise<Record<string, string>> {
  const rows = await t.db.select().from(registrations).where(eq(registrations.sessionId, sessionId));
  return Object.fromEntries(rows.map((r) => [r.userId, r.status]));
}

async function count(t: TestDb, sessionId: string, status: string): Promise<number> {
  const [row] = await t.db
    .select({ n: sql<number>`count(*)::int` })
    .from(registrations)
    .where(and(eq(registrations.sessionId, sessionId), eq(registrations.status, status)));
  return row.n;
}

async function maxOf(t: TestDb, sessionId: string) {
  const [row] = await t.db.select({ max: tennisSessions.maxParticipants }).from(tennisSessions).where(eq(tennisSessions.id, sessionId));
  return row.max;
}

// ---------- Joining ----------

test("two players asking for the last place at once: one gets it, the other is waitlisted", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 2 }, 3);
    await place(t, session.id, players[0], "registered", 10);
    const results = await Promise.all([registerPlayer(t.db, session.id, players[1]), registerPlayer(t.db, session.id, players[2])]);
    assert.deepEqual(results.map((r) => r.waitlisted).sort(), [false, true]);
    assert.equal(await count(t, session.id, "registered"), 2);
    assert.equal(await count(t, session.id, "waitlisted"), 1);
  })
);

test("last place without a waiting list: one joins, the other is told it's full", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1, waitingListEnabled: false }, 2);
    const results = await Promise.allSettled(players.map((p) => registerPlayer(t.db, session.id, p)));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.equal(rejected.reason.message, "Session is full");
    assert.equal(await count(t, session.id, "registered"), 1);
  })
);

test("eight players for three places at once: exactly three registered, five waitlisted", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 3 }, 8);
    await Promise.all(players.map((p) => registerPlayer(t.db, session.id, p)));
    assert.equal(await count(t, session.id, "registered"), 3);
    assert.equal(await count(t, session.id, "waitlisted"), 5);
  })
);

test("the same player joining twice at once: one row, one change", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 5 }, 1);
    const results = await Promise.all([registerPlayer(t.db, session.id, players[0]), registerPlayer(t.db, session.id, players[0])]);
    assert.deepEqual(results.map((r) => r.changed).sort(), [false, true]);
    assert.equal(results[0].registration.id, results[1].registration.id);
    const rows = await t.db.select().from(registrations).where(eq(registrations.sessionId, session.id));
    assert.equal(rows.length, 1);
  })
);

test("joining again after cancelling queues behind everyone already waiting", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1 }, 3);
    const [a, b, c] = players;
    const original = await place(t, session.id, a, "cancelled", 60);
    await place(t, session.id, b, "registered", 30);
    await place(t, session.id, c, "waitlisted", 20);
    const again = await registerPlayer(t.db, session.id, a);
    assert.equal(again.registration.status, "waitlisted");
    assert.ok(again.registration.createdAt > original.createdAt, "a new join time, not the old one");
    await cancelPlayerRegistration(t.db, session.id, b);
    assert.deepEqual(await statusOf(t, session.id), { [a]: "waitlisted", [b]: "cancelled", [c]: "registered" }, "the earlier waiter goes first");
  })
);

// ---------- Freed places ----------

test("two places freed at once go to the two oldest waitlisted players - each exactly once, never over capacity", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 2 }, 5);
    const [p1, p2, w1, w2, w3] = players;
    await place(t, session.id, p1, "registered", 60);
    const r2 = await place(t, session.id, p2, "registered", 50);
    await place(t, session.id, w1, "waitlisted", 40);
    await place(t, session.id, w2, "waitlisted", 30);
    await place(t, session.id, w3, "waitlisted", 20);

    // The player cancels while the organiser removes the other one.
    const [byPlayer, byOrganiser] = await Promise.all([
      cancelPlayerRegistration(t.db, session.id, p1),
      removeRegistrationById(t.db, r2.id),
    ]);
    assert.equal(byPlayer.promotedIds.length + byOrganiser.promotedIds.length, 2);
    assert.deepEqual(await statusOf(t, session.id), { [p1]: "cancelled", [p2]: "cancelled", [w1]: "registered", [w2]: "registered", [w3]: "waitlisted" });
    assert.equal(await count(t, session.id, "registered"), 2);
  })
);

test("cancelling or removing twice is a no-op: nobody else is promoted", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1 }, 3);
    const [p1, w1, w2] = players;
    const reg = await place(t, session.id, p1, "registered", 60);
    await place(t, session.id, w1, "waitlisted", 40);
    await place(t, session.id, w2, "waitlisted", 30);

    const first = await cancelPlayerRegistration(t.db, session.id, p1);
    assert.equal(first.changed, true);
    assert.equal(first.promotedIds.length, 1);
    const repeats = await Promise.all([cancelPlayerRegistration(t.db, session.id, p1), removeRegistrationById(t.db, reg.id), removeRegistrationById(t.db, reg.id)]);
    assert.deepEqual(repeats.map((r) => [r.changed, r.promotedIds.length]), [[false, 0], [false, 0], [false, 0]]);
    assert.deepEqual(await statusOf(t, session.id), { [p1]: "cancelled", [w1]: "registered", [w2]: "waitlisted" });
  })
);

test("a waitlisted or invited player leaving frees no place: nobody is promoted", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1 }, 4);
    const [p1, w1, w2, inv] = players;
    await place(t, session.id, p1, "registered", 60);
    await place(t, session.id, w1, "waitlisted", 40);
    await place(t, session.id, w2, "waitlisted", 30);
    await place(t, session.id, inv, "invited", 20);
    assert.equal((await cancelPlayerRegistration(t.db, session.id, w1)).promotedIds.length, 0);
    assert.equal((await cancelPlayerRegistration(t.db, session.id, inv)).promotedIds.length, 0);
    assert.deepEqual(await statusOf(t, session.id), { [p1]: "registered", [w1]: "cancelled", [w2]: "waitlisted", [inv]: "cancelled" });
  })
);

test("after the registration cutoff a freed place is not filled from the waiting list (TC-189)", { skip }, () =>
  withDb(async (t, f) => {
    for (const extra of [{ registrationClosesAt: inDays(-1) }, { status: "live" }]) {
      const { session, players } = await setup(f, { maxParticipants: 1, ...extra }, 2);
      const reg = await place(t, session.id, players[0], "registered", 60);
      await place(t, session.id, players[1], "waitlisted", 30);
      const removed = await removeRegistrationById(t.db, reg.id);
      assert.equal(removed.changed, true);
      assert.deepEqual(removed.promotedIds, [], JSON.stringify(extra));
      assert.equal((await statusOf(t, session.id))[players[1]], "waitlisted");
      await t.db.delete(registrations).where(eq(registrations.sessionId, session.id));
    }
  })
);

test("a failure after the cancel rolls back the cancel and the promotion together", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1 }, 2);
    const [p1, w1] = players;
    await place(t, session.id, p1, "registered", 60);
    await place(t, session.id, w1, "waitlisted", 30);
    await assert.rejects(
      t.db.transaction(async (tx) => {
        const r = await cancelPlayerRegistration(tx, session.id, p1);
        assert.equal(r.promotedIds.length, 1, "promoted inside the transaction");
        throw new Error("boom");
      }),
      /boom/
    );
    assert.deepEqual(await statusOf(t, session.id), { [p1]: "registered", [w1]: "waitlisted" });
  })
);

// ---------- Organiser: move to the waiting list ----------

test("move to the waiting list: only from registered; check-in cleared; the freed place is not auto-filled", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1 }, 4);
    const [p1, w1, c1, i1] = players;
    const reg = await place(t, session.id, p1, "registered", 60, { checkedInAt: new Date() });
    await place(t, session.id, w1, "waitlisted", 40);
    const cancelled = await place(t, session.id, c1, "cancelled", 30);
    const invited = await place(t, session.id, i1, "invited", 20);

    const moved = await moveRegistrationToWaitlist(t.db, reg.id);
    assert.equal(moved.status, "waitlisted");
    assert.equal(moved.checkedInAt, null);
    assert.equal((await statusOf(t, session.id))[w1], "waitlisted", "nobody promoted behind the organiser's back");
    assert.equal((await moveRegistrationToWaitlist(t.db, reg.id)).status, "waitlisted", "repeat is a no-op");

    for (const row of [cancelled, invited]) {
      await assert.rejects(moveRegistrationToWaitlist(t.db, row.id), (e: unknown) => e instanceof LiveRuleError && e.status === 409);
    }
    const after = await statusOf(t, session.id);
    assert.equal(after[c1], "cancelled");
    assert.equal(after[i1], "invited");
  })
);

// ---------- Capacity ----------

test("capacity below the registered players is refused and nothing changes", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 3 }, 3);
    for (const p of players) await place(t, session.id, p, "registered", 30);
    await assert.rejects(updateSessionCapacity(t.db, session.id, { maxParticipants: 2, updatedAt: new Date() }), (e: unknown) =>
      e instanceof LiveRuleError && e.status === 409 && e.code === "capacity_below_registered" && (e.details as any).registered === 3
    );
    assert.equal(await maxOf(t, session.id), 3);
  })
);

test("a raised or removed limit fills the new places from the waiting list, oldest first", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1 }, 4);
    const [p1, w1, w2, w3] = players;
    await place(t, session.id, p1, "registered", 60);
    await place(t, session.id, w1, "waitlisted", 40);
    await place(t, session.id, w2, "waitlisted", 30);
    await place(t, session.id, w3, "waitlisted", 20);

    const raised = await updateSessionCapacity(t.db, session.id, { maxParticipants: 3 });
    assert.equal(raised.promotedIds.length, 2);
    assert.deepEqual(await statusOf(t, session.id), { [p1]: "registered", [w1]: "registered", [w2]: "registered", [w3]: "waitlisted" });

    const same = await updateSessionCapacity(t.db, session.id, { maxParticipants: 3 });
    assert.deepEqual(same.promotedIds, [], "no change, nobody promoted");

    const unlimited = await updateSessionCapacity(t.db, session.id, { maxParticipants: null });
    assert.equal(unlimited.promotedIds.length, 1);
    assert.equal(await count(t, session.id, "waitlisted"), 0);
  })
);

test("a capacity cut racing joins never leaves more registered players than places", { skip }, () =>
  withDb(async (t, f) => {
    for (let round = 0; round < 5; round++) {
      const { session, players } = await setup(f, { maxParticipants: 3 }, 4);
      await place(t, session.id, players[0], "registered", 60);
      await place(t, session.id, players[1], "registered", 50);
      await Promise.allSettled([
        registerPlayer(t.db, session.id, players[2]),
        updateSessionCapacity(t.db, session.id, { maxParticipants: 2 }),
        registerPlayer(t.db, session.id, players[3]),
      ]);
      const registered = await count(t, session.id, "registered");
      const max = await maxOf(t, session.id);
      assert.ok(max == null || registered <= max, `round ${round}: ${registered} registered, capacity ${max}`);
    }
  })
);

test("a capacity write that a caller's guard refuses changes nothing and promotes nobody", { skip }, () =>
  withDb(async (t, f) => {
    const { session, players } = await setup(f, { maxParticipants: 1 }, 2);
    await place(t, session.id, players[0], "registered", 60);
    await place(t, session.id, players[1], "waitlisted", 30);
    const r = await updateSessionCapacity(t.db, session.id, { maxParticipants: 5 }, eq(tennisSessions.status, "cancelled"));
    assert.equal(r.session, undefined);
    assert.deepEqual(r.promotedIds, []);
    assert.equal(await maxOf(t, session.id), 1);
    assert.equal((await statusOf(t, session.id))[players[1]], "waitlisted");
  })
);

// ---------- Invitations ----------

test("accepting an invitation: a full session waitlists; after the cutoff or on a cancelled session it's refused", { skip }, () =>
  withDb(async (t, f) => {
    const full = await setup(f, { maxParticipants: 1 }, 2);
    await place(t, full.session.id, full.players[0], "registered", 60);
    await place(t, full.session.id, full.players[1], "invited", 30);
    assert.equal((await acceptInvitation(t.db, full.session.id, full.players[1])).status, "waitlisted");

    for (const extra of [{ registrationClosesAt: inDays(-1) }, { status: "cancelled" }, { startAt: inDays(-1) }]) {
      const s = await setup(f, extra, 1);
      await place(t, s.session.id, s.players[0], "invited", 30);
      await assert.rejects(acceptInvitation(t.db, s.session.id, s.players[0]), (e: unknown) => e instanceof LiveRuleError && e.status === 409, JSON.stringify(extra));
      assert.equal((await statusOf(t, s.session.id))[s.players[0]], "invited", "the invitation stays open");
    }
  })
);

// ---------- Late organiser registration (TC-213 final rules) ----------

/** A published session whose registration has closed (the late-add window), owner id included. */
async function closedSession(f: F, extra: Partial<typeof tennisSessions.$inferInsert>, n: number) {
  const owner = await f.user("organiser@tennisconnect.test");
  const org = await f.organization(owner.id);
  const session = await f.session(org.id, owner.id, {
    status: "published",
    startAt: inDays(1),
    registrationClosesAt: inDays(-1),
    maxParticipants: 3,
    waitingListEnabled: true,
    ...extra,
  });
  const players = [];
  for (let i = 0; i < n; i++) players.push((await f.user(`late${i}@tennisconnect.test`)).id);
  return { session, ownerId: owner.id, players };
}

async function audits(t: TestDb, sessionId: string) {
  return t.db.select().from(registrationAuditEvents).where(eq(registrationAuditEvents.sessionId, sessionId));
}

test("late add: the first player in line needs no override; anyone else needs an explicit override and a reason - all audited", { skip }, () =>
  withDb(async (t, f) => {
    const { session, ownerId, players } = await closedSession(f, { maxParticipants: 3 }, 4);
    const [r1, w1, w2, outsider] = players;
    await place(t, session.id, r1, "registered", 90);
    const head = await place(t, session.id, w1, "waitlisted", 60);
    const second = await place(t, session.id, w2, "waitlisted", 30);

    // Not first in line, no confirmation: refused, nothing written.
    await assert.rejects(lateRegisterPlayer(t.db, { sessionId: session.id, userId: w2, actorId: ownerId }), (e: unknown) =>
      e instanceof LiveRuleError && e.status === 409 && e.code === "waitlist_override_required" && (e.details as any).nextRegistrationId === head.id
    );
    // Confirmed but no reason: refused.
    await assert.rejects(lateRegisterPlayer(t.db, { sessionId: session.id, userId: outsider, actorId: ownerId, overrideWaitlist: true, reason: "   " }), (e: unknown) =>
      e instanceof LiveRuleError && e.status === 400 && e.code === "override_reason_required"
    );
    assert.deepEqual(await audits(t, session.id), []);

    // First in line: no override needed; keeps their join time.
    const first = await lateRegisterPlayer(t.db, { sessionId: session.id, userId: w1, actorId: ownerId });
    assert.equal(first.registration.status, "registered");
    assert.equal(first.overrodeWaitlist, false);
    assert.equal(first.registration.createdAt.getTime(), head.createdAt.getTime());

    // An outsider ahead of w2: explicit override with a reason.
    const skipped = await lateRegisterPlayer(t.db, { sessionId: session.id, userId: outsider, actorId: ownerId, overrideWaitlist: true, reason: "Partner of a late withdrawal" });
    assert.equal(skipped.overrodeWaitlist, true);
    assert.deepEqual(skipped.bypassedRegistrationIds, [second.id]);

    const log = (await audits(t, session.id)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    assert.deepEqual(log.map((a) => [a.action, a.playerId, a.actorId]), [["late_add", w1, ownerId], ["late_add_waitlist_override", outsider, ownerId]]);
    assert.equal(log[1].reason, "Partner of a late withdrawal");
    assert.deepEqual((log[1].details as any).bypassedRegistrationIds, [second.id]);
    assert.deepEqual(await statusOf(t, session.id), { [r1]: "registered", [w1]: "registered", [w2]: "waitlisted", [outsider]: "registered" });
  })
);

test("late add: two organiser requests for the last place at once - one succeeds, the other is 409 capacity_full", { skip }, () =>
  withDb(async (t, f) => {
    const { session, ownerId, players } = await closedSession(f, { maxParticipants: 2 }, 3);
    await place(t, session.id, players[0], "registered", 90);
    const results = await Promise.allSettled([
      lateRegisterPlayer(t.db, { sessionId: session.id, userId: players[1], actorId: ownerId }),
      lateRegisterPlayer(t.db, { sessionId: session.id, userId: players[2], actorId: ownerId }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.ok(refused.reason instanceof LiveRuleError && refused.reason.code === "capacity_full");
    assert.equal(await count(t, session.id, "registered"), 2);
    assert.equal((await audits(t, session.id)).length, 1, "only the successful addition is audited");
  })
);

test("late add: the same player added twice at once - one registration, one audit event, the repeat is 409", { skip }, () =>
  withDb(async (t, f) => {
    const { session, ownerId, players } = await closedSession(f, { maxParticipants: 5 }, 1);
    const results = await Promise.allSettled([
      lateRegisterPlayer(t.db, { sessionId: session.id, userId: players[0], actorId: ownerId }),
      lateRegisterPlayer(t.db, { sessionId: session.id, userId: players[0], actorId: ownerId }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.equal(refused.reason.code, "already_registered");
    const rows = await t.db.select().from(registrations).where(eq(registrations.sessionId, session.id));
    assert.equal(rows.length, 1);
    assert.equal((await audits(t, session.id)).length, 1);
  })
);

test("late add racing a capacity cut never leaves more players than places", { skip }, () =>
  withDb(async (t, f) => {
    for (let round = 0; round < 5; round++) {
      const { session, ownerId, players } = await closedSession(f, { maxParticipants: 3 }, 3);
      await place(t, session.id, players[0], "registered", 90);
      await place(t, session.id, players[1], "registered", 80);
      await Promise.allSettled([
        lateRegisterPlayer(t.db, { sessionId: session.id, userId: players[2], actorId: ownerId }),
        updateSessionCapacity(t.db, session.id, { maxParticipants: 2 }),
      ]);
      const registered = await count(t, session.id, "registered");
      const max = await maxOf(t, session.id);
      assert.ok(max == null || registered <= max, `round ${round}: ${registered} registered, capacity ${max}`);
    }
  })
);

test("late add: refused before the cutoff and for draft, cancelled, completed or archived sessions; Live is allowed", { skip }, () =>
  withDb(async (t, f) => {
    const open = await closedSession(f, { registrationClosesAt: inDays(1), startAt: inDays(2) }, 1);
    await assert.rejects(lateRegisterPlayer(t.db, { sessionId: open.session.id, userId: open.players[0], actorId: open.ownerId }), (e: unknown) =>
      e instanceof LiveRuleError && e.code === "registration_open"
    );
    for (const status of ["draft", "cancelled", "completed", "archived"]) {
      const s = await closedSession(f, { status }, 1);
      await assert.rejects(lateRegisterPlayer(t.db, { sessionId: s.session.id, userId: s.players[0], actorId: s.ownerId }), (e: unknown) =>
        e instanceof LiveRuleError && e.status === 409 && e.code === "session_not_open", status
      );
    }
    const live = await closedSession(f, { status: "live", startAt: inDays(-0.01) }, 1);
    const added = await lateRegisterPlayer(t.db, { sessionId: live.session.id, userId: live.players[0], actorId: live.ownerId });
    assert.equal(added.registration.status, "registered");
    assert.equal(added.registration.checkedInAt, null, "not checked in - the organiser does that");
  })
);

test("late add: a previously cancelled player gets a new join time; the audit records the previous status", { skip }, () =>
  withDb(async (t, f) => {
    const { session, ownerId, players } = await closedSession(f, { maxParticipants: 5 }, 1);
    const old = await place(t, session.id, players[0], "cancelled", 600);
    const added = await lateRegisterPlayer(t.db, { sessionId: session.id, userId: players[0], actorId: ownerId });
    assert.ok(added.registration.createdAt > old.createdAt);
    assert.equal(added.previousStatus, "cancelled");
    const [event] = await audits(t, session.id);
    assert.equal((event.details as any).previousStatus, "cancelled");
  })
);
