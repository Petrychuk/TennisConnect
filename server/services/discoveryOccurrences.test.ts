// npx tsx server/services/discoveryOccurrences.test.ts

import assert from "node:assert/strict";
import {
  parseRecurrenceText,
  generateOccurrenceDates,
  expandOccurrences,
  hasOccurrenceEnded,
  todayInZone,
  makeOccurrenceId,
  parseOccurrenceId,
  isValidYmd,
  toLocalDateTime,
  isActivityFinished,
} from "./discoveryOccurrences";

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

console.log("discoveryOccurrences.ts");

// 2026-10-01 is a Thursday.

// --- parseRecurrenceText ---

test("'every Thursday 7-9pm' is weekly on Thursday and understood", () => {
  const r = parseRecurrenceText("every Thursday 7-9pm");
  assert.deepEqual(r, { frequency: "WEEKLY", dayOfWeek: "THURSDAY", understood: true });
});

test("a plural day ('Saturdays') means weekly", () => {
  assert.deepEqual(parseRecurrenceText("Saturdays 9am"), { frequency: "WEEKLY", dayOfWeek: "SATURDAY", understood: true });
});

test("abbreviated days are understood ('Tues', 'Thurs', 'Sun')", () => {
  assert.equal(parseRecurrenceText("every Tues")?.dayOfWeek, "TUESDAY");
  assert.equal(parseRecurrenceText("every Thurs night")?.dayOfWeek, "THURSDAY");
  assert.equal(parseRecurrenceText("every Sun")?.dayOfWeek, "SUNDAY");
});

test("'fortnightly on Sundays' is fortnightly", () => {
  const r = parseRecurrenceText("fortnightly on Sundays");
  assert.equal(r?.frequency, "FORTNIGHTLY");
  assert.equal(r?.dayOfWeek, "SUNDAY");
});

test("two named days can't be a single day-of-week, so it's NOT understood (goes to a human)", () => {
  const r = parseRecurrenceText("every Tuesday and Thursday");
  assert.equal(r?.dayOfWeek, null);
  assert.equal(r?.understood, false);
});

test("monthly patterns are never treated as understood in V1", () => {
  const r = parseRecurrenceText("first Saturday of every month");
  assert.equal(r?.frequency, "MONTHLY");
  assert.equal(r?.understood, false);
});

test("no recurrence text means a one-off (null), and words like 'sunny' or 'month' don't fake a day", () => {
  assert.equal(parseRecurrenceText(null), null);
  assert.equal(parseRecurrenceText("  "), null);
  assert.equal(parseRecurrenceText("weekly, weather permitting, sunny courts")?.dayOfWeek, null);
});

// --- generateOccurrenceDates ---

test("weekly Thursday from a Thursday includes that Thursday, then every 7 days within the horizon", () => {
  const dates = generateOccurrenceDates({ frequency: "WEEKLY", dayOfWeek: "THURSDAY", fromDate: "2026-10-01", horizonDays: 28 });
  assert.deepEqual(dates, ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"]);
});

test("weekly Saturday from a Thursday starts on the coming Saturday", () => {
  const dates = generateOccurrenceDates({ frequency: "WEEKLY", dayOfWeek: "SATURDAY", fromDate: "2026-10-01", horizonDays: 14 });
  assert.deepEqual(dates, ["2026-10-03", "2026-10-10"]);
});

test("a season start date in the future is a lower bound", () => {
  const dates = generateOccurrenceDates({
    frequency: "WEEKLY", dayOfWeek: "THURSDAY", anchorDate: "2026-10-15", fromDate: "2026-10-01", horizonDays: 28,
  });
  assert.equal(dates[0], "2026-10-15");
});

test("an end date stops the series", () => {
  const dates = generateOccurrenceDates({
    frequency: "WEEKLY", dayOfWeek: "THURSDAY", endDate: "2026-10-09", fromDate: "2026-10-01", horizonDays: 28,
  });
  assert.deepEqual(dates, ["2026-10-01", "2026-10-08"]);
});

test("maxCount caps how many occurrences are generated", () => {
  const dates = generateOccurrenceDates({
    frequency: "WEEKLY", dayOfWeek: "THURSDAY", fromDate: "2026-10-01", horizonDays: 365, maxCount: 3,
  });
  assert.equal(dates.length, 3);
});

test("fortnightly counts from the anchor - the 'on' weeks only", () => {
  const dates = generateOccurrenceDates({
    frequency: "FORTNIGHTLY", dayOfWeek: "SUNDAY", anchorDate: "2026-09-27", fromDate: "2026-10-01", horizonDays: 28,
  });
  // 27 Sep is a Sunday; the fortnightly Sundays are 27 Sep, 11 Oct, 25 Oct, 8 Nov.
  assert.deepEqual(dates, ["2026-10-11", "2026-10-25"]);
});

test("fortnightly with no anchor produces nothing - we can't know which week is the 'on' week", () => {
  assert.deepEqual(
    generateOccurrenceDates({ frequency: "FORTNIGHTLY", dayOfWeek: "SUNDAY", fromDate: "2026-10-01", horizonDays: 28 }),
    []
  );
});

test("fortnightly whose anchor isn't on the named weekday is inconsistent data - produces nothing", () => {
  assert.deepEqual(
    generateOccurrenceDates({ frequency: "FORTNIGHTLY", dayOfWeek: "SUNDAY", anchorDate: "2026-09-28", fromDate: "2026-10-01", horizonDays: 28 }),
    []
  );
});

test("monthly and day-less patterns never invent dates", () => {
  assert.deepEqual(generateOccurrenceDates({ frequency: "MONTHLY", dayOfWeek: "SATURDAY", fromDate: "2026-10-01", horizonDays: 60 }), []);
  assert.deepEqual(generateOccurrenceDates({ frequency: "WEEKLY", dayOfWeek: null, fromDate: "2026-10-01", horizonDays: 60 }), []);
});

test("date arithmetic crosses month and year boundaries correctly", () => {
  const dates = generateOccurrenceDates({ frequency: "WEEKLY", dayOfWeek: "THURSDAY", fromDate: "2026-12-24", horizonDays: 14 });
  assert.deepEqual(dates, ["2026-12-24", "2026-12-31", "2027-01-07"]);
});

// --- hasOccurrenceEnded ---

test("an event with an end time has ended once that time passes in ITS time zone", () => {
  // 2026-07-01 21:00 Sydney (UTC+10) = 11:00Z
  const base = { date: "2026-07-01", startTime: "19:00", endTime: "21:00", timeZone: "Australia/Sydney" };
  assert.equal(hasOccurrenceEnded({ ...base, now: new Date("2026-07-01T10:30:00Z") }), false);
  assert.equal(hasOccurrenceEnded({ ...base, now: new Date("2026-07-01T11:30:00Z") }), true);
});

test("no end time: assumed to run 3 hours from the start", () => {
  const base = { date: "2026-07-01", startTime: "19:00", endTime: null, timeZone: "Australia/Sydney" };
  // start 09:00Z, +3h = 12:00Z
  assert.equal(hasOccurrenceEnded({ ...base, now: new Date("2026-07-01T11:30:00Z") }), false);
  assert.equal(hasOccurrenceEnded({ ...base, now: new Date("2026-07-01T12:30:00Z") }), true);
});

test("no times at all: lasts until the end of that calendar day (doesn't vanish at midnight-start)", () => {
  const base = { date: "2026-07-01", startTime: null, endTime: null, timeZone: "Australia/Sydney" };
  assert.equal(hasOccurrenceEnded({ ...base, now: new Date("2026-07-01T03:00:00Z") }), false); // 1pm Sydney
  assert.equal(hasOccurrenceEnded({ ...base, now: new Date("2026-07-01T15:00:00Z") }), true); // 1am next day
});

// --- expandOccurrences ---

const NOW = new Date("2026-10-01T02:00:00Z"); // Thu 1 Oct, 1pm Sydney (AEDT)

test("a recurring activity expands to its upcoming dates", () => {
  const dates = expandOccurrences(
    { recurrenceFrequency: "WEEKLY", recurrenceDayOfWeek: "THURSDAY", startDate: null, endDate: null, startTime: "19:00", endTime: "21:00", timeZone: "Australia/Sydney" },
    NOW
  );
  assert.equal(dates[0], "2026-10-01"); // tonight's session hasn't ended yet
  assert.ok(dates.length >= 4);
});

test("a recurring session whose time today has already passed starts from next week", () => {
  const evening = new Date("2026-10-01T13:00:00Z"); // 12am Fri Sydney - Thursday's 7-9pm is over
  const dates = expandOccurrences(
    { recurrenceFrequency: "WEEKLY", recurrenceDayOfWeek: "THURSDAY", startDate: null, endDate: null, startTime: "19:00", endTime: "21:00", timeZone: "Australia/Sydney" },
    evening
  );
  assert.equal(dates[0], "2026-10-08");
});

test("a future one-off is a single date; a past one-off is none", () => {
  const base = { recurrenceFrequency: null, recurrenceDayOfWeek: null, endDate: null, startTime: "10:00", endTime: "12:00", timeZone: "Australia/Sydney" };
  assert.deepEqual(expandOccurrences({ ...base, startDate: "2026-10-10" }, NOW), ["2026-10-10"]);
  assert.deepEqual(expandOccurrences({ ...base, startDate: "2026-09-01" }, NOW), []);
});

test("a multi-day one-off stays visible until its last day ends", () => {
  const dates = expandOccurrences(
    { recurrenceFrequency: null, recurrenceDayOfWeek: null, startDate: "2026-09-30", endDate: "2026-10-02", startTime: "09:00", endTime: "17:00", timeZone: "Australia/Sydney" },
    NOW
  );
  assert.deepEqual(dates, ["2026-09-30"]);
});

test("a one-off with no date at all can't be placed, so it yields nothing", () => {
  assert.deepEqual(
    expandOccurrences({ recurrenceFrequency: null, recurrenceDayOfWeek: null, startDate: null, endDate: null, startTime: null, endTime: null, timeZone: "Australia/Sydney" }, NOW),
    []
  );
});

// --- helpers ---

test("'today' is decided in the venue's own zone", () => {
  const instant = new Date("2026-10-01T15:00:00Z"); // 1 Oct 15:00Z
  assert.equal(todayInZone(instant, "Australia/Sydney"), "2026-10-02"); // 2am next day
  assert.equal(todayInZone(instant, "Australia/Perth"), "2026-10-01"); // 11pm same day
});

test("occurrence ids round-trip, and a plain id has no date", () => {
  const id = makeOccurrenceId("3f2a9c1e-aaaa-bbbb-cccc-1234567890ab", "2026-10-08");
  assert.deepEqual(parseOccurrenceId(id), { baseId: "3f2a9c1e-aaaa-bbbb-cccc-1234567890ab", date: "2026-10-08" });
  assert.deepEqual(parseOccurrenceId("3f2a9c1e-aaaa-bbbb-cccc-1234567890ab"), { baseId: "3f2a9c1e-aaaa-bbbb-cccc-1234567890ab", date: null });
});

test("impossible calendar dates are rejected", () => {
  assert.equal(isValidYmd("2026-02-31"), false);
  assert.equal(isValidYmd("2026-10-01"), true);
  assert.equal(isValidYmd(null), false);
});

test("a UTC instant is converted to the venue's LOCAL date and time (a 9am Sydney session is the previous UTC day)", () => {
  // 2026-07-01 09:00 Sydney (AEST, UTC+10) = 2026-06-30T23:00:00Z
  assert.deepEqual(toLocalDateTime(new Date("2026-06-30T23:00:00Z"), "Australia/Sydney"), { date: "2026-07-01", time: "09:00" });
});

test("local midnight is 00:00, not 24:00", () => {
  // 2026-07-01 00:00 Sydney = 2026-06-30T14:00:00Z
  assert.equal(toLocalDateTime(new Date("2026-06-30T14:00:00Z"), "Australia/Sydney").time, "00:00");
});

test("a one-off is finished once its last day has ended; a recurring series only once its end date passes", () => {
  const now = new Date("2026-10-01T02:00:00Z");
  const oneOff = { recurrenceFrequency: null, recurrenceDayOfWeek: null, endDate: null, startTime: "10:00", endTime: "12:00", timeZone: "Australia/Sydney" };
  assert.equal(isActivityFinished({ ...oneOff, startDate: "2026-09-20" }, now), true);
  assert.equal(isActivityFinished({ ...oneOff, startDate: "2026-10-20" }, now), false);
  const series = { recurrenceFrequency: "WEEKLY", recurrenceDayOfWeek: "THURSDAY", startDate: null, startTime: null, endTime: null, timeZone: "Australia/Sydney" };
  assert.equal(isActivityFinished({ ...series, endDate: null }, now), false); // open-ended
  assert.equal(isActivityFinished({ ...series, endDate: "2026-06-30" }, now), true);
  assert.equal(isActivityFinished({ ...series, endDate: "2026-12-01" }, now), false);
});

test("an activity with no usable date is never declared finished (it needs a human, not an automatic expiry)", () => {
  const now = new Date("2026-10-01T02:00:00Z");
  assert.equal(
    isActivityFinished({ recurrenceFrequency: null, recurrenceDayOfWeek: null, startDate: null, endDate: null, startTime: null, endTime: null, timeZone: null }, now),
    false
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
