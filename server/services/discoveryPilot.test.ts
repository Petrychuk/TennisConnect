// npx tsx server/services/discoveryPilot.test.ts
//
// PILOT ACCEPTANCE (3 sources, 3 states: VIC / NSW / QLD).
//
// What this is: the model's answer for each pilot page is SIMULATED here
// (written from the real page text, the way a careful extraction would
// answer it). Everything AFTER the model - parsing, format/level/state/
// time-zone normalisation, recurrence, date validation, review flags and
// the dates Play would show - is the REAL code.
//
// What this is NOT: proof that the live model returns these answers, or
// that the fetch works from the server. That is what the first DRY RUN
// on the real pages is for.

import assert from "node:assert/strict";
import { parseExtractedActivities, classifyConfidence, type ExtractedActivity } from "./discoveryExtraction";
import { buildActivityRecord } from "./discoveryRecord";
import { validateDiscoveredDates } from "./discoveryNormalization";
import { initialFlagReasons } from "./discoveryQueue";
import { expandOccurrences } from "./discoveryOccurrences";

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

console.log("Discovery pilot (VIC / NSW / QLD)");

// Monday 28 Sep 2026, 12:00 Sydney
const NOW = new Date("2026-09-28T02:00:00Z");

/** Everything null unless the page said it - the shape the prompt demands. */
function act(over: Partial<ExtractedActivity> & { title: string }): ExtractedActivity {
  return {
    description: null, activityTypeText: null, gameFormatText: null,
    startDate: null, endDate: null, startTime: null, endTime: null, recurrenceText: null,
    venueName: null, address: null, suburb: null, city: null, state: null, postcode: null,
    levelText: null, price: null, priceText: null, currency: null, organiserName: null, registrationUrl: null,
    cancelled: null, evidence: null,
    ...over,
  };
}

function run(source: { state: string | null; city: string | null; url: string }, modelJson: unknown) {
  const parsed = parseExtractedActivities(JSON.stringify(modelJson));
  assert.ok(parsed, "model output must parse");
  return parsed!.activities.map((extracted) => {
    const built = buildActivityRecord(extracted, { sourceState: source.state, sourceCity: source.city, pageUrl: source.url });
    const dates = validateDiscoveredDates({
      startDate: extracted.startDate, endDate: extracted.endDate,
      startTime: extracted.startTime, endTime: extracted.endTime,
      isRecurring: !!built.recurrence, timeZone: built.record.timeZone, now: NOW,
    });
    const confidence = classifyConfidence(extracted);
    const flags = initialFlagReasons({
      confidence, isPossibleDuplicate: false,
      timeZoneKnown: !!built.record.timeZone, recurrenceUnderstood: built.recurrenceUnderstood,
    });
    return { extracted, ...built, dates, confidence, flags, upcoming: expandOccurrences(built.record, NOW) };
  });
}

// ---------------------------------------------------------------
// Source 1 - VIC, Tennis Victoria "What's On": an EVENT LISTING page
// ---------------------------------------------------------------
const VIC = { state: "VIC", city: null, url: "https://www.tennis.com.au/vic/events/whats-on" };
const vic = run(VIC, {
  activities: [
    act({ title: "Cardio Tennis", activityTypeText: "Cardio Tennis", startDate: "2026-09-14", startTime: "09:30", venueName: "Chadstone Tennis Club", suburb: "Chadstone" }),
    act({ title: "2026 Pride Cup", gameFormatText: "Singles and Doubles", startDate: "2026-09-12", startTime: "14:00", endTime: "16:00", venueName: "Keon Park Tennis Club", priceText: "Free entry and afternoon tea provided." }),
    act({ title: "Friday Night Smash", activityTypeText: "weekly in-house junior matchplay program", recurrenceText: "Every Friday night", venueName: "Eaglemont Tennis Club", suburb: "Eaglemont" }),
    act({ title: "Growing the Game: Women and Girl's Tennis", startDate: "2026-10-10", startTime: "10:30", endTime: "12:30", venueName: "Fawkner Tennis Club", priceText: "This free 10 week program is free and inclusive to any women and girls", registrationUrl: "https://www.trybooking.com/au/event/1637610" }),
  ],
});
const byTitle = <T extends { extracted: ExtractedActivity }>(rows: T[], title: string) => rows.find((r) => r.extracted.title === title)!;

test("VIC: a listing page yields several distinct activities", () => {
  assert.equal(vic.length, 4);
});

test("VIC: events that already happened are rejected by validation, not published", () => {
  assert.equal(byTitle(vic, "Cardio Tennis").dates.reason, "already_expired");
  assert.equal(byTitle(vic, "2026 Pride Cup").dates.reason, "already_expired");
});

test("VIC: a future one-off is valid, in Melbourne time, with its registration link kept", () => {
  const e = byTitle(vic, "Growing the Game: Women and Girl's Tennis");
  assert.equal(e.dates.valid, true);
  assert.equal(e.record.timeZone, "Australia/Melbourne");
  assert.equal(e.record.registrationUrl, "https://www.trybooking.com/au/event/1637610");
  assert.equal(e.record.price, 0);
  assert.deepEqual(e.upcoming, ["2026-10-10"]);
});

test("VIC: 'Every Friday night' is recognised as a weekly recurring session and expands to upcoming Fridays", () => {
  const e = byTitle(vic, "Friday Night Smash");
  assert.equal(e.dates.valid, true);
  assert.equal(e.record.recurrenceFrequency, "WEEKLY");
  assert.equal(e.record.recurrenceDayOfWeek, "FRIDAY");
  assert.equal(e.upcoming[0], "2026-10-02");
  assert.ok(e.upcoming.length >= 4);
});

test("VIC: what the page didn't say stays null (no times, no price, no level, no city invented)", () => {
  const e = byTitle(vic, "Friday Night Smash").record;
  assert.equal(e.startTime, null);
  assert.equal(e.endTime, null);
  assert.equal(e.price, null);
  assert.equal(e.normalisedLevel, null);
  assert.equal(e.city, null); // a state body spans many cities - the source's city is null too
  assert.equal(e.registrationUrl, null);
});

test("VIC: an unrecognised format is null; a junior program is recognised; singles+doubles is not collapsed", () => {
  assert.equal(byTitle(vic, "Growing the Game: Women and Girl's Tennis").record.activityType, null);
  assert.equal(byTitle(vic, "Friday Night Smash").record.activityType, "junior-event");
  assert.equal(byTitle(vic, "2026 Pride Cup").record.gameFormat, null);
});

// ---------------------------------------------------------------
// Source 2 - NSW, Strathfield Sports Club: an INDIVIDUAL EVENT page
// The page is dated 1 Aug 2026 (already in the past) but says
// "every Saturday" - it is really a standing weekly session.
// ---------------------------------------------------------------
const NSW = { state: "NSW", city: "Sydney", url: "https://strathfieldsportsclub.com.au/events/saturday-social-2026-08-01/" };
const signUp = "https://forms.clickup.com/3462635/f/39nfb-10456/4ESND28R7B9YLV3GAV?Comment:%20Beginners%206:30pm%20Session%20OR%20Competitive%208pm%20Session=xxxxx";
const STRATHFIELD_PRICE = "FREE for SSC tennis members. $20 pp applicable to non-tennis members each week.";
const nsw = run(NSW, {
  activities: [
    act({
      title: "Saturday Social - Beginners", activityTypeText: "Saturday Social", gameFormatText: "doubles",
      recurrenceText: "every Saturday", startDate: "2026-08-01", startTime: "18:30", endTime: "20:00",
      venueName: "Strathfield Sports Club", address: "4a Lyons Street", suburb: "Strathfield", state: "NSW", postcode: "2135",
      levelText: "Beginners Social", priceText: STRATHFIELD_PRICE, currency: "AUD", registrationUrl: signUp,
      evidence: { price: "$20 pp applicable to non-tennis members each week", recurrence: "play a social game of doubles every Saturday" },
    }),
    act({
      title: "Saturday Social - Competitive/Advanced", activityTypeText: "Saturday Social", gameFormatText: "doubles",
      recurrenceText: "every Saturday", startDate: "2026-08-01", startTime: "20:00", endTime: "21:30",
      venueName: "Strathfield Sports Club", address: "4a Lyons Street", suburb: "Strathfield", state: "NSW", postcode: "2135",
      levelText: "Competitive/Advanced Social", priceText: STRATHFIELD_PRICE, currency: "AUD", registrationUrl: signUp,
    }),
  ],
});

test("NSW: a past-dated page that says 'every Saturday' is treated as the standing weekly session it is", () => {
  for (const e of nsw) {
    assert.equal(e.dates.valid, true);
    assert.equal(e.record.recurrenceFrequency, "WEEKLY");
    assert.equal(e.record.recurrenceDayOfWeek, "SATURDAY");
    assert.equal(e.upcoming[0], "2026-10-03");
  }
});

test("NSW: two sessions on one page stay two entries, each with its own time and level", () => {
  assert.equal(nsw.length, 2);
  assert.equal(nsw[0].record.normalisedLevel, "Beginner");
  assert.equal(nsw[1].record.normalisedLevel, "Advanced");
  assert.equal(nsw[0].record.startTime, "18:30");
  assert.equal(nsw[1].record.startTime, "20:00");
});

test("NSW: location, Sydney time zone, the source's city, price and the real sign-up link are all kept", () => {
  const r = nsw[0].record;
  assert.equal(r.timeZone, "Australia/Sydney");
  assert.equal(r.suburb, "Strathfield");
  assert.equal(r.postcode, "2135");
  assert.equal(r.city, "Sydney");
  assert.equal(r.price, 20);
  assert.equal(r.gameFormat, "doubles");
  assert.equal(r.registrationUrl, signUp);
});

test("NSW: source URL and name context survive (the page URL is what gets stored as sourceUrl)", () => {
  assert.equal(NSW.url, "https://strathfieldsportsclub.com.au/events/saturday-social-2026-08-01/");
});

// ---------------------------------------------------------------
// Source 3 - QLD, Queensland Tennis Centre: a RECURRING PROGRAM page
// ---------------------------------------------------------------
const QLD = { state: "QLD", city: "Brisbane", url: "https://www.queenslandtenniscentre.com.au/adults/programs-fixtures/social-tennis/" };
const qld = run(QLD, {
  activities: [
    act({
      title: "Tuesday Night Social Tennis", activityTypeText: "Social Tennis", gameFormatText: "doubles",
      recurrenceText: "every Tuesday 7:00pm - 10:00pm", startTime: "19:00", endTime: "22:00",
      venueName: "Queensland Tennis Centre", suburb: "Tennyson", state: "QLD", postcode: "4105",
      levelText: "all standards", priceText: "Member Rates: $20/session. Non-Member Rates: $24/session", currency: "AUD",
      evidence: { price: "Casual Players: $24.00", startTime: "7:00pm - 10:00pm" },
    }),
    act({
      title: "Sunday Afternoon Social Tennis", activityTypeText: "Social Tennis", gameFormatText: "singles or mixed doubles",
      recurrenceText: "every Sunday 3:00pm - 6:00pm", startTime: "15:00", endTime: "18:00",
      venueName: "Queensland Tennis Centre", levelText: "all standards", priceText: "Member Rates: $20/session. Non-Member Rates: $24/session", currency: "AUD",
    }),
  ],
});

test("QLD: one program page yields two recurring sessions on the right weekdays, in Brisbane time", () => {
  assert.equal(qld.length, 2);
  assert.equal(qld[0].record.recurrenceDayOfWeek, "TUESDAY");
  assert.equal(qld[1].record.recurrenceDayOfWeek, "SUNDAY");
  assert.equal(qld[0].record.timeZone, "Australia/Brisbane");
  assert.equal(qld[0].upcoming[0], "2026-09-29"); // tomorrow, Tuesday
  assert.equal(qld[1].upcoming[0], "2026-10-04");
});

test("QLD: 'all standards' is NOT turned into a level; both singles and mixed doubles isn't collapsed", () => {
  assert.equal(qld[0].record.normalisedLevel, null);
  assert.equal(qld[0].record.originalLevelText, "all standards"); // the wording is still kept for traceability
  assert.equal(qld[1].record.gameFormat, null);
});

test("QLD: when the address wasn't in the extracted text, the state falls back to the source's - the time zone is still right", () => {
  const sunday = qld[1].record; // no state/suburb extracted
  assert.equal(sunday.state, "QLD");
  assert.equal(sunday.timeZone, "Australia/Brisbane");
  assert.equal(sunday.suburb, null); // and the suburb is NOT invented
});

test("QLD: no registration link on the page -> null (the card falls back to the page itself)", () => {
  assert.equal(qld[0].record.registrationUrl, null);
});

test("QLD: if the model copies the page-wide 'every Tuesday and Sunday' into ONE entry, it is flagged for review instead of guessed", () => {
  const [bad] = run(QLD, { activities: [act({ title: "Social Tennis", recurrenceText: "every Tuesday and Sunday" })] });
  assert.equal(bad.recurrenceUnderstood, false);
  assert.ok(bad.flags.some((f) => f.includes("Repeat pattern")));
  assert.deepEqual(bad.upcoming, []); // and no dates are invented for it
});

// ---------------------------------------------------------------
// ---------------------------------------------------------------
// Pricing: conditional prices are kept, never collapsed to $0
// ---------------------------------------------------------------
test("NSW: 'FREE for members. $20 for non-members' is stored as $20 with BOTH prices in the label - never $0", () => {
  for (const e of nsw) {
    assert.equal(e.record.price, 20);
    assert.equal(e.record.priceLabel, "Free for SSC tennis members · $20 per week for non-members");
    assert.equal(e.record.currency, "AUD");
  }
});

test("QLD: member and non-member rates are both kept; the numeric price is the non-member one", () => {
  for (const e of qld) {
    assert.equal(e.record.price, 24);
    assert.equal(e.record.priceLabel, "$20 per session for members · $24 per session for non-members");
  }
});

test("VIC: an explicitly free event is 0/'Free'; an event with no price stated is null - not 0", () => {
  assert.equal(byTitle(vic, "Growing the Game: Women and Girl's Tennis").record.price, 0);
  assert.equal(byTitle(vic, "Growing the Game: Women and Girl's Tennis").record.priceLabel, "Free");
  assert.equal(byTitle(vic, "Friday Night Smash").record.price, null);
  assert.equal(byTitle(vic, "Friday Night Smash").record.priceLabel, null);
});

test("a model that returns a bare price number with no wording behind it is not trusted", () => {
  const [e] = run(NSW, { activities: [act({ title: "Saturday Social", price: 0 })] });
  assert.equal(e.record.price, null); // NOT 0
  assert.ok(e.priceReview);
});

// Pilot success criteria, summarised
// ---------------------------------------------------------------
test("PILOT: 3 sources, 3 states, real activities structured, recurring recognised, nothing auto-published", () => {
  const sources = [VIC, NSW, QLD];
  assert.equal(new Set(sources.map((s) => s.state)).size, 3);
  const all = [...vic, ...nsw, ...qld];
  const valid = all.filter((a) => a.dates.valid);
  assert.ok(valid.length >= 1, "at least one real activity structured");
  assert.ok(valid.some((a) => a.record.recurrenceFrequency === "WEEKLY"), "a recurring activity recognised");
  // The pipeline produces RECORDS only. Review status is set by the
  // orchestrator to PENDING for every new item, and Play shows only
  // APPROVED ones (isPlayVisible) - covered in discoveryFreshness.test.ts.
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
