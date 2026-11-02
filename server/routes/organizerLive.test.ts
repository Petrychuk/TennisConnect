// npx tsx --test server/routes/organizerLive.test.ts
//
// TC Live v1 routes (server/routes/organizer.ts) on the REAL organizer
// router, loopback server, faked storage (no Postgres), sign-in by test
// header - same harness as organizerOwnership.test.ts.
//
// Covers: the TC_LIVE_ENABLED flag (off / internal / on) and kill switch,
// auth + ownership + IDOR on every Live mutation, rule validation (go
// live, scores), 409s from the engine, finishing with unscored matches,
// and internal test session isolation (create, join, invite, publish).

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

const INTERNAL_EMAIL = "live-organiser@tennisconnect.test";
const USERS: Record<string, any> = {
  alice: { id: "alice", email: "alice@example.test", role: "player", isOrganizer: true, isAdmin: false, name: "Alice", slug: "alice" },
  bob: { id: "bob", email: "bob@example.test", role: "player", isOrganizer: true, isAdmin: false, name: "Bob", slug: "bob" },
  ivy: { id: "ivy", email: INTERNAL_EMAIL, role: "player", isOrganizer: true, isAdmin: false, name: "Ivy", slug: "ivy" },
  pat: { id: "pat", email: "pat@example.test", role: "player", isOrganizer: false, isAdmin: false, name: "Pat", slug: "pat" },
  tess: { id: "tess", email: "live-player@tennisconnect.test", role: "player", isOrganizer: false, isAdmin: false, name: "Tess", slug: "tess" },
  admin: { id: "admin", email: "admin@example.test", role: "player", isOrganizer: false, isAdmin: true, name: "Admin", slug: "admin" },
};
const ORGS: Record<string, any> = {
  "org-a": { id: "org-a", ownerId: "alice" },
  "org-b": { id: "org-b", ownerId: "bob" },
  "org-i": { id: "org-i", ownerId: "ivy" },
};
let SESSIONS: Record<string, any> = {};
let REGS: any[] = [];
const MATCHES: Record<string, any> = {
  "m-a": { id: "m-a", sessionId: "live-a", status: "playing" },
  "m-b": { id: "m-b", sessionId: "live-b", status: "playing" },
};
const calls: string[] = [];

function resetData() {
  SESSIONS = {
    "pub-a": { id: "pub-a", organizationId: "org-a", status: "published", courtsCount: 1, matchMode: "doubles", isInternalTest: false, title: "Pub A", startAt: new Date(Date.now() + 864e5), endAt: null, timeZone: "Australia/Sydney" },
    "live-a": { id: "live-a", organizationId: "org-a", status: "live", courtsCount: 2, matchMode: "singles", isInternalTest: false, title: "Live A" },
    "live-b": { id: "live-b", organizationId: "org-b", status: "live", courtsCount: 2, matchMode: "singles", isInternalTest: false, title: "Live B" },
    "live-i": { id: "live-i", organizationId: "org-i", status: "live", courtsCount: 1, matchMode: "singles", isInternalTest: true, title: "Internal" },
    "pub-i": { id: "pub-i", organizationId: "org-i", status: "published", courtsCount: 1, matchMode: "singles", isInternalTest: true, title: "Internal pub", startAt: new Date(Date.now() + 864e5), endAt: null, timeZone: "Australia/Sydney" },
    "draft-i": { id: "draft-i", organizationId: "org-i", status: "draft", isInternalTest: true, title: "Internal draft", parentSessionId: null },
  };
  // pub-a: 3 checked-in + available registrants (doubles needs 4), one withdrawn, one waitlisted+checked in.
  REGS = [
    { id: "r1", sessionId: "pub-a", userId: "p1", status: "registered", checkedInAt: new Date(), liveStatus: null },
    { id: "r2", sessionId: "pub-a", userId: "p2", status: "registered", checkedInAt: new Date(), liveStatus: null },
    { id: "r3", sessionId: "pub-a", userId: "p3", status: "registered", checkedInAt: new Date(), liveStatus: null },
    { id: "r4", sessionId: "pub-a", userId: "p4", status: "registered", checkedInAt: new Date(), liveStatus: "withdrawn" },
    { id: "r5", sessionId: "pub-a", userId: "p5", status: "waitlisted", checkedInAt: new Date(), liveStatus: null },
    { id: "r-live-a", sessionId: "live-a", userId: "p1", status: "registered", checkedInAt: new Date(), liveStatus: null },
    { id: "r-live-b", sessionId: "live-b", userId: "p2", status: "registered", checkedInAt: new Date(), liveStatus: null },
  ];
  calls.length = 0;
}

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  resetData();
  const { storage } = await import("../storage");
  const s = storage as any;
  const fakes: Record<string, (...args: any[]) => any> = {
    getUser: async (id: string) => USERS[id],
    getSessionById: async (id: string) => SESSIONS[id],
    getOrganizationById: async (id: string) => ORGS[id],
    getOrganizationOwnedByUser: async (userId: string) => Object.values(ORGS).find((o: any) => o.ownerId === userId),
    getRegistrationById: async (id: string) => REGS.find((r) => r.id === id),
    getRegistrationsForSession: async (id: string) => REGS.filter((r) => r.sessionId === id),
    getMatchById: async (id: string) => MATCHES[id],
    goLiveSession: async (id: string) => (calls.push(`go-live:${id}`), { ...SESSIONS[id], status: "live" }),
    generateNextRound: async (id: string) => {
      calls.push(`generate:${id}`);
      throw new LiveRuleError("Current round isn't fully confirmed yet", 409, "ROUND_IN_PROGRESS");
    },
    getCurrentRound: async () => null,
    startMatch: async (id: string) => (calls.push(`start:${id}`), { ...MATCHES[id], status: "playing" }),
    reportMatchScore: async (id: string, _by: string, a: number, b: number) => (calls.push(`score:${id}:${a}-${b}`), { ...MATCHES[id], status: "confirmed", teamAGames: a, teamBGames: b }),
    finishSession: async (id: string, options: { force?: boolean } = {}) => {
      calls.push(`finish:${id}:${options.force ? "force" : "plain"}`);
      if (!options.force) throw new LiveRuleError("1 match has no score yet", 409, "UNSCORED_MATCHES", { unscored: 1 });
      return { ...SESSIONS[id], status: "completed" };
    },
    setRegistrationLiveStatus: async (id: string, liveStatus: any) => (calls.push(`live-status:${id}:${liveStatus}`), { ...REGS.find((r) => r.id === id), liveStatus }),
    getSessionRounds: async () => [],
    getSessionLeaderboard: async () => [],
    createSession: async (orgId: string, by: string, data: any, options: any = {}) => {
      calls.push(`create:${by}:${options.isInternalTest === true}`);
      return { id: "new", organizationId: orgId, createdBy: by, ...data, isInternalTest: options.isInternalTest === true };
    },
    registerForSession: async (id: string, userId: string) => (calls.push(`join:${id}:${userId}`), { registration: { id: "reg-new", sessionId: id, userId, status: "registered" }, waitlisted: false }),
    publishSessionDirect: async (id: string) => (calls.push(`publish-direct:${id}`), { ...SESSIONS[id], status: "published" }),
    submitSessionForReview: async (id: string) => (calls.push(`submit-review:${id}`), { ...SESSIONS[id], status: "pending_review" }),
    getAdminUsers: async () => (calls.push("get-admins"), [USERS.admin]),
    createInvitedRegistration: async (id: string, userId: string) => (calls.push(`invite:${id}:${userId}`), { id: "inv", sessionId: id, userId, status: "invited" }),
    createMessage: async () => (calls.push("message"), {}),
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
  delete process.env.TC_LIVE_ENABLED;
  delete process.env.TC_INTERNAL_TEST_EMAILS;
});

beforeEach(() => {
  resetData();
  delete process.env.TC_LIVE_ENABLED;
  process.env.TC_INTERNAL_TEST_EMAILS = `${INTERNAL_EMAIL},live-player@tennisconnect.test`;
});

async function call(user: string | null, method: string, path: string, body: unknown = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const LIVE_ROUTES: [string, string, unknown][] = [
  ["POST", "/sessions/live-a/rounds/generate", {}],
  ["GET", "/sessions/live-a/rounds/current", {}],
  ["POST", "/sessions/live-a/matches/m-a/start", {}],
  ["POST", "/sessions/live-a/matches/m-a/score", { teamAGames: 6, teamBGames: 3 }],
  ["POST", "/sessions/live-a/registrations/r-live-a/live-status", { liveStatus: "unavailable" }],
  ["POST", "/sessions/pub-a/go-live", {}],
];

test("TC_LIVE_ENABLED unset or false: every Live control route is a 404 - for the owner, and for guests before auth", async () => {
  for (const value of [undefined, "false", "maybe"]) {
    if (value === undefined) delete process.env.TC_LIVE_ENABLED;
    else process.env.TC_LIVE_ENABLED = value;
    for (const [method, path, body] of LIVE_ROUTES) {
      assert.equal((await call("alice", method, path, body)).status, 404, `${value} ${method} ${path}`);
      assert.equal((await call(null, method, path, body)).status, 404, `guest ${method} ${path} reveals nothing`);
    }
  }
  assert.deepEqual(calls, [], "nothing reached storage");
  assert.deepEqual((await call("alice", "GET", "/features")).body, { live: "off" });
});

test("kill switch keeps history: rounds and leaderboard stay readable, a live session can still be ended", async () => {
  process.env.TC_LIVE_ENABLED = "false";
  assert.equal((await call("alice", "GET", "/sessions/live-a/rounds")).status, 200);
  assert.equal((await call("alice", "GET", "/sessions/live-a/leaderboard")).status, 200);
  const finish = await call("alice", "POST", "/sessions/live-a/finish", { force: true });
  assert.equal(finish.status, 200);
  assert.equal(finish.body.status, "completed");
});

test("TC_LIVE_ENABLED=internal: only internal test sessions get Live", async () => {
  process.env.TC_LIVE_ENABLED = "internal";
  assert.deepEqual((await call("alice", "GET", "/features")).body, { live: "internal" });
  assert.equal((await call("alice", "POST", "/sessions/live-a/matches/m-a/start")).status, 404, "a real organiser's session");
  assert.equal((await call("alice", "POST", "/sessions/pub-a/go-live")).status, 404);
  assert.equal((await call("ivy", "POST", "/sessions/pub-i/go-live")).status, 400, "internal session reaches the rules (not enough players)");
  assert.equal((await call("ivy", "GET", "/sessions/live-i/rounds/current")).status, 200);
});

test("TC_LIVE_ENABLED=true: owner only; other organisers 403, players 403, guests 401; cross-session ids 404", async () => {
  process.env.TC_LIVE_ENABLED = "true";
  assert.equal((await call("alice", "POST", "/sessions/live-a/matches/m-a/start")).status, 200);
  assert.equal((await call("bob", "POST", "/sessions/live-a/matches/m-a/start")).status, 403);
  assert.equal((await call("pat", "POST", "/sessions/live-a/matches/m-a/start")).status, 403);
  assert.equal((await call(null, "POST", "/sessions/live-a/matches/m-a/start")).status, 401);
  // Alice's own live session + Bob's match / registration: never touched.
  assert.equal((await call("alice", "POST", "/sessions/live-a/matches/m-b/score", { teamAGames: 6, teamBGames: 1 })).status, 404);
  assert.equal((await call("alice", "POST", "/sessions/live-a/registrations/r-live-b/live-status", { liveStatus: "withdrawn" })).status, 404);
  assert.equal((await call("bob", "POST", "/sessions/live-a/finish", { force: true })).status, 403);
  assert.deepEqual(calls, ["start:m-a"]);
});

test("go live: needs a full court of available players (withdrawn and waitlisted don't count)", async () => {
  process.env.TC_LIVE_ENABLED = "true";
  // pub-a is doubles: r1-r3 available, r4 withdrawn, r5 waitlisted -> 3 < 4.
  const res = await call("alice", "POST", "/sessions/pub-a/go-live");
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Doubles needs at least 4 checked-in players/);
  REGS.find((r) => r.id === "r4")!.liveStatus = null; // back in
  assert.equal((await call("alice", "POST", "/sessions/pub-a/go-live")).status, 200);
  // Already live: a retry is fine (idempotent), not an error.
  assert.equal((await call("alice", "POST", "/sessions/live-a/go-live")).status, 200);
});

test("scores: whole games 0-99, not 0-0; engine conflicts come back as 409 with a code", async () => {
  process.env.TC_LIVE_ENABLED = "true";
  for (const [a, b] of [[0, 0], [100, 2], [-1, 6], [6.5, 4]]) {
    const res = await call("alice", "POST", "/sessions/live-a/matches/m-a/score", { teamAGames: a, teamBGames: b });
    assert.equal(res.status, 400, `${a}-${b}`);
  }
  assert.equal((await call("alice", "POST", "/sessions/live-a/matches/m-a/score", { teamAGames: 5, teamBGames: 5 })).status, 200, "a draw is allowed");
  const gen = await call("alice", "POST", "/sessions/live-a/rounds/generate");
  assert.equal(gen.status, 409);
  assert.equal(gen.body.code, "ROUND_IN_PROGRESS");
});

test("finish: unscored matches need an explicit force", async () => {
  process.env.TC_LIVE_ENABLED = "true";
  const plain = await call("alice", "POST", "/sessions/live-a/finish");
  assert.equal(plain.status, 409);
  assert.equal(plain.body.code, "UNSCORED_MATCHES");
  assert.equal(plain.body.unscored, 1);
  assert.equal((await call("alice", "POST", "/sessions/live-a/finish", { force: true })).status, 200);
  assert.deepEqual(calls, ["finish:live-a:plain", "finish:live-a:force"]);
});

test("internal test sessions: created only by internal accounts, joinable/invitable only by internal accounts, published without admin review", async () => {
  // Created by an internal account -> marked; by anyone else -> not, even if the body asks.
  await call("ivy", "POST", "/sessions", { title: "Internal run", startAt: new Date(Date.now() + 864e5).toISOString(), isInternalTest: false });
  await call("alice", "POST", "/sessions", { title: "Real", startAt: new Date(Date.now() + 864e5).toISOString(), isInternalTest: true });
  assert.deepEqual(calls.filter((c) => c.startsWith("create")), ["create:ivy:true", "create:alice:false"]);

  // A real player can't join it by id; an internal one can.
  assert.equal((await call("pat", "POST", "/sessions/pub-i/join")).status, 404);
  assert.equal((await call("tess", "POST", "/sessions/pub-i/join")).status !== 404, true);
  // Invites: internal accounts only.
  assert.equal((await call("ivy", "POST", "/sessions/pub-i/invite", { userId: "pat" })).status, 400);

  // Publishing an internal session skips review and messages no admin.
  calls.length = 0;
  const pub = await call("ivy", "POST", "/sessions/draft-i/publish");
  assert.equal(pub.status, 200);
  assert.ok(calls.includes("publish-direct:draft-i"));
  assert.ok(!calls.includes("submit-review:draft-i") && !calls.includes("get-admins"), "no review, no admin messages");
});
