// Needs PASSTHROUGH_SCHEMAS-free run in CI (real drizzle-zod); locally without drizzle-zod the harness stubs insert schemas.
// npx tsx --test server/routes/organizerDrafts.test.ts
//
// Session DRAFT API (shared/sessionDraft.ts) on the REAL organizer router,
// loopback server, faked storage (no Postgres), sign-in by test header - the
// same harness as organizerOwnership.test.ts.
//
//  - a draft can be incomplete (POST / PUT never ask for publish-only fields)
//  - saving again updates the SAME row (never a second one)
//  - a save that carries a stale updatedAt is refused (409) and changes nothing
//  - a null on an optional field really clears it
//  - only a complete draft can be published, and only once

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
  alice: { id: "alice", role: "player", isOrganizer: true, isAdmin: false, name: "Alice", email: "a@x.test" },
  bob: { id: "bob", role: "player", isOrganizer: true, isAdmin: false, name: "Bob", email: "b@x.test" },
  admin: { id: "admin", role: "player", isOrganizer: false, isAdmin: true, name: "Admin", email: "adm@x.test" },
};
const ORGS: Record<string, any> = { "org-a": { id: "org-a", ownerId: "alice" }, "org-b": { id: "org-b", ownerId: "bob" } };

let SESSIONS: Record<string, any> = {};
let nextId = 1;
let tick = 0;
// Drizzle ignores undefined keys in .set(); a plain spread would not
const defined = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const stamp = () => new Date(Date.parse("2026-11-05T00:00:00Z") + ++tick * 1000);
const publishCalls: string[] = [];

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
    getOrganizationOwnedByUser: async (userId: string) => Object.values(ORGS).find((o: any) => o.ownerId === userId),
    getAdminUsers: async () => [],
    createSession: async (organizationId: string, createdBy: string, data: any) => {
      const id = `s-${nextId++}`;
      const now = stamp();
      return (SESSIONS[id] = { id, organizationId, createdBy, status: "draft", type: "social", ...defined(data), createdAt: now, updatedAt: now });
    },
    updateSession: async (id: string, changes: any) => (SESSIONS[id] = { ...SESSIONS[id], ...defined(changes), updatedAt: stamp() }),
    updateSessionIfUnchanged: async (id: string, changes: any, expected: Date) => {
      if (new Date(SESSIONS[id].updatedAt).getTime() !== expected.getTime()) return undefined;
      return (SESSIONS[id] = { ...SESSIONS[id], ...defined(changes), updatedAt: stamp() });
    },
    submitSessionForReview: async (id: string) => (publishCalls.push(`review:${id}`), (SESSIONS[id] = { ...SESSIONS[id], status: "pending_review", updatedAt: stamp() })),
    publishSessionDirect: async (id: string) => (publishCalls.push(`direct:${id}`), (SESSIONS[id] = { ...SESSIONS[id], status: "published", updatedAt: stamp() })),
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
  nextId = 1;
  publishCalls.length = 0;
});

async function call(user: string | null, method: string, path: string, body: unknown = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json };
}

const future = "2027-01-15T09:00:00.000Z";
const complete = { title: "Wednesday Social", location: "Rushcutters Bay", startAt: future };

test("a draft can be incomplete: placeholder name, no venue, nothing publish-only required", async () => {
  const res = await call("alice", "POST", "/sessions", { title: "Untitled Session", startAt: future });
  assert.equal(res.status, 201);
  assert.equal(res.json.status, "draft");
  assert.equal(Object.keys(SESSIONS).length, 1);
});

test("saving again updates the same row: still one session, same id, newer updatedAt", async () => {
  const created = (await call("alice", "POST", "/sessions", { title: "Untitled Session", startAt: future })).json;
  const a = await call("alice", "PUT", `/sessions/${created.id}`, { title: "Club night", expectedUpdatedAt: created.updatedAt });
  assert.equal(a.status, 200);
  assert.equal(a.json.id, created.id);
  assert.equal(a.json.title, "Club night");
  const b = await call("alice", "PUT", `/sessions/${created.id}`, { location: "Court 1", expectedUpdatedAt: a.json.updatedAt });
  assert.equal(b.status, 200);
  assert.equal(Object.keys(SESSIONS).length, 1);
  assert.equal(SESSIONS[created.id].title, "Club night", "earlier edits are kept");
  assert.equal(SESSIONS[created.id].location, "Court 1");
  assert.ok(new Date(b.json.updatedAt) > new Date(created.updatedAt));
});

test("a save with a stale updatedAt is refused with 409 and changes nothing", async () => {
  const created = (await call("alice", "POST", "/sessions", { ...complete })).json;
  const first = await call("alice", "PUT", `/sessions/${created.id}`, { title: "Edited on device 1", expectedUpdatedAt: created.updatedAt });
  assert.equal(first.status, 200);
  // device 2 still holds the original updatedAt
  const stale = await call("alice", "PUT", `/sessions/${created.id}`, { title: "Edited on device 2", expectedUpdatedAt: created.updatedAt });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.code, "stale");
  assert.match(stale.json.message, /changed somewhere else/);
  assert.equal(SESSIONS[created.id].title, "Edited on device 1");
});

test("without expectedUpdatedAt a PUT still works (existing callers); a garbage one is a 400", async () => {
  const created = (await call("alice", "POST", "/sessions", { ...complete })).json;
  assert.equal((await call("alice", "PUT", `/sessions/${created.id}`, { title: "No guard" })).status, 200);
  const bad = await call("alice", "PUT", `/sessions/${created.id}`, { title: "x y", expectedUpdatedAt: "not-a-date" });
  assert.equal(bad.status, 400);
});

test("null clears an optional field for real (not 1970, not 0) and leaves everything else alone", async () => {
  const created = (await call("alice", "POST", "/sessions", { ...complete, endAt: "2027-01-15T11:00:00.000Z", maxParticipants: 12, courtsCount: 3 })).json;
  const res = await call("alice", "PUT", `/sessions/${created.id}`, { location: null, endAt: null, maxParticipants: null, expectedUpdatedAt: created.updatedAt });
  assert.equal(res.status, 200);
  assert.equal(SESSIONS[created.id].location, null);
  assert.equal(SESSIONS[created.id].endAt, null);
  assert.equal(SESSIONS[created.id].maxParticipants, null);
  assert.equal(SESSIONS[created.id].courtsCount, 3);
  assert.equal(SESSIONS[created.id].title, "Wednesday Social");
});

test("an organiser can't save to or publish another organiser's draft", async () => {
  const created = (await call("alice", "POST", "/sessions", { ...complete })).json;
  assert.equal((await call("bob", "PUT", `/sessions/${created.id}`, { title: "Hijack" })).status, 403);
  assert.equal((await call("bob", "POST", `/sessions/${created.id}/publish`)).status, 403);
  assert.deepEqual(publishCalls, []);
  assert.equal(SESSIONS[created.id].title, "Wednesday Social");
});

test("publishing an incomplete draft is refused with what is missing; the draft is untouched", async () => {
  const created = (await call("alice", "POST", "/sessions", { title: "Untitled Session", startAt: future })).json;
  const res = await call("alice", "POST", `/sessions/${created.id}/publish`);
  assert.equal(res.status, 400);
  assert.equal(res.json.code, "incomplete");
  assert.match(res.json.message, /name/);
  assert.match(res.json.message, /venue/);
  assert.equal(SESSIONS[created.id].status, "draft");
  assert.deepEqual(publishCalls, []);
});

test("publishing a draft in the past is refused", async () => {
  const created = (await call("alice", "POST", "/sessions", { ...complete, startAt: "2026-01-01T09:00:00.000Z" })).json;
  const res = await call("alice", "POST", `/sessions/${created.id}/publish`);
  assert.equal(res.status, 400);
  assert.match(res.json.message, /already passed/);
});

test("publish updates the SAME session (no duplicate); a second publish is refused and does not submit again", async () => {
  const created = (await call("alice", "POST", "/sessions", { ...complete })).json;
  const first = await call("alice", "POST", `/sessions/${created.id}/publish`);
  assert.equal(first.status, 200);
  assert.equal(first.json.id, created.id);
  assert.equal(first.json.status, "pending_review"); // an organiser's publish goes to admin review
  assert.equal(Object.keys(SESSIONS).length, 1);

  const second = await call("alice", "POST", `/sessions/${created.id}/publish`);
  assert.equal(second.status, 409);
  assert.equal(second.json.code, "not_publishable");
  assert.deepEqual(publishCalls, [`review:${created.id}`], "submitted exactly once");
});

test("an admin's publish goes straight to published, once", async () => {
  SESSIONS["s-x"] = { id: "s-x", organizationId: "org-a", status: "draft", ...complete, updatedAt: stamp() };
  ORGS["org-a"].ownerId = "admin"; // the admin owns this organisation for the test
  try {
    const res = await call("admin", "POST", "/sessions/s-x/publish");
    assert.equal(res.status, 200);
    assert.equal(res.json.status, "published");
    assert.equal((await call("admin", "POST", "/sessions/s-x/publish")).status, 409);
    assert.deepEqual(publishCalls, ["direct:s-x"]);
  } finally {
    ORGS["org-a"].ownerId = "alice";
  }
});

test("a live, published or cancelled session is never reset by a publish call", async () => {
  for (const status of ["published", "live", "cancelled", "completed", "pending_review"]) {
    SESSIONS[`s-${status}`] = { id: `s-${status}`, organizationId: "org-a", status, ...complete, updatedAt: stamp() };
    const res = await call("alice", "POST", `/sessions/s-${status}/publish`);
    assert.equal(res.status, 409, status);
    assert.equal(SESSIONS[`s-${status}`].status, status, `${status} untouched`);
  }
  assert.deepEqual(publishCalls, []);
});

test("a rejected session can be fixed and resubmitted", async () => {
  SESSIONS["s-r"] = { id: "s-r", organizationId: "org-a", status: "rejected", ...complete, updatedAt: stamp() };
  const res = await call("alice", "POST", "/sessions/s-r/publish");
  assert.equal(res.status, 200);
  assert.equal(res.json.status, "pending_review");
});
