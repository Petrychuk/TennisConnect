// npx tsx --test server/routes/organizerOwnership.test.ts
//
// Registration and match routes of the Organiser Hub act on ONE
// registration / match inside an organiser's session:
//   POST   /sessions/:id/checkin/:registrationId
//   DELETE /sessions/:id/registrations/:registrationId
//   POST   /sessions/:id/registrations/:registrationId/waitlist
//   POST   /sessions/:id/matches/:matchId/start|score     (TC Live, Staging)
//
// requireOwnSession only proved the organiser owns :id. Pairing their own
// session id with a registration (or match) of SOMEONE ELSE'S session let
// any organiser check in, remove or waitlist other organisers' players
// (Phase 2 audit, 30 Oct 2026). Now the registration / match must belong to
// :id, or the answer is 404 and nothing is changed.
//
// The REAL organizer router runs on a loopback server; `storage` is faked
// (no Postgres here) and sign-in is a test header, as in
// organizerRequests.test.ts.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

const USERS: Record<string, any> = {
  alice: { id: "alice", role: "player", isOrganizer: true, isAdmin: false, name: "Alice" },
  bob: { id: "bob", role: "player", isOrganizer: true, isAdmin: false, name: "Bob" },
  admin: { id: "admin", role: "player", isOrganizer: false, isAdmin: true, name: "Admin" },
  player: { id: "player", role: "player", isOrganizer: false, isAdmin: false, name: "Player" },
};
const ORGS: Record<string, any> = {
  "org-a": { id: "org-a", ownerId: "alice" },
  "org-b": { id: "org-b", ownerId: "bob" },
};
const SESSIONS: Record<string, any> = {
  "session-a": { id: "session-a", organizationId: "org-a", status: "published" },
  "session-b": { id: "session-b", organizationId: "org-b", status: "published" },
  "session-cancelled": { id: "session-cancelled", organizationId: "org-a", status: "cancelled" },
};
const REGISTRATIONS: Record<string, any> = {
  "reg-a": { id: "reg-a", sessionId: "session-a", userId: "p1", status: "registered" },
  "reg-b": { id: "reg-b", sessionId: "session-b", userId: "p2", status: "registered" },
};
const MATCHES: Record<string, any> = {
  "match-b": { id: "match-b", sessionId: "session-b", status: "scheduled" },
};

// What the write methods were asked to change - must stay empty for the
// cross-session attempts.
const writes: string[] = [];
const orgUpdates: any[] = [];

let server: http.Server;
let base = "";
let restore = () => {};

before(async () => {
  const { storage } = await import("../storage");
  const s = storage as any;
  const fakes: Record<string, (...args: any[]) => any> = {
    getUser: async (id: string) => USERS[id],
    getSessionById: async (id: string) => SESSIONS[id],
    getOrganizationById: async (id: string) => ORGS[id],
    getRegistrationById: async (id: string) => REGISTRATIONS[id],
    getMatchById: async (id: string) => MATCHES[id],
    checkInRegistration: async (id: string) => (writes.push(`checkin:${id}`), { ...REGISTRATIONS[id], checkedInAt: new Date() }),
    cancelRegistrationById: async (id: string) => (writes.push(`cancel:${id}`), { ...REGISTRATIONS[id], status: "cancelled" }),
    moveRegistrationToWaitlist: async (id: string) => (writes.push(`waitlist:${id}`), { ...REGISTRATIONS[id], status: "waitlisted" }),
    startMatch: async (id: string) => (writes.push(`start:${id}`), MATCHES[id]),
    updateOrganization: async (id: string, updates: any) => (orgUpdates.push({ id, updates }), { ...ORGS[id], ...updates }),
    getOrganizationOwnedByUser: async (userId: string) => Object.values(ORGS).find((o: any) => o.ownerId === userId),
    getSessionRounds: async (id: string) =>
      id === "session-a" ? [{ round: { id: "r1", sessionId: id, roundNumber: 1, status: "completed", restingPlayerIds: [] }, matches: [] }] : [],
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

async function call(user: string | null, method: string, path: string, body: unknown = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("an organiser cannot touch a registration of another organiser's session through their own session id", async () => {
  writes.length = 0;
  for (const [method, path] of [
    ["POST", "/sessions/session-a/checkin/reg-b"],
    ["DELETE", "/sessions/session-a/registrations/reg-b"],
    ["POST", "/sessions/session-a/registrations/reg-b/waitlist"],
  ] as const) {
    const res = await call("alice", method, path);
    assert.equal(res.status, 404, `${method} ${path}`);
    assert.deepEqual(res.body, { message: "Registration not found" });
  }
  assert.deepEqual(writes, [], "nothing in session-b was changed");
});

test("a match of another organiser's session is a 404 too (TC Live score routes)", async () => {
  writes.length = 0;
  const res = await call("alice", "POST", "/sessions/session-a/matches/match-b/start");
  // 404 either way: off Staging the whole Live route is a 404; on Staging
  // the match check answers "Match not found". Never a write.
  assert.equal(res.status, 404);
  assert.deepEqual(writes, []);
});

test("the owner still manages their own registrations", async () => {
  writes.length = 0;
  assert.equal((await call("alice", "POST", "/sessions/session-a/checkin/reg-a")).status, 200);
  assert.equal((await call("alice", "POST", "/sessions/session-a/registrations/reg-a/waitlist")).status, 200);
  assert.equal((await call("alice", "DELETE", "/sessions/session-a/registrations/reg-a")).status, 200);
  assert.deepEqual(writes, ["checkin:reg-a", "waitlist:reg-a", "cancel:reg-a"]);
});

test("someone else's session id is still refused by requireOwnSession (403), unknown ids 404", async () => {
  writes.length = 0;
  assert.equal((await call("alice", "POST", "/sessions/session-b/checkin/reg-b")).status, 403);
  assert.equal((await call("alice", "POST", "/sessions/session-a/checkin/no-such-reg")).status, 404);
  assert.equal((await call(null, "POST", "/sessions/session-a/checkin/reg-a")).status, 401);
  assert.deepEqual(writes, []);
});

test("GET /sessions/:id/rounds: the owner (or an admin) gets every stored round; another organiser, a player and guests don't", async () => {
  const own = await call("alice", "GET", "/sessions/session-a/rounds");
  assert.equal(own.status, 200);
  assert.equal(own.body.length, 1);
  assert.equal(own.body[0].round.roundNumber, 1);
  assert.equal((await call("bob", "GET", "/sessions/session-a/rounds")).status, 403);
  assert.equal((await call("player", "GET", "/sessions/session-a/rounds")).status, 403);
  assert.equal((await call(null, "GET", "/sessions/session-a/rounds")).status, 401);
  // Same read rule as GET /sessions/:id and /registrations: admins can look.
  assert.equal((await call("admin", "GET", "/sessions/session-a/rounds")).status, 200);
  assert.equal((await call("admin", "GET", "/sessions/no-such-session/rounds")).status, 404);
  // Not Staging-gated: a session that never ran in Live answers [] (not 404).
  const none = await call("bob", "GET", "/sessions/session-b/rounds");
  assert.equal(none.status, 200);
  assert.deepEqual(none.body, []);
});

test("PUT /organizations/:id: profile fields only, owner only", async () => {
  orgUpdates.length = 0;
  const own = await call("alice", "PUT", "/organizations/org-a", {
    name: "Lyne Park Tennis",
    website: "lyneparktennis.com.au",
    phone: "",
    verified: true,
    listingType: "premium",
    status: "published",
  });
  assert.equal(own.status, 200);
  assert.deepEqual(orgUpdates, [
    { id: "org-a", updates: { name: "Lyne Park Tennis", website: "https://lyneparktennis.com.au", phone: null } },
  ], "verified / listingType / status never reach storage");

  orgUpdates.length = 0;
  assert.equal((await call("bob", "PUT", "/organizations/org-a", { name: "Mine now" })).status, 404);
  assert.equal((await call(null, "PUT", "/organizations/org-a", { name: "Guest" })).status, 401);
  const bad = await call("alice", "PUT", "/organizations/org-a", { website: "javascript:alert(1)" });
  assert.equal(bad.status, 400);
  assert.deepEqual(orgUpdates, []);
});

test("POST /organizations: an organiser who already has one gets 400; verified can't be set on create", async () => {
  assert.equal((await call("alice", "POST", "/organizations", { name: "Second" })).status, 400);
});

test("POST /sessions/:id/invite: refused for a session players can't open (cancelled)", async () => {
  writes.length = 0;
  const res = await call("alice", "POST", "/sessions/session-cancelled/invite", { userId: "bob" });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /published session/);
});
