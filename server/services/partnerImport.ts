// [PLAY][AI] Partner Events - URL-first import (replaces the earlier
// all-fields manual creation form as the primary flow, per review:
// "do not create a duplicate extraction system - reuse the existing
// Discovery fetch/extract/normalise/validate pipeline"). This file is
// the PURE decision layer, fully unit-testable without a network call
// or a model call - the impure fetch/extract/persist sequence lives in
// storage.ts's importPartnerEventFromUrl, which calls these functions
// with whatever it already fetched/extracted/scored.
//
// Three outcomes, matching the brief exactly:
//  - "duplicate"  - a likely-identical activity already exists (by exact
//                   sourceUrl, or by the same duplicate-confidence score
//                   Discovery itself uses). Nothing is created; the admin
//                   is offered Confirm as Partner on the EXISTING row
//                   instead of a second record for the same real event.
//  - "extracted"  - one or more real activities were found on the page -
//                   create a PARTNER/PENDING row for each, exactly like
//                   an ordinary Discovery find, just pre-labelled PARTNER.
//  - "stub"       - the page couldn't be read, or nothing recognisable as
//                   an activity was found on it. Still create ONE row (a
//                   partner's event always deserves a place in the
//                   queue), with a clear reason, NEEDS_REVIEW, and only
//                   the fields we actually know (partner, source URL) -
//                   "missing information is better than fabricated
//                   information" applies here exactly as it does to AI
//                   extraction itself. The admin completes it via the
//                   existing Edit dialog - manual entry survives only as
//                   that fallback, never as the primary creation flow.

export interface DuplicateCandidate {
  id: string;
  title: string;
  sourceUrl: string;
}

export interface ImportDuplicateResult {
  kind: "duplicate";
  existingId: string;
  existingTitle: string;
  reason: "same-url" | "high-confidence-match";
}

export interface ImportExtractedResult {
  kind: "extracted";
  /** How many distinct activities the page described - what the admin
      sees after import ("Imported 3 events from this page"). */
  count: number;
}

export interface ImportStubResult {
  kind: "stub";
  reason: string;
}

export type ImportDecision = ImportDuplicateResult | ImportExtractedResult | ImportStubResult;

/**
 * Exact-URL duplicate check - the strongest possible signal (the same
 * literal page is already in the system), checked BEFORE spending a
 * model call on it at all. Mirrors the orchestrator's own "exact
 * registrationUrl match = certain duplicate" rule, applied to the
 * import URL itself.
 */
export function findExactUrlDuplicate(pageUrl: string, candidates: DuplicateCandidate[]): DuplicateCandidate | null {
  const normalised = pageUrl.trim().replace(/\/$/, "");
  return candidates.find((c) => c.sourceUrl.trim().replace(/\/$/, "") === normalised) ?? null;
}

export interface ScoredCandidate extends DuplicateCandidate {
  confidence: number;
}

/**
 * Given the page was successfully read and the model found NO
 * recognisable activities at all (an empty, valid answer - see
 * discoveryExtraction.ts's own "a valid empty list is a real answer"),
 * or the page couldn't be read/fetched at all, the import still
 * produces a stub row rather than a bare error. A completely failed
 * fetch and a "nothing here" extraction get slightly different wording
 * (the first invites double-checking the URL), but behave identically
 * from here: create a stub, flag it, let an admin fill it in by hand.
 */
export function decideStubReason(input: { fetchFailed: boolean; fetchError?: string }): string {
  if (input.fetchFailed) {
    return `Couldn't read this page automatically (${input.fetchError ?? "fetch failed"}) - double-check the URL, or fill in the details yourself.`;
  }
  return "No event details could be automatically extracted from this page - fill them in yourself.";
}
