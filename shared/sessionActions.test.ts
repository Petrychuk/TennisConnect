import assert from "node:assert/strict";
import test from "node:test";
import { canAnnounceToSession, canInviteToSession, publicSessionPath } from "./sessionActions";

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
