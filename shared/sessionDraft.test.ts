import test from "node:test";
import assert from "node:assert/strict";
import {
  CLEARABLE_SESSION_FIELDS,
  DRAFT_PLACEHOLDER_TITLE,
  isPlaceholderTitle,
  publishProblems,
  publishStatusProblem,
  readExpectedUpdatedAt,
  splitNullClears,
} from "./sessionDraft";

const NOW = Date.parse("2026-11-05T00:00:00Z");
const future = "2026-12-01T09:00:00Z";

test("a draft with a placeholder name is not publishable, a real one is", () => {
  assert.ok(isPlaceholderTitle(DRAFT_PLACEHOLDER_TITLE));
  assert.ok(isPlaceholderTitle("  untitled session "));
  assert.ok(isPlaceholderTitle(""));
  assert.ok(!isPlaceholderTitle("Wednesday Social"));
});

test("publishProblems lists every missing publish-only item, and nothing for a complete session", () => {
  assert.deepEqual(publishProblems({ title: "Wednesday Social", location: "Rushcutters Bay", startAt: future }, NOW), []);
  const all = publishProblems({ title: DRAFT_PLACEHOLDER_TITLE, location: "  ", startAt: "2026-11-01T00:00:00Z" }, NOW);
  assert.equal(all.length, 3);
  assert.match(all.join(" "), /name/);
  assert.match(all.join(" "), /venue/);
  assert.match(all.join(" "), /already passed/);
  assert.match(publishProblems({ title: "Ok name", location: "x", startAt: null }, NOW)[0], /date/);
  // started earlier today but not over yet: still publishable; over: not
  assert.deepEqual(publishProblems({ title: "Ok name", location: "x", startAt: "2026-11-04T23:00:00Z", endAt: "2026-11-05T02:00:00Z" }, NOW), []);
  assert.match(publishProblems({ title: "Ok name", location: "x", startAt: "2026-11-04T20:00:00Z", endAt: "2026-11-04T22:00:00Z" }, NOW)[0], /already passed/);
  assert.match(publishProblems({ title: "Ok name", location: "x", startAt: future, endAt: "2026-12-01T08:00:00Z" }, NOW)[0], /end time/);
  assert.match(
    publishProblems({ title: "Ok name", location: "x", startAt: future, registrationOpensAt: "2026-11-20T00:00:00Z", registrationClosesAt: "2026-11-10T00:00:00Z" }, NOW)[0],
    /close before it opens/,
  );
});

test("only a draft or a rejected session can be published", () => {
  assert.equal(publishStatusProblem("draft"), null);
  assert.equal(publishStatusProblem("rejected"), null);
  for (const s of ["published", "pending_review", "live", "completed", "cancelled", "archived"]) {
    assert.match(publishStatusProblem(s)!, new RegExp(`already ${s}`));
  }
});

test("null clears only the listed optional fields and leaves the rest of the body alone", () => {
  const { rest, clears } = splitNullClears({ title: "A name", location: null, endAt: null, maxParticipants: null, price: 0, status: null });
  assert.deepEqual(clears, { location: null, endAt: null, maxParticipants: null });
  assert.deepEqual(rest, { title: "A name", price: 0, status: null }); // a null on anything else goes to the normal validator
  assert.ok((CLEARABLE_SESSION_FIELDS as readonly string[]).includes("coverImage"));
  assert.ok(!(CLEARABLE_SESSION_FIELDS as readonly string[]).includes("title"));
  assert.deepEqual(splitNullClears({}), { rest: {}, clears: {} });
});

test("expectedUpdatedAt: absent keeps old callers working, garbage is invalid", () => {
  assert.deepEqual(readExpectedUpdatedAt(undefined), { kind: "absent" });
  assert.deepEqual(readExpectedUpdatedAt(null), { kind: "absent" });
  assert.equal(readExpectedUpdatedAt("nope").kind, "invalid");
  assert.equal(readExpectedUpdatedAt(42).kind, "invalid");
  const ok = readExpectedUpdatedAt("2026-11-05T01:02:03.456Z");
  assert.equal(ok.kind, "ok");
  if (ok.kind === "ok") assert.equal(ok.at.toISOString(), "2026-11-05T01:02:03.456Z");
});
