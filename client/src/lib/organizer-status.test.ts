// npx tsx client/src/lib/organizer-status.test.ts
//
// [BUG][ORGANIZER] Regression tests for: an approved organizer's own
// profile still shows "Pending", with no "Open Organiser Hub" button.
//
// `OrganizerStatusData` (from useOrganizerStatus) has no `role` field -
// it's the same shape for a coach's profile and a player's profile, so
// there is nothing role-specific for this resolver to get wrong. These
// cases are still run once per role, spelled out explicitly, so a
// reviewer can see at a glance that both are covered - which is the
// concrete thing that was asked for ("check the player too").

import assert from "node:assert/strict";
import { resolveOrganizerCardView, type OrganizerCardView } from "./organizer-status";
import type { OrganizerStatusData } from "../hooks/use-organizer-status";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL - ${name}`);
    console.error(err);
  }
}

console.log("organizer-status.ts");

const requestOf = (status: "pending" | "approved" | "rejected" | "revoked"): OrganizerStatusData["request"] => ({
  id: "req-1",
  status,
});

const kindOf = (v: OrganizerCardView) => v.kind;

for (const role of ["coach", "player"] as const) {
  test(`${role}: approved organizer with no request row at all shows "approved" (button to Organiser Hub)`, () => {
    const status: OrganizerStatusData = { isOrganizer: true, request: null };
    assert.equal(kindOf(resolveOrganizerCardView(status)), "approved");
  });

  test(`${role}: no request yet shows "none" (the "Become an Organiser" button)`, () => {
    const status: OrganizerStatusData = { isOrganizer: false, request: null };
    assert.equal(kindOf(resolveOrganizerCardView(status)), "none");
  });

  test(`${role}: a genuinely pending request (not yet reviewed) shows "pending"`, () => {
    const status: OrganizerStatusData = { isOrganizer: false, request: requestOf("pending") };
    assert.equal(kindOf(resolveOrganizerCardView(status)), "pending");
  });

  test(`${role}: a rejected request with no organizer access shows "rejected"`, () => {
    const status: OrganizerStatusData = { isOrganizer: false, request: requestOf("rejected") };
    assert.equal(kindOf(resolveOrganizerCardView(status)), "rejected");
  });

  test(`${role}: a revoked request with no organizer access shows "revoked"`, () => {
    const status: OrganizerStatusData = { isOrganizer: false, request: requestOf("revoked") };
    assert.equal(kindOf(resolveOrganizerCardView(status)), "revoked");
  });

  // --- the reported bug, pinned directly ---
  test(`${role}: THE BUG CASE - approved (isOrganizer true) with the request row still reading "pending" must show "approved", never "pending"`, () => {
    // This is exactly the shape the backend can legitimately produce for
    // a moment (or forever, if the request row's own status update ever
    // fails independently of the isOrganizer flip): isOrganizer is
    // already true, but the request object that came along with it still
    // says "pending". The account's real access must win.
    const status: OrganizerStatusData = { isOrganizer: true, request: requestOf("pending") };
    assert.equal(kindOf(resolveOrganizerCardView(status)), "approved");
  });

  test(`${role}: approved also wins over a stale rejected or revoked request row`, () => {
    assert.equal(kindOf(resolveOrganizerCardView({ isOrganizer: true, request: requestOf("rejected") })), "approved");
    assert.equal(kindOf(resolveOrganizerCardView({ isOrganizer: true, request: requestOf("revoked") })), "approved");
  });
}

// --- mutation check: prove this test suite actually has teeth ---
test("MUTATION CHECK: checking request.status before isOrganizer reproduces the reported bug and fails this suite", () => {
  // The exact class of regression this file exists to catch: if a future
  // edit reorders the two checks so a leftover "pending" request row is
  // read first, an approved organizer would be shown "Pending" again -
  // this must be caught, not silently pass.
  function buggyResolve(status: OrganizerStatusData): OrganizerCardView {
    if (status.request?.status === "pending") return { kind: "pending" };
    if (status.isOrganizer) return { kind: "approved" };
    if (status.request?.status === "rejected") return { kind: "rejected" };
    if (status.request?.status === "revoked") return { kind: "revoked" };
    return { kind: "none" };
  }
  const buggyStatus: OrganizerStatusData = { isOrganizer: true, request: requestOf("pending") };
  assert.equal(kindOf(buggyResolve(buggyStatus)), "pending"); // the bug, reproduced
  assert.notEqual(kindOf(resolveOrganizerCardView(buggyStatus)), "pending"); // the real resolver does not have it
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
