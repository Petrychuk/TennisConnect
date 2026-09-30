// [PLAY][AI] TC Discovery Agent, section 14 - freshness. The Agent
// re-visits sources, and every outcome of that visit is decided HERE,
// as pure functions, so the rules are unit-tested even though the
// scanning itself (real fetches + a real model call) can't be.
//
// Freshness policy (V1), in one place:
//   - Seen again, unchanged        -> lastCheckedAt refreshed; back to ACTIVE.
//   - Seen again, key fields moved -> an APPROVED event goes back to PENDING
//                                     as CHANGED (out of Play until an admin
//                                     re-approves the new values, so players
//                                     never see AI-extracted changes nobody
//                                     reviewed); a PENDING one is just updated.
//   - Gone from a page we DID read  -> NEEDS_REVIEW, but an approved event
//                                     stays visible: "do not immediately
//                                     assume it is cancelled" (spec 14).
//   - Source page unreachable       -> SOURCE_UNAVAILABLE; nothing is hidden
//                                     over what may be a transient outage.
//   - Source says it's cancelled    -> CANCELLED (leaves Play).
//   - Date passed                   -> EXPIRED (leaves Play).
//   - An admin's Reject / Duplicate decision is never overturned by a re-scan.

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "DUPLICATE";
export type DiscoveryStatus =
  | "ACTIVE"
  | "CHANGED"
  | "EXPIRED"
  | "SOURCE_UNAVAILABLE"
  | "NEEDS_REVIEW"
  | "CANCELLED";

/** The fields whose change makes an approved event worth re-reviewing.
    Deliberately NOT description/organiser wording - cosmetic edits on a
    source page shouldn't pull a good event out of Play. */
export const TRACKED_FIELDS = [
  "title",
  "startDate",
  "endDate",
  "startTime",
  "endTime",
  "recurrenceFrequency",
  "recurrenceDayOfWeek",
  "venueName",
  "suburb",
  "price",
  "priceLabel",
  "registrationUrl",
] as const;
export type TrackedField = (typeof TRACKED_FIELDS)[number];
export type TrackedValues = Partial<Record<TrackedField, string | number | null | undefined>>;

const norm = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? "" : String(v).trim().toLowerCase();

/** Case/space-insensitive title key, so "Saturday Social Tennis" and
    "saturday  social tennis!" are the same event on the same page. */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface IdentityFields {
  title: string;
  startDate?: string | null;
  recurrenceDayOfWeek?: string | null;
}

/**
 * Is `incoming` the same event as `existing`, both from the same
 * source page? Same title, and the same date - or, for recurring
 * sessions with no fixed date, the same weekday. Deliberately strict:
 * merging two genuinely different events would silently lose one, while
 * a missed match only creates a new item that goes through review.
 */
export function isSameSourceEvent(existing: IdentityFields, incoming: IdentityFields): boolean {
  if (titleKey(existing.title) !== titleKey(incoming.title)) return false;
  if (existing.startDate && incoming.startDate) return existing.startDate === incoming.startDate;
  if (existing.recurrenceDayOfWeek && incoming.recurrenceDayOfWeek) {
    return existing.recurrenceDayOfWeek === incoming.recurrenceDayOfWeek;
  }
  // one side dated, the other not (or neither has any date signal)
  return !existing.startDate && !incoming.startDate && !existing.recurrenceDayOfWeek && !incoming.recurrenceDayOfWeek;
}

export interface FieldChange {
  field: TrackedField;
  from: string;
  to: string;
}

export function diffTrackedFields(existing: TrackedValues, incoming: TrackedValues): FieldChange[] {
  const out: FieldChange[] = [];
  for (const f of TRACKED_FIELDS) {
    if (norm(existing[f]) !== norm(incoming[f])) {
      out.push({ field: f, from: String(existing[f] ?? "-"), to: String(incoming[f] ?? "-") });
    }
  }
  return out;
}

/** "price: 15 -> 20; startTime: 19:00 -> 18:30" - kept in the row's
    extraction evidence so the admin re-reviewing a CHANGED event can see
    exactly what moved. */
export function summariseChanges(changes: FieldChange[]): string {
  return changes.map((c) => `${c.field}: ${c.from} -> ${c.to}`).join("; ");
}

export interface SeenAgainDecision {
  /** Overwrite the stored fields with the newly extracted values. */
  applyFields: boolean;
  reviewStatus?: ReviewStatus;
  discoveryStatus?: DiscoveryStatus;
  changeSummary?: string;
  /** "updated" for the run summary's eventsUpdated, "touched" when only
      lastCheckedAt moved. */
  outcome: "updated" | "touched";
}

export function decideOnSeenAgain(input: {
  reviewStatus: ReviewStatus;
  discoveryStatus: DiscoveryStatus;
  changes: FieldChange[];
  cancelled: boolean;
}): SeenAgainDecision {
  const { reviewStatus, discoveryStatus, changes, cancelled } = input;

  // A human's Reject/Duplicate decision stands - just note we looked.
  if (reviewStatus === "REJECTED" || reviewStatus === "DUPLICATE") {
    return { applyFields: false, outcome: "touched" };
  }
  // Terminal states stay terminal.
  if (discoveryStatus === "EXPIRED" || discoveryStatus === "CANCELLED") {
    return { applyFields: false, outcome: "touched" };
  }

  if (cancelled) {
    return { applyFields: false, discoveryStatus: "CANCELLED", outcome: "updated" };
  }

  if (changes.length === 0) {
    // Unchanged. Recover from a transient flag (source was down / event
    // looked missing) - but never clear a flag a human needs to look at
    // for another reason (CHANGED awaiting re-approval, or an item the
    // Agent itself queued as NEEDS_REVIEW while still PENDING).
    if (discoveryStatus === "SOURCE_UNAVAILABLE") return { applyFields: false, discoveryStatus: "ACTIVE", outcome: "touched" };
    if (discoveryStatus === "NEEDS_REVIEW" && reviewStatus === "APPROVED") {
      return { applyFields: false, discoveryStatus: "ACTIVE", outcome: "touched" };
    }
    return { applyFields: false, outcome: "touched" };
  }

  if (reviewStatus === "APPROVED") {
    return {
      applyFields: true,
      reviewStatus: "PENDING",
      discoveryStatus: "CHANGED",
      changeSummary: summariseChanges(changes),
      outcome: "updated",
    };
  }

  // PENDING: nobody has approved these values yet, so just keep them current.
  return { applyFields: true, changeSummary: summariseChanges(changes), outcome: "updated" };
}

/** An event we knew about wasn't on a page we successfully read. */
export function decideOnMissing(input: {
  reviewStatus: ReviewStatus;
  discoveryStatus: DiscoveryStatus;
}): { discoveryStatus: DiscoveryStatus } | null {
  const { reviewStatus, discoveryStatus } = input;
  if (reviewStatus === "REJECTED" || reviewStatus === "DUPLICATE") return null;
  if (discoveryStatus === "EXPIRED" || discoveryStatus === "CANCELLED") return null;
  if (discoveryStatus === "NEEDS_REVIEW" || discoveryStatus === "CHANGED") return null; // already in front of an admin
  return { discoveryStatus: "NEEDS_REVIEW" };
}

/** The source page couldn't be fetched at all. */
export function decideOnSourceUnavailable(input: {
  reviewStatus: ReviewStatus;
  discoveryStatus: DiscoveryStatus;
}): { discoveryStatus: DiscoveryStatus } | null {
  const { reviewStatus, discoveryStatus } = input;
  if (reviewStatus === "REJECTED" || reviewStatus === "DUPLICATE") return null;
  // Only flag a healthy item - don't overwrite a more specific state.
  if (discoveryStatus !== "ACTIVE") return null;
  return { discoveryStatus: "SOURCE_UNAVAILABLE" };
}

/** Should this status still be shown to players in Play? */
export function isPlayVisible(reviewStatus: string, discoveryStatus: string): boolean {
  return reviewStatus === "APPROVED" && discoveryStatus !== "EXPIRED" && discoveryStatus !== "CANCELLED";
}
