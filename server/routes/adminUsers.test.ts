// npx tsx --test server/routes/adminUsers.test.ts
//
// Admin Users list and account deletion (server/routes/adminUsers.ts) on the
// REAL router, loopback server, faked storage (no Postgres), sign-in by test
// header - same harness as organizerOwnership.test.ts. The fake storage runs
// the real rules (planUserDeletion) over in-memory rows, so this checks the
// routes' accounting, status codes, wording and guards.

process.env.DATABASE_URL ??= "postgres://fake:fake@localhost:5432/fake";
process.env.SUPABASE_URL ??= "http://fake.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fake";
process.env.SESSION_SECRET ??= "fake-session-secret-for-tests-only";

import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { planUserDeletion, uniqueIds, type UserDeletionFacts } from "../../shared/userDeletion";

let USERS: Record<string, any> = {};
let ORGS: { id: string; name: string; slug: string; ownerId: string }[] = [];
let SESSIONS: { id: string; organizationId: string; createdBy: string }[] = [];
let deleteCalls: string[][] = [];
const auditLines: string[] = [];

function reset() {
  USERS = {
    admin: { id: "admin", name: "Admin", email: "admin@x.test", role: "player", isAdmin: true, isOrganizer: false, isApproved: true, password: "h" },
    player: { id: "player", name: "Plain Player", email: "p@x.test", role: "player", isAdmin: false, isOrganizer: false, isApproved: true, password: "h" },
    coach: { id: "coach", name: "Plain Coach", email: "c@x.test", role: "coach", isAdmin: false, isOrganizer: false, isApproved: false, password: "h" },
    busy: { id: "busy", name: "Busy Owner", email: "b@x.test", role: "player", isAdmin: false, isOrganizer: true, isApproved: true, password: "h" },
    // A player whose organiser access was revoked but who still owns an organisation with sessions.
    revoked: { id: "revoked", name: "Revoked Owner", email: "r@x.test", role: "player", isAdmin: false, isOrganizer: false, isApproved: true, password: "h" },
    empty: { id: "empty", name: "Empty Owner", email: "e@x.test", role: "coach", isAdmin: false, isOrganizer: true, isApproved: true, password: "h" },
    other: { id: "other", name: "Other Admin", email: "o@x.test", role: "player", isAdmin: true, isOrganizer: false, isApproved: true, password: "h" },
  };
  ORGS = [
    { id: "org-busy", name: "Busy Club", slug: "busy", ownerId: "busy" },
    { id: "org-rev", name: "Revoked Club", slug: "rev", ownerId: "revoked" },
    { id: "org-empty", name: "Empty Club", slug: "empty", ownerId: "empty" },
  ];
  SESSIONS = [
    { id: "s1", organizationId: "org-busy", createdBy: "busy" },
    { id: "s2", organizationId: "org-busy", createdBy: "busy" },
    { id: "s3", organizationId: "org-rev", createdBy: "revoked" },
  ];
  deleteCalls = [];
  auditLines.length = 0;
}

function facts(ids: string[]): UserDeletionFacts {
  const set = new Set(ids);
  const owned = ORGS.filter((o) => set.has(o.ownerId)).map(({ id, name, ownerId }) => ({ id, name, ownerId }));
  const byOrg = new Map<string, number>();
  for (const s of SESSIONS) if (owned.some((o) => o.id === s.organizationId)) byOrg.set(s.organizationId, (byOrg.get(s.organizationId) ?? 0) + 1);
  const byCreator = new Map<string, number>();
  for (const s of SESSIONS) if (set.has(s.createdBy)) byCreator.set(s.createdBy, (byCreator.get(s.createdBy) ?? 0) + 1);
  return { ownedOrganizations: owned, sessionCountByOrganization: byOrg, createdSessionCountByUser: byCreator };
}

let server: http.Server;
let base = "";

before(async () => {
  reset();
  const { storage } = await import("../storage");
  const s = storage as any;
  s.getAllUsers = async () => Object.values(USERS);
  s.getOrganizerRequests = async () => [{ userId: "coach", status: "pending" }];
  s.getOrganizationsByOwnerIds = async (ids: string[]) => ORGS.filter((o) => ids.includes(o.ownerId));
  s.getUserDeletionFacts = async (ids: string[]) => facts(ids);
  s.deleteUserAccounts = async (ids: string[], options: { selfId?: string } = {}) => {
    deleteCalls.push(ids);
    const requested = uniqueIds(ids);
    const plan = planUserDeletion({ requestedIds: requested, existingIds: Object.keys(USERS), selfId: options.selfId, ...facts(requested) });
    for (const id of plan.allowedIds) delete USERS[id];
    ORGS = ORGS.filter((o) => !plan.emptyOrganizationIdsToCascade.includes(o.id));
    return { deleted: plan.allowedIds, failed: plan.failed };
  };
  const origInfo = console.info;
  console.info = (...args: unknown[]) => {
    const line = args.join(" ");
    if (line.startsWith("[admin-audit]")) auditLines.push(line);
    else origInfo(...args);
  };

  const { default: router } = await import("./adminUsers");
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    const id = req.headers["x-test-user-id"];
    req.user = typeof id === "string" ? USERS[id] : undefined;
    req.isAuthenticated = () => !!req.user;
    next();
  });
  app.use("/api/admin", router);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server?.close());
beforeEach(reset);

async function call(method: string, path: string, as: string | null, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(as ? { "x-test-user-id": as } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("only admins reach the routes", async () => {
  assert.equal((await call("GET", "/api/admin/users", null)).status, 401);
  assert.equal((await call("GET", "/api/admin/users", "player")).status, 403);
  assert.equal((await call("DELETE", "/api/admin/users/coach", "player")).status, 403);
  assert.equal((await call("POST", "/api/admin/users/bulk-delete", "player", { ids: ["coach"] })).status, 403);
  assert.equal(deleteCalls.length, 0, "nothing reached storage");
});

test("list: no passwords, protected accounts flagged, every owner's organisation shown with its session count", async () => {
  const { status, body } = await call("GET", "/api/admin/users", "admin");
  assert.equal(status, 200);
  const byId = Object.fromEntries(body.map((u: any) => [u.id, u]));
  assert.ok(body.every((u: any) => !("password" in u)));
  assert.equal(byId.player.deletionBlock, null);
  assert.equal(byId.empty.deletionBlock, null, "an empty organisation doesn't protect its owner");
  assert.equal(byId.busy.deletionBlock.code, "owns_organization_with_sessions");
  assert.match(byId.busy.deletionBlock.message, /"Busy Club", which has 2 sessions/);
  // The revoked organiser: before, ownedOrganization was only filled for current organisers,
  // so this account was blocked with no "Delete organisation" action.
  assert.deepEqual(byId.revoked.ownedOrganization, { id: "org-rev", name: "Revoked Club", slug: "rev", ownerId: "revoked", sessionCount: 1 });
  assert.equal(byId.revoked.deletionBlock.code, "owns_organization_with_sessions");
  assert.equal(byId.coach.organizerRequestStatus, "pending");
});

test("single delete: eligible account is deleted", async () => {
  const res = await call("DELETE", "/api/admin/users/player", "admin");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.deleted, ["player"]);
  assert.equal(USERS.player, undefined);
  assert.match(auditLines.at(-1)!, /delete-user admin=admin requested=1 deleted=1 not_deleted=0/);
});

test("single delete: protected account is refused with code, organisation and wording; nothing deleted", async () => {
  const res = await call("DELETE", "/api/admin/users/busy", "admin");
  assert.equal(res.status, 400);
  assert.equal(res.body.code, "owns_organization_with_sessions");
  assert.deepEqual(res.body.organization, { id: "org-busy", name: "Busy Club" });
  assert.equal(res.body.sessionCount, 2);
  assert.match(res.body.message, /Not deleted/);
  assert.ok(USERS.busy, "still there");
  assert.equal(ORGS.length, 3, "no organisation touched");
});

test("single delete: self 400, missing 404", async () => {
  const self = await call("DELETE", "/api/admin/users/admin", "admin");
  assert.equal(self.status, 400);
  assert.equal(self.body.code, "self");
  assert.match(self.body.message, /cannot delete yourself/);
  assert.ok(USERS.admin);
  const gone = await call("DELETE", "/api/admin/users/nobody", "admin");
  assert.equal(gone.status, 404);
  assert.equal(gone.body.code, "not_found");
});

test("bulk: partial success with exact counts, reasons, no collateral deletions", async () => {
  const ids = ["player", "coach", "busy", "revoked", "empty", "admin", "nobody", "player"];
  const res = await call("POST", "/api/admin/users/bulk-delete", "admin", { ids });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.deleted.sort(), ["coach", "empty", "player"]);
  assert.deepEqual(res.body.failed.map((f: any) => [f.id, f.code]), [
    ["busy", "owns_organization_with_sessions"],
    ["revoked", "owns_organization_with_sessions"],
    ["admin", "self"],
    ["nobody", "not_found"],
  ]);
  assert.deepEqual(res.body.summary, { requested: 7, deleted: 3, notDeleted: 4 });
  // Only the eligible selected accounts are gone; "other" was never selected.
  assert.deepEqual(Object.keys(USERS).sort(), ["admin", "busy", "other", "revoked"]);
  assert.deepEqual(ORGS.map((o) => o.id).sort(), ["org-busy", "org-rev"], "only the deleted owner's empty organisation went");
  assert.deepEqual(deleteCalls, [["player", "coach", "busy", "revoked", "empty", "admin", "nobody"]], "deduplicated before storage");
  assert.match(auditLines.at(-1)!, /bulk-delete admin=admin requested=7 deleted=3 not_deleted=4/);
  assert.doesNotMatch(auditLines.at(-1)!, /@/, "no emails in the audit line");
});

test("bulk: a repeated submission deletes nothing more and reports not found", async () => {
  await call("POST", "/api/admin/users/bulk-delete", "admin", { ids: ["player", "coach"] });
  const again = await call("POST", "/api/admin/users/bulk-delete", "admin", { ids: ["player", "coach"] });
  assert.equal(again.status, 200);
  assert.deepEqual(again.body.deleted, []);
  assert.deepEqual(again.body.failed.map((f: any) => f.code), ["not_found", "not_found"]);
});

test("bulk: bad input and oversized batches are refused before storage", async () => {
  for (const body of [{}, { ids: [] }, { ids: "player" }, { ids: [1, 2, ""] }]) {
    assert.equal((await call("POST", "/api/admin/users/bulk-delete", "admin", body)).status, 400, JSON.stringify(body));
  }
  const tooMany = Array.from({ length: 501 }, (_, i) => `u${i}`);
  const big = await call("POST", "/api/admin/users/bulk-delete", "admin", { ids: tooMany });
  assert.equal(big.status, 400);
  assert.match(big.body.message, /At most 500/);
  assert.equal(deleteCalls.length, 0);
});
