// Standalone unit tests - npx tsx server/services/discoveryAgent.test.ts

import assert from "node:assert/strict";
import {
  normaliseLevelText,
  normaliseFormatText,
  resolveTimeZoneForState,
  validateActivityDates,
} from "./discoveryNormalization";
import { computeDuplicateConfidence, DUPLICATE_REVIEW_THRESHOLD } from "./discoveryDuplicateDetection";
import { parseExtractedActivity, classifyConfidence, buildExtractionPrompt, type ExtractedActivity } from "./discoveryExtraction";
import { classifyQueueTab, initialDiscoveryStatus } from "./discoveryQueue";

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

test("parses a valid, well-formed extraction response", () => {
  const raw = JSON.stringify(extractedActivity({ title: "Saturday Social Tennis", price: 15 }));
  const result = parseExtractedActivity(raw);
  assert.ok(result);
  assert.equal(result?.title, "Saturday Social Tennis");
  assert.equal(result?.price, 15);
});

test("strips a markdown fence the model wasn't supposed to add", () => {
  const raw = "```json\n" + JSON.stringify(extractedActivity()) + "\n```";
  assert.ok(parseExtractedActivity(raw));
});

test("invalid JSON returns null, never throws", () => {
  assert.equal(parseExtractedActivity("not json"), null);
});

test("a response missing the required title field fails validation and returns null", () => {
  const raw = JSON.stringify({ ...extractedActivity(), title: "" });
  assert.equal(parseExtractedActivity(raw), null);
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

test("every (reviewStatus, discoveryStatus) combination maps to exactly one tab", () => {
  const review = ["PENDING", "APPROVED", "REJECTED", "DUPLICATE"];
  const discovery = ["ACTIVE", "CHANGED", "EXPIRED", "SOURCE_UNAVAILABLE", "NEEDS_REVIEW", "CANCELLED"];
  const valid = new Set(["PENDING", "APPROVED", "REJECTED", "NEEDS_REVIEW"]);
  for (const r of review) for (const d of discovery) {
    assert.ok(valid.has(classifyQueueTab(r, d)), `${r}/${d} mapped to an unknown tab`);
  }
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
