import test from "node:test";
import assert from "node:assert/strict";
import { DRAFT_PLACEHOLDER_TITLE } from "../../../shared/sessionDraft";
import { createEmptyDraft, draftToInsertSession, draftToSessionPayload, savedSessionToDraft, type NewSessionDraft } from "./organiser-session-wizard-types";

// What the server stores for a payload, as the row the list/resume read back.
function asRow(payload: Record<string, unknown>, extra: Record<string, unknown> = {}): any {
  const r: any = { id: "s-1", status: "draft", waitingListEnabled: true, ...payload, ...extra };
  for (const k of ["startAt", "endAt", "registrationOpensAt", "registrationClosesAt"]) if (payload[k]) r[k] = new Date(payload[k] as Date).toISOString();
  return r;
}

const complete = (over: Partial<NewSessionDraft> = {}): NewSessionDraft => ({
  ...createEmptyDraft(),
  type: "social",
  name: "Wednesday Social",
  venue: "Rushcutters Bay",
  date: "2026-12-02",
  startTime: "18:30",
  endTime: "20:00",
  registrationOpens: "2026-11-20",
  registrationCloses: "2026-12-02",
  maxPlayers: 16,
  courtCount: 3,
  pricing: "paid",
  price: 25,
  rulesText: "Bring water",
  ...over,
});

test("an incomplete draft is still saveable: empty or 1-character name becomes the placeholder, nothing publish-only is required", () => {
  const empty = draftToSessionPayload({ ...createEmptyDraft(), type: null }, "create");
  assert.equal(empty.title, DRAFT_PLACEHOLDER_TITLE);
  assert.ok(!("type" in empty), "a type that was never chosen is left to the row's default");
  assert.equal(draftToSessionPayload(complete({ name: "A" }), "create").title, DRAFT_PLACEHOLDER_TITLE);
  assert.equal(draftToSessionPayload(complete({ name: "  Club night  " }), "create").title, "Club night");
  assert.equal(draftToSessionPayload(complete({ venue: "" }), "create").location, undefined);
});

test("create never sends null; update sends null for every optional field the form emptied", () => {
  const cleared = complete({ venue: "", endTime: "", registrationOpens: "", registrationCloses: "", maxPlayers: 0, courtCount: 0, coverImage: null, rulesText: "", seasonId: null });
  const create = draftToSessionPayload(cleared, "create");
  // (policy columns are null for empty text - plain nullable text columns the insert schema accepts)
  const POLICY = ["rulesText", "refundPolicy", "latePolicy", "cancellationPolicy"];
  assert.deepEqual(Object.entries(create).filter(([k, v]) => v === null && !POLICY.includes(k)), []);
  const update = draftToSessionPayload(cleared, "update");
  for (const key of ["location", "endAt", "registrationOpensAt", "registrationClosesAt", "maxParticipants", "courtsCount", "coverImage", "rulesText", "seasonId"]) {
    assert.equal(update[key], null, `${key} cleared`);
  }
  assert.equal(update.title, "Wednesday Social");
});

test("coaching & fitness (no match format) clears the format columns an earlier competition draft had stored", () => {
  const update = draftToSessionPayload(complete({ type: "junior-development" as any }), "update");
  for (const key of ["matchMode", "category", "gamesTo", "plannedRoundsCount"]) assert.equal(update[key], null, key);
});

test("what is saved is what comes back when the draft is reopened (round trip)", () => {
  const draft = complete({ endDate: "2026-12-04", waitingListCapacity: null, visibility: "members", matchType: "mixed", gamesTo: 6, roundsCount: 3, noAd: false, tiebreak: false, timeZone: "Australia/Perth", seasonId: "season-1" });
  const back = savedSessionToDraft(asRow(draftToSessionPayload(draft, "create")));
  for (const key of ["type", "name", "venue", "date", "endDate", "startTime", "endTime", "registrationOpens", "registrationCloses", "maxPlayers", "courtCount", "pricing", "price", "visibility", "waitingListEnabled", "waitingListCapacity", "matchType", "category", "gamesTo", "roundsCount", "noAd", "tiebreak", "timeZone", "seasonId", "rulesText", "refundPolicy", "latePolicy", "cancellationPolicy"] as (keyof NewSessionDraft)[]) {
    assert.deepEqual(back[key], draft[key], `${key} round-trips`);
  }
});

test("a half-filled draft reopens half-filled: blanks stay blank and the placeholder name shows as empty", () => {
  const partial = { ...createEmptyDraft(), type: "social" as const, name: "", venue: "", endTime: "", registrationOpens: "", registrationCloses: "" };
  const back = savedSessionToDraft(asRow(draftToSessionPayload(partial, "create")));
  assert.equal(back.name, "");
  assert.equal(back.venue, "");
  assert.equal(back.endTime, "");
  assert.equal(back.registrationOpens, "");
  assert.equal(back.registrationCloses, "");
  assert.equal(back.date, partial.date);
});

test("a later edit that clears a field really clears it in the reopened draft", () => {
  const first = asRow(draftToSessionPayload(complete(), "create"));
  const edited = complete({ venue: "", rulesText: "" });
  // the server applies the nulls the update sends
  const row = { ...first, ...asRow(draftToSessionPayload(edited, "update")) };
  const back = savedSessionToDraft(row);
  assert.equal(back.venue, "");
  assert.equal(back.rulesText, "");
  assert.equal(back.name, "Wednesday Social");
});

test("draftToInsertSession (used by Publish checks) still reads the same draft", () => {
  assert.equal(draftToInsertSession(complete()).title, "Wednesday Social");
});
