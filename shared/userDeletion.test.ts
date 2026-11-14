// npm run test:ui
//
// Account deletion rules and accounting (admin single / bulk delete). The rule
// itself is unchanged; these pin the accounting: every id lands in exactly one
// of deleted / failed, with a reason an admin can act on.

import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_BULK_DELETE,
  adminDeletionMessage,
  bulkDeleteTargets,
  deletionBlocks,
  planUserDeletion,
  summariseDeletion,
  toAdminFailure,
  uniqueIds,
} from "./userDeletion";

const orgs = [
  { id: "org-busy", name: "Busy Club", ownerId: "owner-busy" },
  { id: "org-empty", name: "Empty Club", ownerId: "owner-empty" },
  { id: "org-busy-2", name: "Second Busy", ownerId: "owner-two" },
];
const sessions = new Map([["org-busy", 3], ["org-busy-2", 1]]);
const created = new Map([["creator", 2], ["owner-busy", 3]]);
const base = {
  ownedOrganizations: orgs,
  sessionCountByOrganization: sessions,
  createdSessionCountByUser: created,
};

test("eligible accounts are allowed; protected ones are refused with the reason", () => {
  const plan = planUserDeletion({
    ...base,
    requestedIds: ["plain", "owner-busy", "owner-empty", "creator"],
    existingIds: ["plain", "owner-busy", "owner-empty", "creator"],
  });
  assert.deepEqual(plan.allowedIds, ["plain", "owner-empty"]);
  assert.deepEqual(plan.failed.map((f) => [f.id, f.code]), [
    ["owner-busy", "owns_organization_with_sessions"],
    ["creator", "created_sessions"],
  ]);
  const busy = plan.failed[0];
  assert.deepEqual(busy.organization, { id: "org-busy", name: "Busy Club" });
  assert.equal(busy.sessionCount, 3);
  // The empty organisation goes with its (deleted) owner; the busy one is never touched.
  assert.deepEqual(plan.emptyOrganizationIdsToCascade, ["org-empty"]);
});

test("nothing is cascaded from under an owner whose own deletion was refused", () => {
  const plan = planUserDeletion({
    ...base,
    ownedOrganizations: [...orgs, { id: "org-empty-2", name: "Spare", ownerId: "owner-busy" }],
    requestedIds: ["owner-busy"],
    existingIds: ["owner-busy"],
  });
  assert.deepEqual(plan.allowedIds, []);
  assert.deepEqual(plan.emptyOrganizationIdsToCascade, []);
});

test("every requested id is accounted for exactly once: duplicates, missing ids, self", () => {
  const plan = planUserDeletion({
    ...base,
    requestedIds: ["a", "a", "gone", "admin", "", 7 as unknown as string, "owner-two", "b"],
    existingIds: ["a", "admin", "owner-two", "b"],
    selfId: "admin",
  });
  assert.deepEqual(plan.allowedIds, ["a", "b"]);
  assert.deepEqual(plan.failed.map((f) => [f.id, f.code]), [
    ["gone", "not_found"],
    ["admin", "self"],
    ["owner-two", "owns_organization_with_sessions"],
  ]);
  const all = [...plan.allowedIds, ...plan.failed.map((f) => f.id)];
  assert.equal(new Set(all).size, all.length, "no id twice");
  assert.deepEqual(uniqueIds(["x", "x", " ", "y", null]), ["x", "y"]);
});

test("17 selected, 8 protected: 9 deleted, 8 not deleted, grouped by reason", () => {
  const plain = Array.from({ length: 9 }, (_, i) => `p${i}`);
  const owners = Array.from({ length: 6 }, (_, i) => `o${i}`);
  const creators = ["c0", "c1"];
  const plan = planUserDeletion({
    requestedIds: [...plain, ...owners, ...creators],
    existingIds: [...plain, ...owners, ...creators],
    ownedOrganizations: owners.map((o) => ({ id: `org-${o}`, name: `Club ${o}`, ownerId: o })),
    sessionCountByOrganization: new Map(owners.map((o) => [`org-${o}`, 1])),
    createdSessionCountByUser: new Map(creators.map((c) => [c, 1])),
  });
  const summary = summariseDeletion({ deleted: plan.allowedIds, failed: plan.failed.map(toAdminFailure) });
  assert.equal(summary.title, "9 deleted, 8 not deleted");
  assert.equal(summary.deletedCount, 9);
  assert.equal(summary.notDeletedCount, 8);
  assert.deepEqual(summary.groups.map((g) => [g.code, g.failures.length]), [
    ["owns_organization_with_sessions", 6],
    ["created_sessions", 2],
  ]);
});

test("summary titles: all deleted, none deleted", () => {
  assert.equal(summariseDeletion({ deleted: ["a"], failed: [] }).title, "1 user deleted");
  assert.equal(summariseDeletion({ deleted: ["a", "b"], failed: [] }).title, "2 users deleted");
  assert.equal(
    summariseDeletion({ deleted: [], failed: [{ id: "x", code: "not_found", message: "" }] }).title,
    "No users deleted (1 not deleted)",
  );
  // An older server without codes still shows up, under Server error.
  const legacy = summariseDeletion({ deleted: [], failed: [{ id: "x", code: "weird" as any, message: "?" }] });
  assert.deepEqual(legacy.groups.map((g) => g.code), ["error"]);
});

test("admin wording names the organisation, the session count and the way forward", () => {
  const msg = adminDeletionMessage({ code: "owns_organization_with_sessions", organization: { id: "o", name: "Busy Club" }, sessionCount: 3 });
  assert.match(msg, /"Busy Club"/);
  assert.match(msg, /3 sessions \(any status\)/);
  assert.match(msg, /delete the organisation from this row/);
  assert.doesNotMatch(msg, /^You own/, "not the self-service voice");
  assert.match(adminDeletionMessage({ code: "created_sessions", sessionCount: 1 }), /1 session /);
  assert.equal(adminDeletionMessage({ code: "self" }), "You cannot delete yourself.");
  assert.match(adminDeletionMessage({ code: "not_found" }), /Already deleted/);
  assert.match(adminDeletionMessage({ code: "error" }), /Nothing was removed/);
});

test("bulk targets: only ticked rows that are visible under the current filters, never the admin", () => {
  assert.deepEqual(bulkDeleteTargets(["p1", "c1", "admin", "p1"], ["p1", "p2", "admin"], "admin"), ["p1"]);
  assert.deepEqual(bulkDeleteTargets(new Set(["c1"]), ["p1"], null), [], "a coach ticked under Coaches is not sent from Players");
  assert.ok(MAX_BULK_DELETE >= 17);
});

test("list blocks match what a delete would do", () => {
  const blocks = deletionBlocks(["plain", "owner-busy", "owner-empty", "creator"], base);
  assert.deepEqual([...blocks.keys()].sort(), ["creator", "owner-busy"]);
  assert.match(blocks.get("owner-busy")!.message, /Busy Club/);
});
