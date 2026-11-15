// npx tsx --test server/routes/organizerLifecycle.test.ts
//
// TC-212 - Organiser Hub audit, Batch 2 (OH-AUDIT-005, OH-AUDIT-006):
// session lifecycle transitions and edit guards on the REAL organizer router.
//
//  - approve / reject only a session waiting for review; unknown id 404,
//    any other status 409 - approving a cancelled, live or finished session
//    used to publish it again.
//  - publish / cancel / archive are conditional on the status they start
//    from IN THE WRITE: a double click, retry or a change made meanwhile
//    (RACE below) gets 409 and nobody is notified twice.
//  - a cancelled session can't be edited (its date change used to send
//    "Rescheduled" to its players); capacity can't drop below the players
//    already registered.
//  - ownership: another organiser gets 403 and nothing changes.
//
// Storage is faked (no Postgres) with the same status conditions as the SQL
// in server/storage.ts; messages are counted at storage.createMessage. Same
// harness as organizerOwnership.test.ts.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

const USERS: Record<string, any> = {
  alice: { id: "alice", role: "player", isOrganizer: true, isAdmin: false, name: "Alice", email: "alice@x.test", slug: "alice" },
  bob: { id: "bob", role: "player", isOrganizer: true, isAdmin: false, name: "Bob", email: "bob@x.test", slug: "bob" },
  admin: { id: "admin", role: "player", isOrganizer: false, isAdmin: true, name: "Admin", email: "admin@x.test", slug: "admin" },
};
const ORGS: Record<string, any> = { "org-a": { id: "org-a", ownerId: "alice" }, "org-b": { id: "org-b", ownerId: "bob" } };

const STAMP = new Date("2026-11-10T09:00:00.000Z");
const START = new Date("2027-02-06T22:00:00.000Z");
const ALL_STATUSES = ["draft", "pending_review", "rejected", "published", "live", "completed", "archived", "cancelled"];

function session(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id, status, organizationId: "org-a", createdBy: "alice", title: "Saturday Doubles", location: "Court A",
    startAt: START, endAt: null, timeZone: "Australia/Sydney", maxParticipants: 8, parentSessionId: null,
    seasonId: null, seriesId: null, isInternalTest: false, updatedAt: STAMP, ...extra,
  };
}

let SESSIONS: Record<string, any> = {};
let REGS: any[] = [];
// Status a session changes to between the route's read and its write (another tab, admin, Live).
const RACE: Record<string, string> = {};
const writes: string[] = [];
const messages: { recipientId: string; subject: string }[] = [];
let countCalls = 0;
let tick = 0;
const stamp = () => new Date(Date.parse("2026-11-15T00:00:00Z") + ++tick * 1000);
const defined = (o: any) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined));

function race(id: string) {
  if (RACE[id] && SESSIONS[id]) {
    SESSIONS[id] = { ...SESSIONS[id], status: RACE[id] };
    delete RACE[id];
  }
}
/** Conditional status change, like UPDATE ... WHERE id = $1 AND status IN (...) RETURNING. */
function transition(name: string, id: string, allowed: (status: string) => boolean, set: Record<string, unknown>) {
  race(id);
  const row = SESSIONS[id];
  if (!row || !allowed(row.status)) return undefined;
  writes.push(`${name}:${id}`);
  return (SESSIONS[id] = { ...row, ...set, updatedAt: stamp() });
}
const LOCKED = (guard: any) => (status: string) => !(guard?.lockedStatuses ?? []).includes(status);

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  const { storage } = await import("../storage");
  const s = storage as any;
  const fakes: Record<string, (...args: any[]) => any> = {
    getUser: async (id: string) => USERS[id],
    getAdminUsers: async () => [USERS.admin],
    getOrganizationById: async (id: string) => ORGS[id],
    getOrganizationOwnedByUser: async (userId: string) => Object.values(ORGS).find((o: any) => o.ownerId === userId),
    getSessionById: async (id: string) => SESSIONS[id],
    getRegistrationsForSession: async (id: string) => REGS.filter((r) => r.sessionId === id),
    getSessionRegistrationCounts: async (id: string) => {
      countCalls++;
      const of = (st: string) => REGS.filter((r) => r.sessionId === id && r.status === st).length;
      return { registered: of("registered"), waitlisted: of("waitlisted") };
    },
    createMessage: async (m: any) => (messages.push({ recipientId: m.recipientId, subject: m.subject }), { id: `m${messages.length}` }),
    updateSession: async (id: string, changes: any, guard?: any) =>
      transition("update", id, LOCKED(guard), defined(changes)),
    updateSessionIfUnchanged: async (id: string, changes: any, expected: Date, guard?: any) =>
      transition("update", id, (st) => LOCKED(guard)(st) && new Date(SESSIONS[id].updatedAt).getTime() === expected.getTime(), defined(changes)),
    submitSessionForReview: async (id: string) => transition("review", id, (st) => ["draft", "rejected"].includes(st), { status: "pending_review" }),
    publishSessionDirect: async (id: string) => transition("publish", id, (st) => ["draft", "rejected"].includes(st), { status: "published" }),
    approveSession: async (id: string, by: string) => transition("approve", id, (st) => st === "pending_review", { status: "published", reviewedBy: by }),
    rejectSession: async (id: string, by: string, note?: string) => transition("reject", id, (st) => st === "pending_review", { status: "rejected", reviewedBy: by, reviewNote: note ?? null }),
    cancelSession: async (id: string) => transition("cancel", id, (st) => ["draft", "pending_review", "published"].includes(st), { status: "cancelled" }),
    archiveSession: async (id: string) => transition("archive", id, (st) => !["live", "archived"].includes(st), { status: "archived" }),
  };
  const originals: Record<string, any> = {};
  for (const [name, fn] of Object.entries(fakes)) {
    originals[name] = s[name];
    s[name] = fn;
  }
  restore = () => Object.assign(s, originals);

  const { default: router } = await import("./organizer");
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers["x-test-user-id"];
    req.user = typeof id === "string" ? USERS[id] : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use("/api/organizer", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/organizer`;
});

after(() => {
  restore();
  server?.close();
});

beforeEach(() => {
  SESSIONS = {};
  REGS = [];
  for (const k of Object.keys(RACE)) delete RACE[k];
  writes.length = 0;
  messages.length = 0;
  countCalls = 0;
});

async function call(user: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not json */
  }
  return { status: res.status, body: json };
}

function registrants(sessionId: string, statuses: string[]) {
  statuses.forEach((status, i) => REGS.push({ id: `${sessionId}-r${i}`, sessionId, userId: `p${i}`, userRole: "player", status }));
}

// ---------- Admin review (OH-AUDIT-005) ----------

for (const verb of ["approve", "reject"] as const) {
  test(`TC-212-0${verb === "approve" ? 1 : 2} admin ${verb}: only a pending_review session; unknown 404, others 409, once only`, async () => {
    assert.equal((await call("admin", "POST", `/admin/sessions/nope/${verb}`)).status, 404);

    for (const status of ALL_STATUSES.filter((st) => st !== "pending_review")) {
      SESSIONS[`s-${status}`] = session(`s-${status}`, status);
      const r = await call("admin", "POST", `/admin/sessions/s-${status}/${verb}`, { note: "n" });
      assert.equal(r.status, 409, status);
      assert.equal(r.body?.code, "not_pending_review");
      assert.equal(SESSIONS[`s-${status}`].status, status, `${status} is unchanged`);
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(messages, []);

    SESSIONS.pending = session("pending", "pending_review");
    const first = await call("admin", "POST", `/admin/sessions/pending/${verb}`);
    assert.equal(first.status, 200);
    assert.equal(SESSIONS.pending.status, verb === "approve" ? "published" : "rejected");
    assert.equal(messages.length, 1, "the organiser hears once");
    assert.equal(messages[0].recipientId, "alice");

    const second = await call("admin", "POST", `/admin/sessions/pending/${verb}`);
    assert.equal(second.status, 409, "double click / second admin");
    assert.equal(messages.length, 1, "...and is not told twice");

    // Changed between the check and the write (e.g. the organiser cancelled it).
    SESSIONS.raced = session("raced", "pending_review");
    RACE.raced = "cancelled";
    const raced = await call("admin", "POST", `/admin/sessions/raced/${verb}`);
    assert.equal(raced.status, 409);
    assert.equal(SESSIONS.raced.status, "cancelled");
    assert.equal(messages.length, 1);

    // Organisers aren't admins.
    SESSIONS.mine = session("mine", "pending_review");
    assert.equal((await call("alice", "POST", `/admin/sessions/mine/${verb}`)).status, 403);
    assert.equal(SESSIONS.mine.status, "pending_review");
  });
}

// ---------- Publish ----------

test("TC-212-03 publish: once only - a second or concurrent Publish is 409 and admins are told once", async () => {
  SESSIONS.d = session("d", "draft");
  const first = await call("alice", "POST", "/sessions/d/publish");
  assert.equal(first.status, 200);
  assert.equal(SESSIONS.d.status, "pending_review");
  assert.equal(messages.length, 1, "one admin, one message");

  const second = await call("alice", "POST", "/sessions/d/publish");
  assert.equal(second.status, 409);
  assert.equal(second.body?.code, "not_publishable");
  assert.equal(messages.length, 1);

  SESSIONS.d2 = session("d2", "draft");
  RACE.d2 = "pending_review"; // the same draft submitted from another tab meanwhile
  const raced = await call("alice", "POST", "/sessions/d2/publish");
  assert.equal(raced.status, 409);
  assert.equal(raced.body?.code, "not_publishable");
  assert.equal(messages.length, 1, "no second 'pending review' message to admins");
});

// ---------- Cancel ----------

test("TC-212-04 cancel: players are told once; a second or raced cancel is 409 and sends nothing", async () => {
  SESSIONS.p = session("p", "published");
  registrants("p", ["registered", "waitlisted", "cancelled"]);
  const first = await call("alice", "POST", "/sessions/p/cancel");
  assert.equal(first.status, 200);
  assert.equal(SESSIONS.p.status, "cancelled");
  assert.equal(messages.length, 2, "registered + waitlisted, not the cancelled registration");

  const second = await call("alice", "POST", "/sessions/p/cancel");
  assert.equal(second.status, 409);
  assert.equal(messages.length, 2, "nobody is told twice");

  SESSIONS.q = session("q", "published");
  registrants("q", ["registered"]);
  RACE.q = "live"; // went live between the click and the write
  const raced = await call("alice", "POST", "/sessions/q/cancel");
  assert.equal(raced.status, 409);
  assert.match(raced.body.message, /end it from the Live screen/);
  assert.equal(SESSIONS.q.status, "live");
  assert.equal(messages.length, 2, "a live session's players are never told it's cancelled");

  for (const status of ["live", "completed", "archived"]) {
    SESSIONS[status] = session(status, status);
    assert.equal((await call("alice", "POST", `/sessions/${status}/cancel`)).status, 409, status);
    assert.equal(SESSIONS[status].status, status);
  }
});

// ---------- Archive ----------

test("TC-212-05 archive: conditional - a session that went live meanwhile is refused; already archived is a no-op", async () => {
  SESSIONS.c = session("c", "completed");
  assert.equal((await call("alice", "POST", "/sessions/c/archive")).status, 200);
  assert.equal(SESSIONS.c.status, "archived");
  assert.equal((await call("alice", "POST", "/sessions/c/archive")).status, 200, "idempotent");
  assert.deepEqual(writes, ["archive:c"]);

  SESSIONS.l = session("l", "live");
  assert.equal((await call("alice", "POST", "/sessions/l/archive")).status, 409);

  SESSIONS.r = session("r", "published");
  RACE.r = "live";
  assert.equal((await call("alice", "POST", "/sessions/r/archive")).status, 409);
  assert.equal(SESSIONS.r.status, "live");

  SESSIONS.t = session("t", "completed");
  RACE.t = "archived"; // archived in another tab
  const r = await call("alice", "POST", "/sessions/t/archive");
  assert.equal(r.status, 200);
  assert.equal(r.body?.status, "archived");
});

// ---------- Edit guards (OH-AUDIT-006) ----------

test("TC-212-06 a cancelled session can't be edited - no write, no 'Rescheduled' message", async () => {
  SESSIONS.x = session("x", "cancelled");
  registrants("x", ["registered", "registered"]);
  for (const body of [
    { startAt: "2027-03-01T22:00:00.000Z" },
    { title: "Back on" },
    { notes: "why it was cancelled" },
    { waitingListEnabled: true },
    { startAt: "2027-03-01T22:00:00.000Z", expectedUpdatedAt: STAMP.toISOString() },
  ]) {
    const r = await call("alice", "PUT", "/sessions/x", body);
    assert.equal(r.status, 409, JSON.stringify(body));
    assert.equal(r.body?.code, "cancelled");
  }
  assert.deepEqual(writes, []);
  assert.deepEqual(messages, []);
  assert.equal(SESSIONS.x.updatedAt, STAMP);
  // Completed / archived keep their existing answers.
  for (const status of ["completed", "archived"]) {
    SESSIONS[status] = session(status, status);
    const r = await call("alice", "PUT", `/sessions/${status}`, { title: "Renamed" });
    assert.equal(r.status, 409, status);
    assert.equal(r.body?.code, status);
  }
});

test("TC-212-07 capacity can't go below the players already registered; raising or clearing it is fine", async () => {
  SESSIONS.p = session("p", "published", { maxParticipants: 8 });
  registrants("p", ["registered", "registered", "registered", "waitlisted", "invited", "cancelled"]);

  for (const maxParticipants of [2, 1]) {
    const r = await call("alice", "PUT", "/sessions/p", { maxParticipants });
    assert.equal(r.status, 409, String(maxParticipants));
    assert.equal(r.body?.code, "capacity_below_registered");
    assert.equal(r.body?.registered, 3);
  }
  assert.equal(SESSIONS.p.maxParticipants, 8);
  assert.deepEqual(writes, []);

  for (const maxParticipants of [3, 12, null]) {
    const r = await call("alice", "PUT", "/sessions/p", { maxParticipants });
    assert.equal(r.status, 200, String(maxParticipants));
  }
  assert.equal(SESSIONS.p.maxParticipants, null);

  // Saving the form without touching capacity doesn't count anything.
  SESSIONS.q = session("q", "published", { maxParticipants: 4 });
  countCalls = 0;
  assert.equal((await call("alice", "PUT", "/sessions/q", { title: "Renamed", maxParticipants: 4 })).status, 200);
  assert.equal(countCalls, 0);

  // A draft has nobody registered: any capacity is fine.
  SESSIONS.d = session("d", "draft", { maxParticipants: null });
  assert.equal((await call("alice", "PUT", "/sessions/d", { maxParticipants: 1 })).status, 200);
});

test("TC-212-08 a session cancelled between the read and the write is not overwritten (and nobody is 'rescheduled')", async () => {
  SESSIONS.p = session("p", "published");
  registrants("p", ["registered"]);
  RACE.p = "cancelled";
  const r = await call("alice", "PUT", "/sessions/p", { startAt: "2027-03-01T22:00:00.000Z" });
  assert.equal(r.status, 409);
  assert.equal(r.body?.code, "cancelled");
  assert.equal(SESSIONS.p.status, "cancelled");
  assert.equal(new Date(SESSIONS.p.startAt).getTime(), START.getTime());
  assert.deepEqual(messages, []);
});

test("TC-212-09 existing behaviour kept: stale drafts 409, live sessions editable, a real reschedule notifies", async () => {
  SESSIONS.d = session("d", "draft");
  const stale = await call("alice", "PUT", "/sessions/d", { title: "Old tab", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(stale.status, 409);
  assert.equal(stale.body?.code, "stale");

  SESSIONS.l = session("l", "live", { courtsCount: 2 });
  assert.equal((await call("alice", "PUT", "/sessions/l", { courtsCount: 3 })).status, 200, "TC Live court changes untouched");

  SESSIONS.p = session("p", "published");
  registrants("p", ["registered", "cancelled"]);
  const moved = await call("alice", "PUT", "/sessions/p", { startAt: "2027-03-01T22:00:00.000Z" });
  assert.equal(moved.status, 200);
  assert.deepEqual(messages.map((m) => m.subject), ["Rescheduled: Saturday Doubles"]);
});

// ---------- Ownership ----------

test("TC-212-10 another organiser can't publish, cancel, archive or edit the session - 403, nothing changes", async () => {
  SESSIONS.d = session("d", "draft");
  SESSIONS.p = session("p", "published");
  SESSIONS.c = session("c", "completed");
  registrants("p", ["registered"]);
  const before = structuredClone(SESSIONS);
  const attempts: [string, string, unknown][] = [
    ["POST", "/sessions/d/publish", undefined],
    ["POST", "/sessions/p/cancel", undefined],
    ["POST", "/sessions/c/archive", undefined],
    ["PUT", "/sessions/p", { maxParticipants: 0 }],
    ["PUT", "/sessions/p", { startAt: "2027-03-01T22:00:00.000Z" }],
  ];
  for (let i = 0; i < 2; i++) {
    for (const [method, path, body] of attempts) {
      assert.equal((await call("bob", method, path, body)).status, 403, `${method} ${path}`);
    }
  }
  assert.deepEqual(SESSIONS, before);
  assert.deepEqual(writes, []);
  assert.deepEqual(messages, []);
});
