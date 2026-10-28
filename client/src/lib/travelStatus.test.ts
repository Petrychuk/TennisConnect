// npx tsx --test client/src/lib/travelStatus.test.ts   (part of npm run test:travel-status)

import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDateIn,
  isRetreatArchived,
  retreatLastDay,
  retreatLengthDays,
  retreatStartDay,
  sortRetreatsForDisplay,
} from "./travelStatus";

// Instants given in UTC; the comments say what the Sydney wall clock reads.
const at = (iso: string) => new Date(iso);

test("duration -> calendar days", () => {
  assert.equal(retreatLengthDays("7 days"), 7);
  assert.equal(retreatLengthDays("1 Day"), 1);
  assert.equal(retreatLengthDays("5 nights"), 6);
  assert.equal(retreatLengthDays("2 weeks"), 14);
  assert.equal(retreatLengthDays("7 days / 6 nights"), 7);
  assert.equal(retreatLengthDays("Weekend"), 1);
  assert.equal(retreatLengthDays(""), 1);
  assert.equal(retreatLengthDays(undefined), 1);
});

test("start day: date-only taken as written, timestamps converted to Sydney, junk -> null", () => {
  assert.equal(retreatStartDay("2026-11-15"), "2026-11-15");
  assert.equal(retreatStartDay(" 2026-11-15 "), "2026-11-15");
  // 14:00 UTC on the 14th is already 01:00 on the 15th in Sydney (AEDT, UTC+11).
  assert.equal(retreatStartDay("2026-11-14T14:00:00Z"), "2026-11-15");
  assert.equal(retreatStartDay("2026-02-30"), null);
  assert.equal(retreatStartDay("TBA"), null);
  assert.equal(retreatStartDay(null), null);
  assert.equal(retreatStartDay(""), null);
});

test("last day spans months and years", () => {
  assert.equal(retreatLastDay({ startDate: "2026-11-15", duration: "7 days" }), "2026-11-21");
  assert.equal(retreatLastDay({ startDate: "2026-12-28", duration: "7 days" }), "2027-01-03");
  assert.equal(retreatLastDay({ startDate: "2028-02-27", duration: "3 days" }), "2028-02-29");
  assert.equal(retreatLastDay({ startDate: null, duration: "7 days" }), null);
});

test("archived exactly from 00:00 Sydney the day after the last day", () => {
  const pkg = { startDate: "2026-11-15", duration: "7 days" }; // runs 15-21 Nov
  // 21 Nov 23:59 Sydney (AEDT) = 21 Nov 12:59 UTC -> still running
  assert.equal(isRetreatArchived(pkg, at("2026-11-21T12:59:00Z")), false);
  // 22 Nov 00:00 Sydney = 21 Nov 13:00 UTC -> ended
  assert.equal(isRetreatArchived(pkg, at("2026-11-21T13:00:00Z")), true);
  // The old estimate (UTC-midnight start + N days) only flipped at 11:00 Sydney on the 22nd.
  assert.equal(isRetreatArchived(pkg, at("2026-11-21T20:00:00Z")), true);
});

test("the boundary follows Sydney daylight saving (AEST, UTC+10)", () => {
  const pkg = { startDate: "2026-06-01", duration: "1 day" }; // just 1 June
  assert.equal(isRetreatArchived(pkg, at("2026-06-01T13:59:00Z")), false); // 23:59 Sydney
  assert.equal(isRetreatArchived(pkg, at("2026-06-01T14:00:00Z")), true); // 00:00 Sydney, 2 June
});

test("not archived before or during the retreat; undated = upcoming; inactive = archived", () => {
  const now = at("2026-11-17T01:00:00Z"); // 17 Nov, 12:00 Sydney
  assert.equal(isRetreatArchived({ startDate: "2026-12-01", duration: "5 days" }, now), false);
  assert.equal(isRetreatArchived({ startDate: "2026-11-15", duration: "7 days" }, now), false);
  assert.equal(isRetreatArchived({ startDate: null, duration: "7 days" }, now), false);
  assert.equal(isRetreatArchived({ startDate: "2027-01-01", duration: "7 days", isActive: false }, now), true);
});

test("display order: upcoming (soonest first, TBA last) before archived (latest ended first)", () => {
  const now = at("2026-11-17T01:00:00Z"); // 17 Nov 2026, Sydney
  const items = [
    { id: "past-old", startDate: "2025-03-01", duration: "7 days" },
    { id: "tba", startDate: null, duration: "7 days" },
    { id: "past-recent", startDate: "2026-10-01", duration: "5 days" },
    { id: "later", startDate: "2027-02-10", duration: "7 days" },
    { id: "running", startDate: "2026-11-15", duration: "7 days" },
    { id: "soon", startDate: "2026-12-01", duration: "3 days" },
  ];
  assert.deepEqual(
    sortRetreatsForDisplay(items, now).map((i) => i.id),
    ["running", "soon", "later", "tba", "past-recent", "past-old"],
  );
});

test("a past retreat never takes the first slot while an upcoming one exists - even when the API lists it first", () => {
  const now = at("2026-11-17T01:00:00Z");
  const apiOrder = [
    { id: "past", startDate: "2026-09-01", duration: "7 days", isFeatured: true },
    { id: "upcoming", startDate: "2027-01-10", duration: "7 days" },
  ];
  assert.equal(sortRetreatsForDisplay(apiOrder, now)[0].id, "upcoming");
  // The home section shows the first three after sorting.
  assert.deepEqual(sortRetreatsForDisplay(apiOrder, now).slice(0, 3).map((i) => i.id), ["upcoming", "past"]);
});

test("past-only and empty lists", () => {
  const now = at("2026-11-17T01:00:00Z");
  const pastOnly = [
    { id: "a", startDate: "2026-01-05", duration: "3 days" },
    { id: "b", startDate: "2026-08-05", duration: "3 days" },
  ];
  const sorted = sortRetreatsForDisplay(pastOnly, now);
  assert.deepEqual(sorted.map((i) => i.id), ["b", "a"]);
  assert.ok(sorted.every((i) => isRetreatArchived(i, now)));
  assert.deepEqual(sortRetreatsForDisplay([], now), []);
});

test("stable for equal dates and does not mutate the input", () => {
  const now = at("2026-11-17T01:00:00Z");
  const items = [
    { id: "x", startDate: "2027-01-01", duration: "7 days" },
    { id: "y", startDate: "2027-01-01", duration: "7 days" },
  ];
  const copy = items.map((i) => i.id);
  assert.deepEqual(sortRetreatsForDisplay(items, now).map((i) => i.id), ["x", "y"]);
  assert.deepEqual(items.map((i) => i.id), copy);
});

test("calendarDateIn names the Sydney date regardless of the machine's own timezone", () => {
  assert.equal(calendarDateIn(at("2026-11-21T13:00:00Z")), "2026-11-22");
  assert.equal(calendarDateIn(at("2026-11-21T13:00:00Z"), "UTC"), "2026-11-21");
});
