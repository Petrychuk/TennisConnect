// Standalone unit tests - npx tsx server/services/discoveryAgent.test.ts

import assert from "node:assert/strict";
import {
  normaliseLevelText,
  normaliseFormatText,
  resolveTimeZoneForState,
  validateActivityDates,
  resolveRegistrationUrl,
  normaliseAustralianState,
  isSafeExternalUrl,
  validateDiscoveredDates,
} from "./discoveryNormalization";
import { computeDuplicateConfidence, DUPLICATE_REVIEW_THRESHOLD } from "./discoveryDuplicateDetection";
import { parseExtractedActivities, classifyConfidence, buildExtractionPrompt, type ExtractedActivity } from "./discoveryExtraction";
import { classifyQueueTab, initialDiscoveryStatus, initialFlagReasons } from "./discoveryQueue";

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

console.log("discoveryAgent (normalization + duplicate detection)");

// --- Level normalisation ---

test("plain level words map correctly", () => {
  assert.equal(normaliseLevelText("Beginner"), "Beginner");
  assert.equal(normaliseLevelText("Intermediate social players"), "Intermediate");
  assert.equal(normaliseLevelText("Advanced / competitive"), "Advanced");
  assert.equal(normaliseLevelText("Pro / elite"), "Pro");
});

test("a combined range collapses to its lower bucket, not left ambiguous", () => {
  assert.equal(normaliseLevelText("Beginner-Intermediate"), "Beginner");
  assert.equal(normaliseLevelText("Intermediate to Advanced"), "Advanced");
});

test("a UTR range or division number is NOT mapped - never invent a UTR", () => {
  assert.equal(normaliseLevelText("UTR 3-5"), null);
  assert.equal(normaliseLevelText("Division 4"), null);
});

test("missing level text returns null, not a default", () => {
  assert.equal(normaliseLevelText(null), null);
  assert.equal(normaliseLevelText(undefined), null);
  assert.equal(normaliseLevelText(""), null);
});

// --- Format normalisation ---

test("recognised activity types map to the right key", () => {
  assert.equal(normaliseFormatText("Saturday Round Robin").activityType, "round-robin");
  assert.equal(normaliseFormatText("Americano night").activityType, "americano");
  assert.equal(normaliseFormatText("Club Championship 2026").activityType, "club-championship");
  assert.equal(normaliseFormatText("Cardio Tennis class").activityType, "cardio-tennis");
});

test("game format is only set when the text actually states it", () => {
  assert.equal(normaliseFormatText("Social doubles night").gameFormat, "doubles");
  assert.equal(normaliseFormatText("Mixed doubles tournament").gameFormat, "mixed");
  assert.equal(normaliseFormatText("Singles ladder").gameFormat, "singles");
  assert.equal(normaliseFormatText("Saturday Social Tennis").gameFormat, null);
});

// --- Timezone resolution ---

test("each Australian state resolves to its own real IANA zone, not all defaulting to Sydney", () => {
  assert.equal(resolveTimeZoneForState("VIC"), "Australia/Melbourne");
  assert.equal(resolveTimeZoneForState("WA"), "Australia/Perth");
  assert.equal(resolveTimeZoneForState("TAS"), "Australia/Hobart");
  assert.equal(resolveTimeZoneForState("NT"), "Australia/Darwin");
  assert.equal(resolveTimeZoneForState("ACT"), "Australia/Sydney");
});

test("an unrecognised or missing state returns null, never a silent Sydney default", () => {
  assert.equal(resolveTimeZoneForState("XX"), null);
  assert.equal(resolveTimeZoneForState(null), null);
});

// --- Date validation ---

test("a missing start date is invalid", () => {
  const result = validateActivityDates({ startDate: null, timeZone: "Australia/Sydney" });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_start_date");
});

test("a clearly past start date is rejected as already expired", () => {
  const result = validateActivityDates({
    startDate: "2020-01-01",
    timeZone: "Australia/Sydney",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "already_expired");
});

test("a future start date with no other fields is valid", () => {
  const result = validateActivityDates({
    startDate: "2027-01-01",
    timeZone: "Australia/Sydney",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.equal(result.valid, true);
});

test("an end date before the start date is invalid", () => {
  const result = validateActivityDates({
    startDate: "2027-06-10",
    endDate: "2027-06-05",
    timeZone: "Australia/Sydney",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "end_before_start");
});

test("an end time before the start time on the same day is invalid", () => {
  const result = validateActivityDates({
    startDate: "2027-06-10",
    startTime: "19:00",
    endTime: "17:00",
    timeZone: "Australia/Sydney",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_time_range");
});

test("a multi-day event's end time can be numerically before its start time without being an error", () => {
  const result = validateActivityDates({
    startDate: "2027-06-10",
    endDate: "2027-06-12",
    startTime: "18:00",
    endTime: "14:00",
    timeZone: "Australia/Sydney",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.equal(result.valid, true);
});

// --- Duplicate detection ---

test("an exact registrationUrl match is conclusive (100) regardless of anything else", () => {
  const score = computeDuplicateConfidence(
    { title: "Totally different title", registrationUrl: "https://example.com/book/123" },
    { title: "Completely unrelated wording", registrationUrl: "https://example.com/book/123" }
  );
  assert.equal(score, 100);
});

test("spec's own worked example (Thursday Social Tennis variants) scores above the review threshold", () => {
  const score = computeDuplicateConfidence(
    { title: "Thursday Social Tennis", venueName: "Moore Park", startDate: "2026-10-24", startTime: "19:00" },
    { title: "Thursday Night Social", venueName: "Moore Park Tennis Centre", startDate: "2026-10-24", startTime: "19:00" }
  );
  assert.ok(score >= DUPLICATE_REVIEW_THRESHOLD, `expected >= ${DUPLICATE_REVIEW_THRESHOLD}, got ${score}`);
});

test("two genuinely unrelated events score low", () => {
  const score = computeDuplicateConfidence(
    { title: "Saturday Morning Cardio Tennis", venueName: "Bondi Beach Courts", startDate: "2026-11-01", startTime: "09:00" },
    { title: "Regional Under-14 Championship", venueName: "Perth Tennis Centre", startDate: "2026-12-15", startTime: "13:00" }
  );
  assert.ok(score < DUPLICATE_REVIEW_THRESHOLD, `expected < ${DUPLICATE_REVIEW_THRESHOLD}, got ${score}`);
});

test("same title and date but a different suburb still scores meaningfully lower than an exact venue match", () => {
  const sameVenue = computeDuplicateConfidence(
    { title: "Sunday Round Robin", venueName: "Moore Park", startDate: "2026-10-25" },
    { title: "Sunday Round Robin", venueName: "Moore Park", startDate: "2026-10-25" }
  );
  const differentSuburb = computeDuplicateConfidence(
    { title: "Sunday Round Robin", venueName: "Moore Park", suburb: "Moore Park", startDate: "2026-10-25" },
    { title: "Sunday Round Robin", venueName: "Different Courts", suburb: "Parramatta", startDate: "2026-10-25" }
  );
  assert.ok(differentSuburb < sameVenue);
});

// --- Extraction parsing / confidence ---

function extractedActivity(overrides: Partial<ExtractedActivity> = {}): ExtractedActivity {
  return {
    title: "Saturday Social Tennis",
    description: null,
    activityTypeText: null,
    gameFormatText: null,
    startDate: null,
    endDate: null,
    startTime: null,
    endTime: null,
    recurrenceText: null,
    venueName: null,
    address: null,
    suburb: null,
    city: null,
    state: null,
    postcode: null,
    levelText: null,
    price: null,
    currency: null,
    organiserName: null,
    registrationUrl: null,
    ...overrides,
  };
}

test("parses several activities from one page", () => {
  const raw = JSON.stringify({
    activities: [
      extractedActivity({ title: "Saturday Social Tennis", price: 15 }),
      extractedActivity({ title: "Sunday Round Robin" }),
      extractedActivity({ title: "Thursday Cardio Tennis" }),
    ],
  });
  const result = parseExtractedActivities(raw);
  assert.ok(result);
  assert.equal(result?.activities.length, 3);
  assert.equal(result?.activities[0].price, 15);
  assert.equal(result?.invalidCount, 0);
});

test("a valid empty list is a real answer (nothing on the page), distinct from a failed extraction", () => {
  const result = parseExtractedActivities(JSON.stringify({ activities: [] }));
  assert.ok(result);
  assert.equal(result?.activities.length, 0);
  assert.equal(parseExtractedActivities("not json"), null);
});

test("one malformed entry is dropped and counted - it doesn't discard the good ones", () => {
  const raw = JSON.stringify({
    activities: [extractedActivity({ title: "Good One" }), { title: "" }, extractedActivity({ title: "Another Good One" })],
  });
  const result = parseExtractedActivities(raw);
  assert.equal(result?.activities.length, 2);
  assert.equal(result?.invalidCount, 1);
});

test("strips a markdown fence the model wasn't supposed to add", () => {
  const raw = "```json\n" + JSON.stringify({ activities: [extractedActivity()] }) + "\n```";
  assert.equal(parseExtractedActivities(raw)?.activities.length, 1);
});

test("a response with no activities array at all is unusable (null)", () => {
  assert.equal(parseExtractedActivities(JSON.stringify({ something: "else" })), null);
});

test("no more than 20 activities are taken from one page", () => {
  const raw = JSON.stringify({ activities: Array.from({ length: 30 }, (_, i) => extractedActivity({ title: `Event ${i}` })) });
  assert.equal(parseExtractedActivities(raw)?.activities.length, 20);
});

test("evidence snippets and the cancelled flag survive parsing", () => {
  const raw = JSON.stringify({
    activities: [{ ...extractedActivity({ title: "Cancelled Social" }), cancelled: true, evidence: { price: "$15 visitors" } }],
  });
  const a = parseExtractedActivities(raw)?.activities[0];
  assert.equal(a?.cancelled, true);
  assert.equal(a?.evidence?.price, "$15 visitors");
});

test("classifyConfidence is HIGH only with title+date+location+registration all present", () => {
  const high = extractedActivity({ startDate: "2027-01-01", venueName: "Moore Park", registrationUrl: "https://x.com" });
  assert.equal(classifyConfidence(high), "HIGH");
});

test("classifyConfidence is MEDIUM with title+date+location but no registration link", () => {
  const medium = extractedActivity({ startDate: "2027-01-01", venueName: "Moore Park" });
  assert.equal(classifyConfidence(medium), "MEDIUM");
});

test("classifyConfidence is LOW when location or date is missing entirely", () => {
  const low = extractedActivity({ startDate: "2027-01-01" }); // no location at all
  assert.equal(classifyConfidence(low), "LOW");
});

test("a recurring session (recurrenceText, no specific startDate) still counts as having a date for confidence purposes", () => {
  const withRecurrence = extractedActivity({ recurrenceText: "every Thursday 7-9pm", venueName: "Moore Park", registrationUrl: "https://x.com" });
  assert.equal(classifyConfidence(withRecurrence), "HIGH");
});

test("the extraction prompt explicitly forbids inventing missing fields", () => {
  const { system } = buildExtractionPrompt("some page text", "https://example.com");
  assert.ok(system.toLowerCase().includes("extract, do not invent"));
});

test("the extraction prompt asks for one entry per activity and never splitting a recurring session into dates", () => {
  const { system } = buildExtractionPrompt("some page text", "https://example.com");
  assert.ok(system.includes("One entry per distinct activity"));
  assert.ok(system.toLowerCase().includes("never split it into individual dates"));
});

test("the extraction prompt explicitly forbids inventing a UTR number", () => {
  const { system } = buildExtractionPrompt("some page text", "https://example.com");
  assert.ok(system.toLowerCase().includes("never invent a specific utr"));
});

// --- Admin queue tabs ---

test("a clean new discovery lands in Pending", () => {
  assert.equal(classifyQueueTab("PENDING", "ACTIVE"), "PENDING");
});

test("a questionable new discovery lands in Needs Review, not Pending", () => {
  assert.equal(classifyQueueTab("PENDING", "NEEDS_REVIEW"), "NEEDS_REVIEW");
});

test("an approved, healthy item is in Approved", () => {
  assert.equal(classifyQueueTab("APPROVED", "ACTIVE"), "APPROVED");
});

test("an approved item whose source needs re-checking moves to Needs Review", () => {
  assert.equal(classifyQueueTab("APPROVED", "NEEDS_REVIEW"), "NEEDS_REVIEW");
});

test("rejected and admin-marked duplicates both land in Rejected, whatever their freshness status", () => {
  assert.equal(classifyQueueTab("REJECTED", "ACTIVE"), "REJECTED");
  assert.equal(classifyQueueTab("REJECTED", "NEEDS_REVIEW"), "REJECTED");
  assert.equal(classifyQueueTab("DUPLICATE", "NEEDS_REVIEW"), "REJECTED");
});

test("expired and cancelled events are archived, not shown as approved", () => {
  assert.equal(classifyQueueTab("APPROVED", "EXPIRED"), "ARCHIVED");
  assert.equal(classifyQueueTab("APPROVED", "CANCELLED"), "ARCHIVED");
  assert.equal(classifyQueueTab("PENDING", "EXPIRED"), "ARCHIVED");
});

test("a changed or unreachable source puts the event in Needs Review", () => {
  assert.equal(classifyQueueTab("PENDING", "CHANGED"), "NEEDS_REVIEW");
  assert.equal(classifyQueueTab("APPROVED", "SOURCE_UNAVAILABLE"), "NEEDS_REVIEW");
});

test("an admin's Reject decision wins even over an archived status", () => {
  assert.equal(classifyQueueTab("REJECTED", "EXPIRED"), "REJECTED");
});

test("every (reviewStatus, discoveryStatus) combination maps to exactly one tab", () => {
  const review = ["PENDING", "APPROVED", "REJECTED", "DUPLICATE"];
  const discovery = ["ACTIVE", "CHANGED", "EXPIRED", "SOURCE_UNAVAILABLE", "NEEDS_REVIEW", "CANCELLED"];
  const valid = new Set(["PENDING", "APPROVED", "REJECTED", "NEEDS_REVIEW", "ARCHIVED"]);
  for (const r of review) for (const d of discovery) {
    assert.ok(valid.has(classifyQueueTab(r, d)), `${r}/${d} mapped to an unknown tab`);
  }
});

test("an unknown time zone or a recurrence we couldn't understand starts NEEDS_REVIEW", () => {
  assert.equal(initialDiscoveryStatus({ confidence: "HIGH", isPossibleDuplicate: false, timeZoneKnown: false }), "NEEDS_REVIEW");
  assert.equal(initialDiscoveryStatus({ confidence: "HIGH", isPossibleDuplicate: false, recurrenceUnderstood: false }), "NEEDS_REVIEW");
});

test("a confident, non-duplicate discovery starts ACTIVE (so it appears in Pending)", () => {
  assert.equal(initialDiscoveryStatus({ confidence: "HIGH", isPossibleDuplicate: false }), "ACTIVE");
  assert.equal(initialDiscoveryStatus({ confidence: "MEDIUM", isPossibleDuplicate: false }), "ACTIVE");
});

test("a low-confidence discovery starts NEEDS_REVIEW", () => {
  assert.equal(initialDiscoveryStatus({ confidence: "LOW", isPossibleDuplicate: false }), "NEEDS_REVIEW");
});

test("a possible duplicate starts NEEDS_REVIEW even when otherwise confident", () => {
  assert.equal(initialDiscoveryStatus({ confidence: "HIGH", isPossibleDuplicate: true }), "NEEDS_REVIEW");
});

// --- Recurring duplicates / registration URLs ---

test("two recurring listings on the same weekday at the same venue score as likely duplicates even with no fixed date", () => {
  const score = computeDuplicateConfidence(
    { title: "Thursday Social Tennis", venueName: "Moore Park", recurrenceDayOfWeek: "THURSDAY", startTime: "19:00" },
    { title: "Thursday Night Social", venueName: "Moore Park Tennis Centre", recurrenceDayOfWeek: "THURSDAY", startTime: "19:00" }
  );
  assert.ok(score >= DUPLICATE_REVIEW_THRESHOLD, `expected >= ${DUPLICATE_REVIEW_THRESHOLD}, got ${score}`);
});

test("recurring listings on different weekdays don't get the date credit", () => {
  const same = computeDuplicateConfidence(
    { title: "Social Tennis", venueName: "Moore Park", recurrenceDayOfWeek: "THURSDAY" },
    { title: "Social Tennis", venueName: "Moore Park", recurrenceDayOfWeek: "THURSDAY" }
  );
  const different = computeDuplicateConfidence(
    { title: "Social Tennis", venueName: "Moore Park", recurrenceDayOfWeek: "THURSDAY" },
    { title: "Social Tennis", venueName: "Moore Park", recurrenceDayOfWeek: "SUNDAY" }
  );
  assert.ok(different < same);
});

test("an absolute https registration link is kept", () => {
  assert.equal(resolveRegistrationUrl("https://club.com.au/book?id=1", "https://club.com.au/events"), "https://club.com.au/book?id=1");
});

test("a relative registration link is resolved against the page it was found on", () => {
  assert.equal(resolveRegistrationUrl("/book/social", "https://club.com.au/events"), "https://club.com.au/book/social");
});

test("javascript:, data: and mailto: links are never allowed through (would render as a player-facing link)", () => {
  assert.equal(resolveRegistrationUrl("javascript:alert(1)", "https://club.com.au/"), null);
  assert.equal(resolveRegistrationUrl("data:text/html,<script>1</script>", "https://club.com.au/"), null);
  assert.equal(resolveRegistrationUrl("mailto:hello@club.com.au", "https://club.com.au/"), null);
});

test("an empty or garbage registration value returns null, never a fabricated link", () => {
  assert.equal(resolveRegistrationUrl(null, "https://club.com.au/"), null);
  assert.equal(resolveRegistrationUrl("   ", "https://club.com.au/"), null);
});

// --- state names, source URL safety, recurring-date validation, flag reasons ---

test("full state names and codes both normalise to the code", () => {
  assert.equal(normaliseAustralianState("Victoria"), "VIC");
  assert.equal(normaliseAustralianState("new south wales"), "NSW");
  assert.equal(normaliseAustralianState("qld"), "QLD");
  assert.equal(normaliseAustralianState("N.T."), "NT");
  assert.equal(normaliseAustralianState("Australian Capital Territory"), "ACT");
});

test("an unrecognised state returns null rather than being passed through (an unknown state = an unknown time zone)", () => {
  assert.equal(normaliseAustralianState("California"), null);
  assert.equal(normaliseAustralianState(""), null);
  assert.equal(normaliseAustralianState(null), null);
});

test("normal public https/http source pages are safe to fetch", () => {
  assert.equal(isSafeExternalUrl("https://www.examplecourts.com.au/social-tennis"), true);
  assert.equal(isSafeExternalUrl("http://club.org.au/events"), true);
});

test("non-http schemes are never fetched", () => {
  assert.equal(isSafeExternalUrl("file:///etc/passwd"), false);
  assert.equal(isSafeExternalUrl("ftp://club.org.au/x"), false);
  assert.equal(isSafeExternalUrl("javascript:alert(1)"), false);
  assert.equal(isSafeExternalUrl("not a url"), false);
});

test("localhost, private ranges, and the cloud metadata address are blocked", () => {
  for (const u of [
    "http://localhost:3000/admin",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://172.16.0.9/",
    "http://172.31.255.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://intranet.internal/",
  ]) {
    assert.equal(isSafeExternalUrl(u), false, u);
  }
  assert.equal(isSafeExternalUrl("http://172.32.0.1/"), true); // just outside 172.16-31
});

test("a recurring session with a past season-start date is still valid (only its END matters)", () => {
  const r = validateDiscoveredDates({
    startDate: "2020-01-01", endDate: null, startTime: "19:00", endTime: "21:00",
    isRecurring: true, timeZone: "Australia/Sydney", now: new Date("2026-10-01T00:00:00Z"),
  });
  assert.equal(r.valid, true);
});

test("a recurring session with no date at all is valid", () => {
  assert.equal(
    validateDiscoveredDates({ startDate: null, endDate: null, startTime: "19:00", endTime: null, isRecurring: true, timeZone: null }).valid,
    true
  );
});

test("a recurring series whose end date has passed is not valid", () => {
  const r = validateDiscoveredDates({
    startDate: null, endDate: "2026-06-30", startTime: null, endTime: null,
    isRecurring: true, timeZone: "Australia/Sydney", now: new Date("2026-10-01T00:00:00Z"),
  });
  assert.equal(r.reason, "already_expired");
});

test("a recurring session with an end time before its start time is invalid", () => {
  const r = validateDiscoveredDates({ startDate: null, endDate: null, startTime: "21:00", endTime: "19:00", isRecurring: true, timeZone: null });
  assert.equal(r.reason, "invalid_time_range");
});

test("a one-off with no date is still rejected (only recurring sessions may omit it)", () => {
  const r = validateDiscoveredDates({ startDate: null, endDate: null, startTime: null, endTime: null, isRecurring: false, timeZone: null });
  assert.equal(r.reason, "missing_start_date");
});

test("flag reasons are plain English and empty for a clean discovery", () => {
  assert.deepEqual(initialFlagReasons({ confidence: "HIGH", isPossibleDuplicate: false }), []);
  const reasons = initialFlagReasons({ confidence: "LOW", isPossibleDuplicate: true, timeZoneKnown: false, recurrenceUnderstood: false });
  assert.equal(reasons.length, 4);
  assert.ok(reasons.some((r) => r.includes("time zone")));
});

// --- ambiguity / unknown formats (found on real pilot pages) ---

test("a format nothing recognises is null, not 'social'", () => {
  assert.equal(normaliseFormatText("2026 Pride Cup").activityType, null);
  assert.equal(normaliseFormatText("Growing the Game: Women and Girl's Tennis").activityType, null);
});

test("a page naming BOTH singles and doubles doesn't get either one", () => {
  assert.equal(normaliseFormatText("Singles and Doubles play as well as coaching").gameFormat, null);
  assert.equal(normaliseFormatText("Play singles or mixed doubles").gameFormat, null);
});

test("an unambiguous single format is still set", () => {
  assert.equal(normaliseFormatText("Saturday social doubles").gameFormat, "doubles");
  assert.equal(normaliseFormatText("Thursday singles fixtures").gameFormat, "singles");
  assert.equal(normaliseFormatText("Mixed doubles night").gameFormat, "mixed");
});

test("a mangled 'http://name@host' link (an email address used as a URL) is never a registration link", () => {
  assert.equal(resolveRegistrationUrl("http://qldtcproshop@tennis.com.au", "https://club.com.au/"), null);
  assert.equal(resolveRegistrationUrl("https://user:pw@evil.example/", "https://club.com.au/"), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
