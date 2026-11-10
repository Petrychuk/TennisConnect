// npm run test:ui
//
// Admin Users tab filters: role x organiser status x account status. These
// decide which rows a bulk delete can reach (with bulkDeleteTargets).

import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ADMIN_USER_FILTERS, filterAdminUsers, filtersKey, type AdminUserFilters } from "./adminUserFilters";

const users = [
  { id: "p-ok", role: "player", isApproved: true, isOrganizer: false, organizerRequestStatus: null },
  { id: "p-pend", role: "player", isApproved: false, isOrganizer: false, organizerRequestStatus: "pending" },
  { id: "p-org", role: "player", isApproved: true, isOrganizer: true, organizerRequestStatus: null },
  { id: "p-rej", role: "player", isApproved: true, isOrganizer: false, organizerRequestStatus: "rejected" },
  { id: "c-ok", role: "coach", isApproved: true, isOrganizer: false, organizerRequestStatus: "pending" },
  { id: "c-pend", role: "coach", isApproved: false, isOrganizer: true, organizerRequestStatus: null },
];
const ids = (f: Partial<AdminUserFilters>) => filterAdminUsers(users, { ...DEFAULT_ADMIN_USER_FILTERS, ...f }).map((u) => u.id);

test("role filter: All / Players / Coaches", () => {
  assert.deepEqual(ids({}), users.map((u) => u.id));
  assert.deepEqual(ids({ role: "player" }), ["p-ok", "p-pend", "p-org", "p-rej"]);
  assert.deepEqual(ids({ role: "coach" }), ["c-ok", "c-pend"]);
});

test("organiser filter: Approved / Not Organisers / Awaiting Approval", () => {
  assert.deepEqual(ids({ organizer: "organizers" }), ["p-org", "c-pend"]);
  assert.deepEqual(ids({ organizer: "not-organizers" }), ["p-ok", "p-pend", "p-rej", "c-ok"]);
  assert.deepEqual(ids({ organizer: "awaiting" }), ["p-pend", "c-ok"]);
});

test("account status filter: Approved / Pending", () => {
  assert.deepEqual(ids({ status: "approved" }), ["p-ok", "p-org", "p-rej", "c-ok"]);
  assert.deepEqual(ids({ status: "pending" }), ["p-pend", "c-pend"]);
});

test("combinations narrow, never widen", () => {
  assert.deepEqual(ids({ role: "player", organizer: "awaiting" }), ["p-pend"]);
  assert.deepEqual(ids({ role: "coach", organizer: "awaiting", status: "approved" }), ["c-ok"]);
  assert.deepEqual(ids({ role: "coach", organizer: "organizers", status: "approved" }), []);
  assert.deepEqual(ids({ role: "player", status: "pending", organizer: "not-organizers" }), ["p-pend"]);
  for (const role of ["all", "player", "coach"] as const)
    for (const organizer of ["all", "organizers", "not-organizers", "awaiting"] as const)
      for (const status of ["all", "approved", "pending"] as const) {
        const combo = ids({ role, organizer, status });
        for (const id of combo) assert.ok(ids({ role }).includes(id) && ids({ organizer }).includes(id) && ids({ status }).includes(id));
      }
});

test("filtersKey changes with every filter (the tab clears its selection on change)", () => {
  const keys = new Set<string>();
  for (const role of ["all", "player", "coach"] as const)
    for (const organizer of ["all", "organizers", "not-organizers", "awaiting"] as const)
      for (const status of ["all", "approved", "pending"] as const) keys.add(filtersKey({ role, organizer, status }));
  assert.equal(keys.size, 36);
});
