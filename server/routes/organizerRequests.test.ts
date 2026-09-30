// npx tsx server/routes/organizerRequests.test.ts
//
// Regression for the reported case: a user registers WITHOUT the
// "I want to organise" checkbox, later requests organiser access from
// their profile, an admin approves it - and the requester is reported to
// still see "Pending", no notification, and no "Open Organiser Hub"
// button.
//
// WHAT THIS EXERCISES FOR REAL: the actual `server/routes/organizer.ts`
// router (POST /requests, GET /requests/me, GET /requests, POST
// /requests/:id/approve, POST /requests/:id/reject), the real
// `requireAuth`/`requireAdmin` middleware, and the real
// `sendMessageBetween` / `ORGANIZER_APPROVED_*` notification text - all
// running behind a real HTTP server on loopback (no live network
// needed), so this is genuinely the same request/response cycle the
// browser drives, byte for byte.
//
// WHAT IS FAKED, AND WHY: `storage` (no live Postgres reachable from
// this environment) and authentication (no live session store reachable
// either - see below). The storage fake's control flow is a deliberate,
// commented mirror of the real methods in server/storage.ts as of this
// writing (approveOrganizerRequest / rejectOrganizerRequest /
// createOrganizerRequest / getLatestOrganizerRequest /
// getOrganizerRequests / createMessage) - it proves the ROUTE and
// NOTIFICATION wiring is correct, and would catch a regression in that
// wiring (a dropped field, a wrong role string, a missing isOrganizer
// flip). It does NOT prove the real SQL is bug-free; that needs a real
// database, which this sandbox does not have.
//
// Authentication is stubbed by a tiny test-only middleware that sets
// req.user / req.isAuthenticated directly from an `x-test-user-id`
// header - this is what a real Passport session would already have done
// by the time a route handler runs, so requireAuth/requireAdmin (the
// REAL middleware) see exactly the same req shape either way. The one
// thing this stub does NOT exercise - whether a live session re-reads a
// user's isOrganizer flag from the database on every request, or serves
// a stale cached copy - is checked separately below, by calling the
// REAL passport.deserializeUser callback in isolation.
//
// Seeded fixtures use the exact field shape of server/seeds/testPlayersSeed.ts
// ("Test Coach 01" / "Test Player 01": role, slug, isApproved, isTestUser,
// profileCompleted - isOrganizer and any organizer request are left unset,
// same as a freshly seeded account, matching "registered without the
// checkbox").

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

// ---------------------------------------------------------------------
// In-memory fake of the slice of `storage` this flow touches. Overridden
// as OWN properties on the real `storage` singleton (see below), so the
// real route file's `import { storage } from "../storage"` sees these.
// ---------------------------------------------------------------------

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
  note: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}
interface FakeMessage {
  id: string;
  recipientId: string;
  recipientType: string;
  senderUserId: string | null;
  senderName: string;
  senderEmail: string;
  subject: string | null;
  content: string;
  createdAt: Date;
}

function makeFakeDb() {
  const users = new Map<string, FakeUser>();
  const requests: FakeRequest[] = [];
  const messages: FakeMessage[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${++seq}`;

  return { users, requests, messages, nextId };
}

type FakeDb = ReturnType<typeof makeFakeDb>;

/** Mirrors storage.ts's createOrganizerRequest (line ~3684). */
function fakeCreateOrganizerRequest(db: FakeDb, userId: string, note?: string): FakeRequest {
  const request: FakeRequest = {
    id: db.nextId("req"),
    userId,
    status: "pending",
    note: note ?? null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
  };
  db.requests.push(request);
  return request;
}

/** Mirrors getLatestOrganizerRequest: newest row for this user, by createdAt. */
function fakeGetLatestOrganizerRequest(db: FakeDb, userId: string): FakeRequest | undefined {
  return db.requests
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

/** Mirrors getOrganizerRequests: joined with the user, newest first, optional status filter. */
function fakeGetOrganizerRequests(db: FakeDb, status?: string) {
  return db.requests
    .filter((r) => !status || r.status === status)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => {
      const u = db.users.get(r.userId)!;
      return { ...r, userName: u.name, userEmail: u.email, userRole: u.role };
    });
}

/**
 * Mirrors approveOrganizerRequest (storage.ts ~3731): sets the request to
 * "approved" AND flips users.isOrganizer to true - both writes, exactly as
 * the real method does in two separate statements (not one transaction,
 * matching the real code, so a test that relied on atomicity there would
 * be testing something the real code doesn't actually guarantee either).
 */
function fakeApproveOrganizerRequest(db: FakeDb, id: string, reviewerId: string): FakeRequest {
  const request = db.requests.find((r) => r.id === id);
  if (!request) throw new Error("Organiser request not found");
  request.status = "approved";
  request.reviewedBy = reviewerId;
  request.reviewedAt = new Date();
  const user = db.users.get(request.userId)!;
  user.isOrganizer = true;
  return request;
}

/** Mirrors rejectOrganizerRequest: only the request row changes. */
function fakeRejectOrganizerRequest(db: FakeDb, id: string, reviewerId: string): FakeRequest {
  const request = db.requests.find((r) => r.id === id);
  if (!request) throw new Error("Organiser request not found");
  request.status = "rejected";
  request.reviewedBy = reviewerId;
  request.reviewedAt = new Date();
  return request;
}

function fakeCreateMessage(db: FakeDb, message: Omit<FakeMessage, "id" | "createdAt">): FakeMessage {
  const row: FakeMessage = { ...message, id: db.nextId("msg"), createdAt: new Date() };
  db.messages.push(row);
  return row;
}

/** Wires the fakes onto the REAL `storage` singleton as own-property
    overrides (shadowing the DatabaseStorage prototype methods), so every
    module that already did `import { storage } from "../storage"` -
    including the route file under test - calls these instead of hitting
    a real (unreachable) Postgres. Returns a restore function. */
function patchStorage(storage: any, db: FakeDb) {
  const originals: Record<string, any> = {};
  const patch = (name: string, fn: (...args: any[]) => any) => {
    originals[name] = storage[name];
    storage[name] = fn;
  };

  patch("getUser", async (id: string) => db.users.get(id));
  patch("createOrganizerRequest", async (userId: string, note?: string) => fakeCreateOrganizerRequest(db, userId, note));
  patch("getLatestOrganizerRequest", async (userId: string) => fakeGetLatestOrganizerRequest(db, userId));
  patch("getOrganizerRequestById", async (id: string) => db.requests.find((r) => r.id === id));
  patch("getOrganizerRequests", async (status?: string) => fakeGetOrganizerRequests(db, status));
  patch("approveOrganizerRequest", async (id: string, reviewerId: string) => fakeApproveOrganizerRequest(db, id, reviewerId));
  patch("rejectOrganizerRequest", async (id: string, reviewerId: string) => fakeRejectOrganizerRequest(db, id, reviewerId));
  patch("createMessage", async (message: any) => fakeCreateMessage(db, message));

  return () => Object.assign(storage, originals);
}

// ---------------------------------------------------------------------
// A minimal real HTTP server: the REAL organizer router, a REAL
// express.json() body parser, and a test-only auth stub standing in for
// Passport (see file header for why).
// ---------------------------------------------------------------------

async function startServer(db: FakeDb) {
  const { storage } = await import("../storage");
  const unpatch = patchStorage(storage, db);
  const { default: organizerRouter } = await import("./organizer");

  const app = express();
  app.use(express.json());
  // Test-only stand-in for `passport.session()` - sets req.user from a
  // header instead of a cookie-backed session, so requireAuth/requireAdmin
  // (the real middleware) see exactly what they'd see in production.
  app.use((req, _res, next) => {
    const id = req.header("x-test-user-id");
    (req as any).user = id ? db.users.get(id) : undefined;
    (req as any).isAuthenticated = () => !!(req as any).user;
    next();
  });
  app.use("/api/organizer", organizerRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/organizer`;

  const close = async () => {
    unpatch();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return { baseUrl, close };
}

async function call(baseUrl: string, userId: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-test-user-id": userId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// ---------------------------------------------------------------------
// Fixtures - exact field shape of server/seeds/testPlayersSeed.ts. Not
// setting isOrganizer/organizerRequest at all matches a freshly seeded
// account: no "I want to organise" checkbox was ever ticked.
// ---------------------------------------------------------------------

function seedFixtures(db: FakeDb) {
  const coach: FakeUser = {
    id: "user-test-coach-01",
    email: "test-coach-01@tennisconnect.test",
    name: "Test Coach 01",
    role: "coach",
    slug: "test-coach-01",
    isOrganizer: false,
    isAdmin: false,
  };
  const player: FakeUser = {
    id: "user-test-player-01",
    email: "test-player-01@tennisconnect.test",
    name: "Test Player 01",
    role: "player",
    slug: "test-player-01",
    isOrganizer: false,
    isAdmin: false,
  };
  const admin: FakeUser = {
    id: "user-admin",
    email: "admin@tennisconnect.test",
    name: "Site Admin",
    role: "admin",
    slug: "admin",
    isOrganizer: false,
    isAdmin: true,
  };
  for (const u of [coach, player, admin]) db.users.set(u.id, u);
  return { coach, player, admin };
}

// ---------------------------------------------------------------------
// The scenario, run once per role so a role-specific bug (a wrong
// "coach"/"player" string, say) can't hide behind only testing one.
// ---------------------------------------------------------------------

async function runApprovalScenario(roleLabel: "coach" | "player") {
  const db = makeFakeDb();
  const { coach, player, admin } = seedFixtures(db);
  const requester = roleLabel === "coach" ? coach : player;
  const { baseUrl, close } = await startServer(db);

  try {
    // Registered without the checkbox: no request exists yet.
    const before = await call(baseUrl, requester.id, "GET", "/requests/me");
    assert.equal(before.status, 200);
    assert.equal(before.json.isOrganizer, false, `${roleLabel}: should not be an organiser yet`);
    assert.equal(before.json.request, null, `${roleLabel}: no request should exist yet`);

    // Requests organiser access from their profile ("Become an Organiser").
    const created = await call(baseUrl, requester.id, "POST", "/requests", {});
    assert.equal(created.status, 201);
    assert.equal(created.json.status, "pending");
    const requestId = created.json.id;

    // What the requester's own profile shows right after sending it.
    const afterCreate = await call(baseUrl, requester.id, "GET", "/requests/me");
    assert.equal(afterCreate.json.isOrganizer, false);
    assert.equal(afterCreate.json.request.status, "pending", `${roleLabel}: BecomeOrganizerCard should show Pending here`);

    // Sending a second request while one is pending is rejected (matches
    // the real route's own check) - not central to the bug, but cheap to
    // pin down since we're already here.
    const duplicate = await call(baseUrl, requester.id, "POST", "/requests", {});
    assert.equal(duplicate.status, 400);

    // The request shows up in the admin's Access Requests queue.
    const queue = await call(baseUrl, admin.id, "GET", "/requests?status=pending");
    assert.equal(queue.status, 200);
    assert.ok(
      queue.json.some((r: any) => r.id === requestId && r.userRole === roleLabel),
      `${roleLabel}: request should appear in the admin's pending queue with the right role`
    );
    assert.equal(db.messages.length, 0, "no notification should exist before any decision");

    // Admin approves.
    const approved = await call(baseUrl, admin.id, "POST", `/requests/${requestId}/approve`);
    assert.equal(approved.status, 200, `${roleLabel}: approve should succeed`);
    assert.equal(approved.json.status, "approved");

    // --- The reported symptoms, checked directly ---

    // 1. "isOrganizer stays false / status stays Pending"
    assert.equal(db.users.get(requester.id)!.isOrganizer, true, `${roleLabel}: isOrganizer must be flipped to true by approval`);
    const afterApprove = await call(baseUrl, requester.id, "GET", "/requests/me");
    assert.equal(afterApprove.status, 200);
    assert.equal(afterApprove.json.isOrganizer, true, `${roleLabel}: /requests/me must report isOrganizer:true after approval`);
    // BecomeOrganizerCard checks status.isOrganizer BEFORE status.request -
    // pin that the request row itself also actually flipped, so a future
    // change to that ordering can't silently start showing "Pending" again.
    assert.equal(afterApprove.json.request.status, "approved", `${roleLabel}: the request row itself must also read approved`);

    // 2. "no message at all"
    const toRequester = db.messages.filter((m) => m.recipientId === requester.id);
    assert.equal(toRequester.length, 1, `${roleLabel}: exactly one notification should have been sent`);
    assert.equal(toRequester[0].subject, "You're Approved as an Organiser!");
    assert.equal(
      toRequester[0].recipientType,
      roleLabel,
      `${roleLabel}: the message's recipientType must be the user's own role, not the reviewer's or a hardcoded one`
    );
    assert.equal(toRequester[0].senderUserId, admin.id);

    // 3. "no button to the Organiser Hub" - the button's visibility, per
    // BecomeOrganizerCard.tsx, is driven entirely by isOrganizer, which
    // step 1 already proved is now true - restated here as the concrete
    // contract the component relies on, so this test still fails if that
    // contract (the shape of /requests/me's response) ever changes.
    assert.deepEqual(
      Object.keys(afterApprove.json).sort(),
      ["isOrganizer", "request"],
      `${roleLabel}: /requests/me's shape must match what BecomeOrganizerCard expects`
    );

    // A second approve of an already-approved request currently sends a
    // second congratulations message - documenting today's actual
    // behaviour, not asserting it's desirable (see summary).
    await call(baseUrl, admin.id, "POST", `/requests/${requestId}/approve`);
    assert.equal(db.messages.filter((m) => m.recipientId === requester.id).length, 2);
  } finally {
    await close();
  }
}

async function runRejectionScenario(roleLabel: "coach" | "player") {
  const db = makeFakeDb();
  const { coach, player, admin } = seedFixtures(db);
  const requester = roleLabel === "coach" ? coach : player;
  const { baseUrl, close } = await startServer(db);

  try {
    const created = await call(baseUrl, requester.id, "POST", "/requests", {});
    const requestId = created.json.id;

    const rejected = await call(baseUrl, admin.id, "POST", `/requests/${requestId}/reject`);
    assert.equal(rejected.status, 200);
    assert.equal(rejected.json.status, "rejected");

    assert.equal(db.users.get(requester.id)!.isOrganizer, false, `${roleLabel}: rejection must not grant organiser access`);
    const me = await call(baseUrl, requester.id, "GET", "/requests/me");
    assert.equal(me.json.request.status, "rejected");

    // Rejection sends no congratulations message (the route intentionally
    // sends none today - this pins that, not a request to add one).
    assert.equal(db.messages.filter((m) => m.recipientId === requester.id).length, 0);

    // After a rejection, the user CAN request again (BecomeOrganizerCard's
    // "Request Again" button relies on this not 400-ing).
    const again = await call(baseUrl, requester.id, "POST", "/requests", {});
    assert.equal(again.status, 201, `${roleLabel}: requesting again after a rejection must be allowed`);
  } finally {
    await close();
  }
}

// ---------------------------------------------------------------------
// Access control, both directions - a wrong-role user must not be able
// to approve their own (or anyone's) request.
// ---------------------------------------------------------------------

async function runAccessControlChecks() {
  const db = makeFakeDb();
  const { coach, player } = seedFixtures(db);
  const { baseUrl, close } = await startServer(db);
  try {
    const created = await call(baseUrl, coach.id, "POST", "/requests", {});
    const requestId = created.json.id;

    const byNonAdmin = await call(baseUrl, player.id, "POST", `/requests/${requestId}/approve`);
    assert.equal(byNonAdmin.status, 403, "a non-admin must not be able to approve a request");

    const byLoggedOut = await call(baseUrl, null, "GET", "/requests/me");
    assert.equal(byLoggedOut.status, 401, "requires auth");

    assert.equal(db.users.get(coach.id)!.isOrganizer, false, "the blocked approve attempt must not have taken effect");
  } finally {
    await close();
  }
}

// ---------------------------------------------------------------------
// The "stale session" hypothesis, checked directly: does the REAL
// passport.deserializeUser callback (what decides req.user on every
// request of an already-logged-in browser) re-read isOrganizer from
// storage, or serve a cached copy from login time? Exercised via the
// real setupAuth() wiring - session/passport middleware is registered
// but never invoked (the fake `app` only records .use()/.set() calls),
// so this never touches a database, live or otherwise.
// ---------------------------------------------------------------------

async function runDeserializeUserCheck() {
  const db = makeFakeDb();
  const { coach } = seedFixtures(db);
  const { storage } = await import("../storage");
  const unpatch = patchStorage(storage, db);
  try {
    const passport = (await import("passport")).default;
    const { setupAuth } = await import("../auth");

    const fakeApp = {
      set: () => fakeApp,
      use: () => fakeApp,
    } as any;
    setupAuth(fakeApp);

    const deserialize = () =>
      new Promise<any>((resolve, reject) => {
        passport.deserializeUser(coach.id, (err: any, user: any) => (err ? reject(err) : resolve(user)));
      });

    const before = await deserialize();
    assert.equal(before.isOrganizer, false, "before approval, a freshly deserialized user is not an organiser");

    db.users.get(coach.id)!.isOrganizer = true; // what approveOrganizerRequest does to the row

    const after = await deserialize();
    assert.equal(
      after.isOrganizer,
      true,
      "deserializeUser must re-read isOrganizer from storage on every request, not reuse a value cached at login"
    );
  } finally {
    unpatch();
  }
}

// ---------------------------------------------------------------------
// Self-check: prove this test suite actually has teeth by reintroducing
// the exact bug shape from the report (approve updates the request row
// but never flips isOrganizer) and confirming the approval scenario then
// FAILS. Restores the correct behaviour immediately after.
// ---------------------------------------------------------------------

async function runMutationSelfCheck() {
  const db = makeFakeDb();
  const { coach, admin } = seedFixtures(db);
  const { baseUrl, close } = await startServer(db);
  try {
    const { storage } = await import("../storage");
    const created = await call(baseUrl, coach.id, "POST", "/requests", {});
    const requestId = created.json.id;

    const realApprove = storage.approveOrganizerRequest.bind(storage);
    // The exact bug shape: only the request row changes, isOrganizer is
    // never touched - the request would end up reporting "approved" to
    // the admin while the requester still sees no organiser access.
    storage.approveOrganizerRequest = async (id: string, reviewerId: string) => {
      const request = db.requests.find((r) => r.id === id)!;
      request.status = "approved";
      request.reviewedBy = reviewerId;
      request.reviewedAt = new Date();
      return request;
    };

    await call(baseUrl, admin.id, "POST", `/requests/${requestId}/approve`);
    const me = await call(baseUrl, coach.id, "GET", "/requests/me");

    assert.notEqual(
      me.json.isOrganizer,
      true,
      "self-check failed: the mutated (buggy) approve was not actually exercised by this harness"
    );

    storage.approveOrganizerRequest = realApprove;
  } finally {
    await close();
  }
}

async function main() {
  console.log("Organiser request approval flow (real router, real HTTP, real requireAuth/requireAdmin)\n");

  await test("coach: full approve flow flips isOrganizer, notifies, and /requests/me matches what the button needs", () =>
    runApprovalScenario("coach")
  );
  await test("player: the same flow, to rule out a role-specific bug", () => runApprovalScenario("player"));
  await test("coach: reject flow grants nothing, sends no message, and allows requesting again", () =>
    runRejectionScenario("coach")
  );
  await test("player: reject flow, same checks", () => runRejectionScenario("player"));
  await test("a non-admin cannot approve, and a logged-out request is rejected", runAccessControlChecks);
  await test("passport.deserializeUser re-reads isOrganizer fresh on every request (no stale session)", runDeserializeUserCheck);
  await test("SELF-CHECK: reintroducing the reported bug shape makes the approval assertion fail, as it should", runMutationSelfCheck);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
