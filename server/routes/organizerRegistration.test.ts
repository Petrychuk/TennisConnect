// npx tsx --test server/routes/organizerRegistration.test.ts
//
// TC-213 - Organiser Hub audit, Batch 3 (OH-AUDIT-003 / 007 / 008), the ROUTE
// side, on the REAL organizer router with faked storage (no Postgres):
//
//  - a repeated Join or Leave changes nothing (storage says changed: false)
//    and nobody is messaged again;
//  - moving a waitlisted / invited / cancelled registration to the waiting
//    list is 409, not a silent resurrection;
//  - a capacity cut refused under the session lock (a join slipped in after
//    the route's pre-check) is 409 capacity_below_registered, not a 500;
//  - another organiser, or a player, can't remove or waitlist anyone (403).
//
// The atomic behaviour itself (parallel joins for the last place, concurrent
// cancels, promotion exactly once, rollback) is tested against a real
// Postgres in server/lib/registrationTx.pg.test.ts.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { LiveRuleError } from "../lib/liveErrors";
import { capacityBelowRegisteredError } from "../lib/registrationTx";

const USERS: Record<string, any> = {
  alice: { id: "alice", role: "player", isOrganizer: true, isAdmin: false, name: "Alice", email: "alice@x.test" },
  bob: { id: "bob", role: "player", isOrganizer: true, isAdmin: false, name: "Bob", email: "bob@x.test" },
  pat: { id: "pat", role: "player", isOrganizer: false, isAdmin: false, name: "Pat", email: "pat@x.test" },
  p1: { id: "p1", role: "player", isOrganizer: false, isAdmin: false, name: "P One", email: "p1@x.test" },
  p2: { id: "p2", role: "player", isOrganizer: false, isAdmin: false, name: "P Two", email: "p2@x.test" },
  p3: { id: "p3", role: "player", isOrganizer: false, isAdmin: false, name: "P Three", email: "p3@x.test" },
};
const ORGS: Record<string, any> = { "org-a": { id: "org-a", ownerId: "alice" }, "org-b": { id: "org-b", ownerId: "bob" } };
const FUTURE = new Date("2027-03-06T22:00:00.000Z");
const STAMP = new Date("2026-11-10T09:00:00.000Z");

let SESSIONS: Record<string, any> = {};
let REGS: Record<string, any> = {};
const messages: string[] = [];
const writes: string[] = [];
// What the next storage call answers.
let joinChanged = true;
let leaveChanged = true;
let capacityRaceRegistered: number | null = null;
// TC-213 final rules: what storage reports as promoted, and the late-add outcome.
let promotedOnNextChange: string[] = [];
let lateAddError: unknown = null;
let messagesFail = false;
const lateAddCalls: any[] = [];

/** The registrations storage reports as promoted by this change - they're "registered" from now on. */
function promote(): string[] {
  const ids = promotedOnNextChange;
  promotedOnNextChange = [];
  for (const id of ids) if (REGS[id]) REGS[id] = { ...REGS[id], status: "registered" };
  return ids;
}

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  const { storage } = await import("../storage");
  const s = storage as any;
  const fakes: Record<string, (...args: any[]) => any> = {
    getUser: async (id: string) => USERS[id],
    getOrganizationById: async (id: string) => ORGS[id],
    getOrganizationOwnedByUser: async (userId: string) => Object.values(ORGS).find((o: any) => o.ownerId === userId),
    getSessionById: async (id: string) => SESSIONS[id],
    getRegistrationById: async (id: string) => REGS[id],
    getRegistrationsForSession: async (id: string) => Object.values(REGS).filter((r: any) => r.sessionId === id),
    getSessionRegistrationCounts: async () => ({ registered: 0, waitlisted: 0 }),
    createMessage: async (m: any) => {
      if (messagesFail) throw new Error("message store down");
      messages.push(`${m.recipientId}:${m.subject}`);
      return { id: `m${messages.length}` };
    },
    registerForSession: async (sessionId: string, userId: string) => {
      writes.push(`join:${userId}`);
      return { registration: { id: "r-new", sessionId, userId, status: "registered" }, waitlisted: false, changed: joinChanged };
    },
    cancelRegistration: async (sessionId: string, userId: string) => {
      writes.push(`leave:${userId}`);
      return { registration: { id: "r-x", sessionId, userId, status: "cancelled" }, changed: leaveChanged, promotedIds: promote() };
    },
    cancelRegistrationById: async (id: string) => (writes.push(`remove:${id}`), { registration: { ...REGS[id], status: "cancelled" }, changed: true, promotedIds: promote() }),
    lateRegisterPlayer: async (input: any) => {
      lateAddCalls.push(input);
      if (lateAddError) throw lateAddError;
      writes.push(`late:${input.userId}`);
      return { registration: { id: "r-late", sessionId: input.sessionId, userId: input.userId, status: "registered" }, previousStatus: null, overrodeWaitlist: input.overrideWaitlist === true, bypassedRegistrationIds: [] };
    },
    moveRegistrationToWaitlist: async (id: string) => {
      const reg = REGS[id];
      if (reg.status === "waitlisted") return reg;
      if (reg.status !== "registered") {
        throw new LiveRuleError(`Only registered players can be moved to the waiting list (this one is ${reg.status})`, 409, "invalid_waitlist_move");
      }
      writes.push(`waitlist:${id}`);
      return { ...reg, status: "waitlisted" };
    },
    updateSession: async (id: string, changes: any, guard?: any) => {
      if (capacityRaceRegistered != null) throw capacityBelowRegisteredError(capacityRaceRegistered);
      writes.push(`update:${id}`);
      const ids = promote();
      if (ids.length) guard?.onPromoted?.(ids);
      return (SESSIONS[id] = { ...SESSIONS[id], ...changes });
    },
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
  const session = { status: "published", organizationId: "org-a", createdBy: "alice", title: "Saturday Doubles", startAt: FUTURE, registrationOpensAt: null, registrationClosesAt: null, maxParticipants: 4, updatedAt: STAMP, timeZone: "Australia/Sydney" };
  SESSIONS = { "s-a": { ...session, id: "s-a" }, "s-b": { ...session, id: "s-b", organizationId: "org-b", createdBy: "bob" } };
  REGS = {
    "reg-registered": { id: "reg-registered", sessionId: "s-a", userId: "p1", status: "registered" },
    "reg-waitlisted": { id: "reg-waitlisted", sessionId: "s-a", userId: "p2", status: "waitlisted" },
    "reg-invited": { id: "reg-invited", sessionId: "s-a", userId: "p3", status: "invited" },
    "reg-cancelled": { id: "reg-cancelled", sessionId: "s-a", userId: "p4", status: "cancelled" },
    "reg-b": { id: "reg-b", sessionId: "s-b", userId: "p5", status: "registered" },
  };
  messages.length = 0;
  writes.length = 0;
  joinChanged = true;
  leaveChanged = true;
  capacityRaceRegistered = null;
  promotedOnNextChange = [];
  lateAddError = null;
  messagesFail = false;
  lateAddCalls.length = 0;
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

test("TC-213-01 a first Join notifies once; a repeated Join (changed: false) notifies nobody", async () => {
  const first = await call("pat", "POST", "/sessions/s-a/join", {});
  assert.equal(first.status, 201);
  assert.deepEqual(messages.sort(), ["alice:New Player Joined", "pat:You're In!"]);

  messages.length = 0;
  joinChanged = false;
  for (let i = 0; i < 3; i++) {
    const again = await call("pat", "POST", "/sessions/s-a/join", {});
    assert.equal(again.status, 201, "same response contract");
    assert.deepEqual(Object.keys(again.body).sort(), ["registration", "waitlisted"]);
  }
  assert.deepEqual(messages, [], "no second 'You're In!' / 'New Player Joined'");
});

test("TC-213-02 a first Leave notifies once; leaving again notifies nobody; the response body is the registration", async () => {
  const first = await call("pat", "DELETE", "/sessions/s-a/join");
  assert.equal(first.status, 200);
  assert.equal(first.body?.status, "cancelled");
  assert.equal(first.body?.changed, undefined, "no new fields in the response");
  assert.deepEqual(messages.sort(), ["alice:A Player Left Your Session", "pat:Registration Cancelled"]);

  messages.length = 0;
  leaveChanged = false;
  assert.equal((await call("pat", "DELETE", "/sessions/s-a/join")).status, 200);
  assert.deepEqual(messages, []);
});

test("TC-213-03 moving a waitlisted, invited or cancelled registration to the waiting list: 409 / no-op, never a resurrection", async () => {
  for (const id of ["reg-invited", "reg-cancelled"]) {
    const r = await call("alice", "POST", `/sessions/s-a/registrations/${id}/waitlist`);
    assert.equal(r.status, 409, id);
    assert.equal(r.body?.code, "invalid_waitlist_move");
  }
  const already = await call("alice", "POST", "/sessions/s-a/registrations/reg-waitlisted/waitlist");
  assert.equal(already.status, 200, "already waitlisted is a no-op");
  const ok = await call("alice", "POST", "/sessions/s-a/registrations/reg-registered/waitlist");
  assert.equal(ok.status, 200);
  assert.equal(ok.body?.status, "waitlisted");
  assert.deepEqual(writes, ["waitlist:reg-registered"]);
});

test("TC-213-04 a capacity cut refused under the lock (a join landed after the pre-check) is a 409, not a 500", async () => {
  capacityRaceRegistered = 4; // the route's pre-check saw 0, the locked check sees 4
  const r = await call("alice", "PUT", "/sessions/s-a", { maxParticipants: 3 });
  assert.equal(r.status, 409);
  assert.equal(r.body?.code, "capacity_below_registered");
  assert.equal(r.body?.registered, 4);
  assert.equal(SESSIONS["s-a"].maxParticipants, 4);
  assert.deepEqual(messages, []);
});

test("TC-213-05 another organiser or a player can't remove or waitlist anyone (403); a foreign registration id is 404", async () => {
  for (const user of ["bob", "pat"]) {
    for (const [method, path] of [
      ["DELETE", "/sessions/s-a/registrations/reg-registered"],
      ["POST", "/sessions/s-a/registrations/reg-registered/waitlist"],
    ]) {
      assert.equal((await call(user, method, path)).status, 403, `${user} ${method} ${path}`);
    }
  }
  // Alice pairing her own session with Bob's registration.
  assert.equal((await call("alice", "DELETE", "/sessions/s-a/registrations/reg-b")).status, 404);
  assert.equal((await call("alice", "POST", "/sessions/s-a/registrations/reg-b/waitlist")).status, 404);
  assert.equal((await call(null, "POST", "/sessions/s-a/join", {})).status, 401);
  assert.deepEqual(writes, []);
  assert.deepEqual(messages, []);
});

test("TC-213-06 organiser Remove: same response as before, repeat-safe at the route", async () => {
  const r = await call("alice", "DELETE", "/sessions/s-a/registrations/reg-registered");
  assert.equal(r.status, 200);
  assert.equal(r.body?.status, "cancelled");
  assert.deepEqual(writes, ["remove:reg-registered"]);
});

// ---------- TC-213 final rules: promotion notices ----------

test("TC-213-07 a promoted player is told once, after the change - on Leave, Remove and a capacity increase", async () => {
  promotedOnNextChange = ["reg-waitlisted"];
  assert.equal((await call("pat", "DELETE", "/sessions/s-a/join")).status, 200);
  assert.ok(messages.includes("p2:You're off the waiting list"), "promoted player told after a player left");

  messages.length = 0;
  REGS["reg-w3"] = { id: "reg-w3", sessionId: "s-a", userId: "p3", status: "waitlisted" };
  promotedOnNextChange = ["reg-w3", "reg-w3"]; // the same id twice is still one message
  assert.equal((await call("alice", "DELETE", "/sessions/s-a/registrations/reg-registered")).status, 200);
  assert.deepEqual(messages, ["p3:You're off the waiting list"]);

  messages.length = 0;
  REGS["reg-w4"] = { id: "reg-w4", sessionId: "s-a", userId: "p1", status: "waitlisted" };
  promotedOnNextChange = ["reg-w4"];
  assert.equal((await call("alice", "PUT", "/sessions/s-a", { maxParticipants: 6 })).status, 200);
  assert.deepEqual(messages, ["p1:You're off the waiting list"], "a raised capacity notifies the promoted player");

  // A promotion that was undone before the notice went out says nothing.
  messages.length = 0;
  REGS["reg-gone"] = { id: "reg-gone", sessionId: "s-a", userId: "p2", status: "cancelled" };
  promotedOnNextChange = [];
  const { notifyPromotedPlayers } = await import("../services/registrationNotifications");
  assert.equal(await notifyPromotedPlayers("s-a", ["reg-gone"]), 0);
  assert.deepEqual(messages, []);
});

test("TC-213-08 a failed notification never changes the outcome of a committed registration change", async () => {
  messagesFail = true;
  const join = await call("pat", "POST", "/sessions/s-a/join", {});
  assert.equal(join.status, 201, "joined, even though 'You're In!' couldn't be stored");
  assert.equal(join.body?.registration?.status, "registered");

  promotedOnNextChange = ["reg-waitlisted"];
  assert.equal((await call("pat", "DELETE", "/sessions/s-a/join")).status, 200);
  assert.equal((await call("alice", "DELETE", "/sessions/s-a/registrations/reg-registered")).status, 200);
  SESSIONS["s-a"] = { ...SESSIONS["s-a"], registrationClosesAt: new Date("2026-11-01T00:00:00Z") };
  assert.equal((await call("alice", "POST", "/sessions/s-a/late-registrations", { userId: "p3" })).status, 201);
  assert.deepEqual(messages, []);
  assert.deepEqual(writes, ["join:pat", "leave:pat", "remove:reg-registered", "late:p3"]);
});

// ---------- TC-213 final rules: late organiser registration ----------

test("TC-213-09 late registration: owner only - another organiser, a player and a guest are refused", async () => {
  for (const [user, status] of [["bob", 403], ["pat", 403], [null, 401]] as const) {
    assert.equal((await call(user, "POST", "/sessions/s-a/late-registrations", { userId: "p3" })).status, status, String(user));
  }
  assert.equal((await call("alice", "POST", "/sessions/s-b/late-registrations", { userId: "p3" })).status, 403, "Bob's session");
  assert.deepEqual(lateAddCalls, []);
  assert.deepEqual(messages, []);
});

test("TC-213-10 late registration: input validated before anything is written", async () => {
  const cases: [unknown, number][] = [
    [{}, 400],
    [{ userId: "" }, 400],
    [{ userId: "p3", overrideWaitlist: "yes" }, 400],
    [{ userId: "p3", reason: 42 }, 400],
    [{ userId: "p3", overrideWaitlist: true, reason: "x".repeat(501) }, 400],
    [{ userId: "nobody" }, 404],
  ];
  for (const [body, status] of cases) {
    assert.equal((await call("alice", "POST", "/sessions/s-a/late-registrations", body)).status, status, JSON.stringify(body).slice(0, 60));
  }
  assert.deepEqual(lateAddCalls, []);
});

test("TC-213-11 late registration: refused on a cancelled, completed or archived session (roster closed)", async () => {
  for (const status of ["cancelled", "completed", "archived"]) {
    SESSIONS["s-a"] = { ...SESSIONS["s-a"], status };
    const r = await call("alice", "POST", "/sessions/s-a/late-registrations", { userId: "p3" });
    assert.equal(r.status, 409, status);
  }
  assert.deepEqual(lateAddCalls, []);
});

test("TC-213-12 late registration: the waiting-list override is explicit, the reason reaches storage, the player is told once", async () => {
  lateAddError = new LiveRuleError("2 players are waiting ahead of this player.", 409, "waitlist_override_required", { waiting: 2, ahead: 2, nextRegistrationId: "reg-waitlisted", nextUserId: "p2" });
  const refused = await call("alice", "POST", "/sessions/s-a/late-registrations", { userId: "p3" });
  assert.equal(refused.status, 409);
  assert.equal(refused.body?.code, "waitlist_override_required");
  assert.equal(refused.body?.nextUserId, "p2");
  assert.deepEqual(messages, []);

  lateAddError = null;
  const ok = await call("alice", "POST", "/sessions/s-a/late-registrations", { userId: "p3", overrideWaitlist: true, reason: "  Regular partner of a late withdrawal  " });
  assert.equal(ok.status, 201);
  assert.equal(ok.body?.overrodeWaitlist, true);
  assert.deepEqual(
    { userId: lateAddCalls[1].userId, actorId: lateAddCalls[1].actorId, overrideWaitlist: lateAddCalls[1].overrideWaitlist, reason: lateAddCalls[1].reason },
    { userId: "p3", actorId: "alice", overrideWaitlist: true, reason: "  Regular partner of a late withdrawal  " },
  );
  assert.deepEqual(messages, ["p3:You've been added"]);

  // A repeat (double click) is refused by storage and nobody is told again.
  lateAddError = new LiveRuleError("This player already has a place in the session", 409, "already_registered");
  const again = await call("alice", "POST", "/sessions/s-a/late-registrations", { userId: "p3", overrideWaitlist: true, reason: "again" });
  assert.equal(again.status, 409);
  assert.equal(again.body?.code, "already_registered");
  assert.deepEqual(messages, ["p3:You've been added"]);
});

test("TC-213-13 late registration: storage's refusals keep their 4xx (open registration, full, wrong status, missing reason)", async () => {
  const errors = [
    new LiveRuleError("Registration is still open", 409, "registration_open"),
    new LiveRuleError("The session is full (4 places)", 409, "capacity_full", { maxParticipants: 4 }),
    new LiveRuleError("Players can't be added to a draft session", 409, "session_not_open"),
    new LiveRuleError("Give a reason for skipping the waiting list", 400, "override_reason_required"),
  ];
  for (const error of errors) {
    lateAddError = error;
    const r = await call("alice", "POST", "/sessions/s-a/late-registrations", { userId: "p3", overrideWaitlist: true });
    assert.equal(r.status, error.status, error.code);
    assert.equal(r.body?.code, error.code);
  }
  assert.deepEqual(messages, []);
});
