// npx tsx server/routes/organizerGrantDirect.test.ts
//
// Covers the SECOND way an admin can grant organiser access: directly
// from the Users tab (PATCH /api/admin/users/:id/grant-organizer), inline
// in server/routes.ts - a different code path from the Access Requests
// queue tested in organizerRequests.test.ts. Kept in its own file: this
// one loads the whole registerRoutes(app) (routes.ts is a ~2000-line
// file registering everything), which is a much bigger blast radius than
// organizer.ts's own small router, and a failure here shouldn't be
// confused with a failure in the primary, more common request-based flow.
//
// Same faking strategy as organizerRequests.test.ts (see that file's
// header for the full rationale): storage is patched in-memory, auth is
// a header-based stub standing in for a real Passport session.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import type { AddressInfo } from "node:net";

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

interface FakeUser {
  id: string;
  email: string;
  name: string;
  role: "player" | "coach" | "admin";
  slug: string;
  isOrganizer: boolean;
  isAdmin: boolean;
}
interface FakeRequest {
  id: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}
interface FakeMessage {
  recipientId: string;
  recipientType: string;
  senderUserId: string | null;
  subject: string | null;
}

function makeFakeDb() {
  return { users: new Map<string, FakeUser>(), requests: [] as FakeRequest[], messages: [] as FakeMessage[] };
}
type FakeDb = ReturnType<typeof makeFakeDb>;

/** Mirrors storage.ts's grantOrganizer (~line 818): resolves any PENDING
    request for the user too, then flips isOrganizer - documented there as
    deliberate, "otherwise it'd sit pending forever ... even though the
    user is already an organizer". */
function fakeGrantOrganizer(db: FakeDb, id: string, reviewerId: string): FakeUser {
  const latest = db.requests.filter((r) => r.userId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (latest && latest.status === "pending") {
    latest.status = "approved";
    latest.reviewedBy = reviewerId;
    latest.reviewedAt = new Date();
  }
  const user = db.users.get(id)!;
  user.isOrganizer = true;
  return user;
}

/** Mirrors revokeOrganizer (~line 840): marks a currently-approved request
    "revoked" too, so it doesn't sit as "approved" once access is gone. */
function fakeRevokeOrganizer(db: FakeDb, id: string, reviewerId: string): FakeUser {
  const latest = db.requests.filter((r) => r.userId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (latest && latest.status === "approved") {
    latest.status = "revoked";
    latest.reviewedBy = reviewerId;
    latest.reviewedAt = new Date();
  }
  const user = db.users.get(id)!;
  user.isOrganizer = false;
  return user;
}

function patchStorage(storage: any, db: FakeDb) {
  const originals: Record<string, any> = {};
  const patch = (name: string, fn: (...args: any[]) => any) => {
    originals[name] = storage[name];
    storage[name] = fn;
  };
  patch("getUser", async (id: string) => db.users.get(id));
  patch("grantOrganizer", async (id: string, reviewerId: string) => fakeGrantOrganizer(db, id, reviewerId));
  patch("revokeOrganizer", async (id: string, reviewerId: string) => fakeRevokeOrganizer(db, id, reviewerId));
  patch("createOrganizerRequest", async (userId: string, note?: string) => {
    const request: FakeRequest = { id: `req-${db.requests.length + 1}`, userId, status: "pending", reviewedBy: null, reviewedAt: null, createdAt: new Date() };
    db.requests.push(request);
    return request;
  });
  patch("getLatestOrganizerRequest", async (userId: string) =>
    db.requests.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  );
  patch("createMessage", async (message: any) => {
    db.messages.push(message);
    return { ...message, id: `msg-${db.messages.length}`, createdAt: new Date() };
  });
  return () => Object.assign(storage, originals);
}

function seedFixtures(db: FakeDb) {
  const coach: FakeUser = { id: "user-coach", email: "test-coach-01@tennisconnect.test", name: "Test Coach 01", role: "coach", slug: "test-coach-01", isOrganizer: false, isAdmin: false };
  const player: FakeUser = { id: "user-player", email: "test-player-01@tennisconnect.test", name: "Test Player 01", role: "player", slug: "test-player-01", isOrganizer: false, isAdmin: false };
  const admin: FakeUser = { id: "user-admin", email: "admin@tennisconnect.test", name: "Site Admin", role: "admin", slug: "admin", isOrganizer: false, isAdmin: true };
  for (const u of [coach, player, admin]) db.users.set(u.id, u);
  return { coach, player, admin };
}

async function startServer(db: FakeDb) {
  const { storage } = await import("../storage");
  const unpatch = patchStorage(storage, db);
  const { registerRoutes } = await import("../routes");

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = req.header("x-test-user-id");
    (req as any).user = id ? db.users.get(id) : undefined;
    (req as any).isAuthenticated = () => !!(req as any).user;
    next();
  });
  await registerRoutes(app);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const close = async () => {
    unpatch();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  return { baseUrl, close };
}

async function call(baseUrl: string, userId: string | null, method: string, path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(userId ? { "x-test-user-id": userId } : {}) },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function runGrantScenario(roleLabel: "coach" | "player") {
  const db = makeFakeDb();
  const { coach, player, admin } = seedFixtures(db);
  const requester = roleLabel === "coach" ? coach : player;
  const { baseUrl, close } = await startServer(db);
  try {
    const res = await call(baseUrl, admin.id, "PATCH", `/api/admin/users/${requester.id}/grant-organizer`);
    assert.equal(res.status, 200, `${roleLabel}: grant-organizer should succeed`);
    assert.equal(res.json.isOrganizer, true, `${roleLabel}: the response itself must show isOrganizer:true`);
    assert.equal(db.users.get(requester.id)!.isOrganizer, true, `${roleLabel}: the stored user must be flipped too`);

    const toRequester = db.messages.filter((m) => m.recipientId === requester.id);
    assert.equal(toRequester.length, 1, `${roleLabel}: a notification must be sent on this path too`);
    assert.equal(toRequester[0].recipientType, roleLabel, `${roleLabel}: recipientType must match the user's real role`);

    assert.equal(res.json.password, undefined, "the response must never leak the password hash");
  } finally {
    await close();
  }
}

async function runGrantAfterPendingRequestScenario() {
  // Reproduces "registered without the checkbox, later sent a request" -
  // but approved via the Users tab instead of Access Requests.
  const db = makeFakeDb();
  const { coach, admin } = seedFixtures(db);
  const { storage } = await import("../storage");
  const { baseUrl, close } = await startServer(db);
  try {
    await storage.createOrganizerRequest(coach.id, "Requested from profile");
    const before = db.requests[0];
    assert.equal(before.status, "pending");

    const res = await call(baseUrl, admin.id, "PATCH", `/api/admin/users/${coach.id}/grant-organizer`);
    assert.equal(res.status, 200);
    assert.equal(res.json.isOrganizer, true);

    // The pending request must not be left dangling - otherwise a later
    // admin opening Access Requests would see (and could re-approve,
    // triggering a redundant second notification) a request for someone
    // who is already an organiser.
    assert.equal(db.requests[0].status, "approved", "the leftover pending request must be resolved, not left pending");
  } finally {
    await close();
  }
}

async function runRevokeScenario() {
  const db = makeFakeDb();
  const { coach, admin } = seedFixtures(db);
  const { baseUrl, close } = await startServer(db);
  try {
    await call(baseUrl, admin.id, "PATCH", `/api/admin/users/${coach.id}/grant-organizer`);
    const res = await call(baseUrl, admin.id, "PATCH", `/api/admin/users/${coach.id}/revoke-organizer`);
    assert.equal(res.status, 200);
    assert.equal(res.json.isOrganizer, false);
    assert.equal(db.users.get(coach.id)!.isOrganizer, false);
  } finally {
    await close();
  }
}

async function runAccessControlCheck() {
  const db = makeFakeDb();
  const { coach, player } = seedFixtures(db);
  const { baseUrl, close } = await startServer(db);
  try {
    const res = await call(baseUrl, player.id, "PATCH", `/api/admin/users/${coach.id}/grant-organizer`);
    assert.equal(res.status, 403, "a non-admin must not be able to grant organiser access to anyone");
    assert.equal(db.users.get(coach.id)!.isOrganizer, false);
  } finally {
    await close();
  }
}

async function main() {
  console.log("Users-tab direct grant/revoke organizer path (registerRoutes, real HTTP)\n");
  await test("coach: grant-organizer flips isOrganizer and notifies", () => runGrantScenario("coach"));
  await test("player: same check, to rule out a role-specific bug on this path too", () => runGrantScenario("player"));
  await test("granting via Users tab resolves a leftover pending request instead of leaving it stuck", runGrantAfterPendingRequestScenario);
  await test("revoke-organizer flips isOrganizer back off", runRevokeScenario);
  await test("a non-admin cannot grant organiser access via this path either", runAccessControlCheck);
  console.log(`\n${passed} passed, ${failed} failed`);
  // registerRoutes() imports weather.ts/support.ts, which each start an
  // un-unref()'d setInterval at module scope (unlike discoveryScheduler.ts,
  // which does .unref() deliberately) - harmless in a real long-running
  // server, but it means this test's own process would otherwise never
  // exit on its own once these tests are done.
  process.exit(failed > 0 ? 1 : 0);
}

main();
