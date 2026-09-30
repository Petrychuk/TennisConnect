// [PLAY][AI] TC Discovery Agent, section 12-13 - duplicate detection.
// Deterministic scoring, no LLM: title similarity + venue + date +
// start time + organiser + registration URL, combined into one 0-100
// confidence a pair of activities describe the same real event. For
// V1, this only ever produces a SCORE - the decision of what to do
// with a high-confidence match (flag for review vs auto-reject) is the
// caller's, matching spec section 12's "uncertain duplicates should be
// flagged for review rather than automatically deleted."

export interface DuplicateCandidate {
  title: string;
  venueName?: string | null;
  suburb?: string | null;
  startDate?: string | null; // YYYY-MM-DD
  /** For a recurring session with no fixed date - "same weekday" is the
      equivalent of "same day" when comparing two recurring listings. */
  recurrenceDayOfWeek?: string | null;
  startTime?: string | null; // HH:MM
  organiserName?: string | null;
  registrationUrl?: string | null;
}

/**
 * Normalises for comparison only - lowercase, strips punctuation and
 * common filler words ("the", "at", "-") that differ between two
 * descriptions of the same event without changing its meaning.
 */
function normaliseForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|at|in|on|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token-overlap similarity (Jaccard-style) between two short strings -
 * simple, dependency-free, and good enough for "Thursday Social
 * Tennis" vs "Thursday Night Social" without pulling in a fuzzy-match
 * library for this. Returns 0-1.
 */
function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(normaliseForComparison(a).split(" ").filter(Boolean));
  const setB = new Set(normaliseForComparison(b).split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  const arrA = Array.from(setA);
  let overlap = 0;
  for (let i = 0; i < arrA.length; i++) {
    if (setB.has(arrA[i])) overlap++;
  }
  const union = new Set(arrA.concat(Array.from(setB))).size;
  return overlap / union;
}

/**
 * Returns a 0-100 duplicate confidence between two candidate
 * descriptions of possibly-the-same event. An exact registrationUrl
 * match is treated as conclusive on its own (100) - two listings
 * linking to the identical booking page are the same event by
 * construction, no need to weigh anything else. Otherwise, a weighted
 * combination of title similarity, same venue/suburb, same date, same
 * (or very close) start time, and same organiser.
 */
export function computeDuplicateConfidence(a: DuplicateCandidate, b: DuplicateCandidate): number {
  if (a.registrationUrl && b.registrationUrl && a.registrationUrl.trim() === b.registrationUrl.trim()) {
    return 100;
  }

  let score = 0;

  // Title (40)
  score += tokenSimilarity(a.title, b.title) * 40;

  // Venue/suburb (25) - either venue names clearly refer to the same
  // place (exact match, or one contains the other - "Moore Park" is
  // clearly the same venue as "Moore Park Tennis Centre"), or matching
  // suburbs when venue names differ or aren't a clear match.
  if (a.venueName && b.venueName) {
    const va = normaliseForComparison(a.venueName);
    const vb = normaliseForComparison(b.venueName);
    if (va === vb || va.includes(vb) || vb.includes(va)) {
      score += 25;
    } else if (a.suburb && b.suburb && normaliseForComparison(a.suburb) === normaliseForComparison(b.suburb)) {
      score += 15;
    }
  } else if (a.suburb && b.suburb && normaliseForComparison(a.suburb) === normaliseForComparison(b.suburb)) {
    score += 15;
  }

  // Date (20) - exact match only; a duplicate must be the same day. Two
  // recurring listings with no fixed date match on the same weekday.
  if (a.startDate && b.startDate) {
    if (a.startDate === b.startDate) score += 20;
  } else if (a.recurrenceDayOfWeek && b.recurrenceDayOfWeek && a.recurrenceDayOfWeek === b.recurrenceDayOfWeek) {
    score += 20;
  }

  // Start time (10) - exact, or within 30 minutes (sources round
  // differently - "7pm" vs "19:00" vs "6:45pm start").
  if (a.startTime && b.startTime) {
    if (a.startTime === b.startTime) {
      score += 10;
    } else {
      const [aH, aM] = a.startTime.split(":").map(Number);
      const [bH, bM] = b.startTime.split(":").map(Number);
      const diffMinutes = Math.abs(aH * 60 + aM - (bH * 60 + bM));
      if (diffMinutes <= 30) score += 6;
    }
  }

  // Organiser (5)
  if (a.organiserName && b.organiserName && normaliseForComparison(a.organiserName) === normaliseForComparison(b.organiserName)) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
}

/** Spec section 12's own examples land around here - used as the
    "flag for review" threshold by callers, not a hard cutoff enforced
    inside this file (a caller may reasonably choose differently). */
export const DUPLICATE_REVIEW_THRESHOLD = 60;
