import assert from "node:assert/strict";
import test from "node:test";
import {
  CANCELLABLE_SESSION_STATUSES,
  EDIT_LOCKED_SESSION_STATUSES,
  REVIEWABLE_SESSION_STATUS,
  canAnnounceToSession,
  canArchiveSession,
  canCancelSession,
  canChangeRoster,
  canInviteToSession,
  isSessionEditable,
  publicSessionPath,
  resultsAreFinal,
} from "./sessionActions";

const NOW = new Date("2026-10-30T10:00:00Z");

test("invites: only published or live sessions that haven't finished", () => {
  assert.equal(canInviteToSession("published", "2026-10-30T12:00:00Z", NOW), true);
  assert.equal(canInviteToSession("live", null, NOW), true);
  assert.equal(canInviteToSession("published", "2026-10-30T09:00:00Z", NOW), false, "already finished");
  for (const status of ["draft", "pending_review", "rejected", "cancelled", "completed", "archived", null, undefined]) {
    assert.equal(canInviteToSession(status, null, NOW), false, String(status));
  }
});

test("announcements: anything but a draft (a draft has nobody registered)", () => {
  assert.equal(canAnnounceToSession("draft"), false);
  assert.equal(canAnnounceToSession(undefined), false);
  for (const status of ["pending_review", "published", "live", "completed", "cancelled", "archived"]) {
    assert.equal(canAnnounceToSession(status), true, status);
  }
});

test("public page link only while Play would show the session", () => {
  assert.equal(publicSessionPath({ id: "s1", status: "published", visibility: "public" }), "/play/s1");
  assert.equal(publicSessionPath({ id: "s1", status: "live" }), "/play/s1");
  assert.equal(publicSessionPath({ id: "s1", status: "published", visibility: "invite" }), null);
  for (const status of ["draft", "pending_review", "cancelled", "completed", "archived"]) {
    assert.equal(publicSessionPath({ id: "s1", status, visibility: "public" }), null, status);
  }
});

test("after Finish: results final, roster frozen; cancel only before it ran; a live session isn't archived", () => {
  assert.equal(resultsAreFinal("completed"), true);
  assert.equal(resultsAreFinal("archived"), true);
  assert.equal(resultsAreFinal("live"), false);
  for (const status of ["published", "live", "pending_review", "draft"]) assert.equal(canChangeRoster(status), true, status);
  for (const status of ["completed", "archived", "cancelled", null]) assert.equal(canChangeRoster(status), false, String(status));
  for (const status of ["draft", "pending_review", "published"]) assert.equal(canCancelSession(status), true, status);
  for (const status of ["live", "completed", "archived", "cancelled"]) assert.equal(canCancelSession(status), false, status);
  assert.equal(canArchiveSession("completed"), true);
  assert.equal(canArchiveSession("published"), true);
  assert.equal(canArchiveSession("live"), false);
  assert.equal(canArchiveSession("archived"), false);
});

// TC-212 (OH-AUDIT-005/006): the lists the conditional database writes use
// must say exactly what the predicates say.
test("edit: never a completed, archived or cancelled session; every other status can be edited", () => {
  for (const status of ["draft", "pending_review", "rejected", "published", "live"]) assert.equal(isSessionEditable(status), true, status);
  for (const status of ["completed", "archived", "cancelled", null, undefined, ""]) assert.equal(isSessionEditable(status), false, String(status));
  assert.deepEqual([...EDIT_LOCKED_SESSION_STATUSES].sort(), ["archived", "cancelled", "completed"]);
});

test("cancel / review status lists match their predicates", () => {
  for (const status of CANCELLABLE_SESSION_STATUSES) assert.equal(canCancelSession(status), true, status);
  assert.deepEqual([...CANCELLABLE_SESSION_STATUSES].sort(), ["draft", "pending_review", "published"]);
  assert.equal(REVIEWABLE_SESSION_STATUS, "pending_review");
});
