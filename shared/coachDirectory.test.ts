import assert from "node:assert/strict";
import test from "node:test";
import {
  ANY_PRICE, coachMatches, directoryLocations, matchesMaxRate, pageOfCoaches, parseCoachDirectoryQuery, parseHourlyRate,
  type CoachDirectoryEntry,
} from "./coachDirectory";

const coach = (name: string, location: string, rate: string | null, title = "Tennis Coach"): CoachDirectoryEntry => ({
  name, title, location, rate: parseHourlyRate(rate),
});

// 40 coaches: the seed's "$60/hr".."$100/hr", plus ones with no number in the rate.
const ALL: CoachDirectoryEntry[] = Array.from({ length: 40 }, (_, i) =>
  coach(`Coach ${String(i + 1).padStart(2, "0")}`, ["Sydney", "Brisbane", "Perth", "Adelaide"][i % 4], i % 10 === 9 ? "On request" : `$${60 + (i % 5) * 10}/hr`),
);
const NO_FILTER = parseCoachDirectoryQuery({});

test("free-text rates are read as their first number", () => {
  for (const [input, expected] of [["80", 80], ["$80", 80], ["$80/hr", 80], ["AUD 70-90", 70], ["$1,200", 1200], [90, 90]] as const) {
    assert.equal(parseHourlyRate(input), expected, String(input));
  }
  for (const input of ["", "On request", null, undefined, Number.NaN]) assert.equal(parseHourlyRate(input), null, String(input));
});

test("price filter: no limit keeps everyone, a limit keeps known rates within it", () => {
  assert.equal(matchesMaxRate(null, ANY_PRICE), true);
  assert.equal(matchesMaxRate(200, ANY_PRICE), true);
  assert.equal(matchesMaxRate(80, 100), true);
  assert.equal(matchesMaxRate(120, 100), false);
  assert.equal(matchesMaxRate(null, 100), false);
});

test("no filters: every coach is listed, across pages, none twice", () => {
  const seen = new Set<string>();
  const first = pageOfCoaches(ALL, NO_FILTER, 1, 16);
  assert.equal(first.pagination.total, 40);
  assert.equal(first.pagination.totalPages, 3);
  for (let p = 1; p <= 3; p++) for (const c of pageOfCoaches(ALL, NO_FILTER, p, 16).coaches) seen.add(c.name);
  assert.equal(seen.size, 40, "all 40 coaches reachable, including the 'On request' ones");
});

test("filters apply to the whole directory, not just one page", () => {
  // Coach 37 is on page 3 unfiltered; searching finds it on page 1.
  const found = pageOfCoaches(ALL, parseCoachDirectoryQuery({ q: "coach 37" }), 1, 16);
  assert.deepEqual(found.coaches.map((c) => c.name), ["Coach 37"]);
  const perth = pageOfCoaches(ALL, parseCoachDirectoryQuery({ location: "Perth" }), 1, 16);
  assert.equal(perth.pagination.total, 10);
  assert.ok(perth.coaches.every((c) => c.location === "Perth"));
  const cheap = pageOfCoaches(ALL, parseCoachDirectoryQuery({ maxRate: "70" }), 1, 100);
  assert.ok(cheap.coaches.every((c) => c.rate !== null && c.rate <= 70));
  assert.equal(cheap.pagination.total, ALL.filter((c) => c.rate !== null && c.rate <= 70).length);
  const combined = pageOfCoaches(ALL, parseCoachDirectoryQuery({ location: "Sydney", maxRate: "60" }), 1, 100);
  assert.ok(combined.coaches.every((c) => c.location === "Sydney" && c.rate === 60));
});

test("search matches name, title and location, case-insensitively", () => {
  const c = coach("Jordan Ellis", "Wolli Creek", "$80/hr", "Head Coach");
  for (const q of ["jordan", "HEAD", "wolli"]) assert.equal(coachMatches(c, parseCoachDirectoryQuery({ q })), true, q);
  assert.equal(coachMatches(c, parseCoachDirectoryQuery({ q: "zzz-no-such-thing-zzz" })), false);
});

test("junk query values fall back to no filter; a page past the end shows the last page", () => {
  assert.deepEqual(parseCoachDirectoryQuery({ q: ["x"], location: "all", maxRate: "abc" }), NO_FILTER);
  assert.equal(pageOfCoaches(ALL, NO_FILTER, 99, 16).pagination.page, 3);
  assert.equal(pageOfCoaches([], NO_FILTER, 1, 16).pagination.totalPages, 0);
});

test("location options come from the whole directory", () => {
  assert.deepEqual(directoryLocations(ALL), ["Adelaide", "Brisbane", "Perth", "Sydney"]);
});
