// [PLAY][AI] TC Discovery Agent, section 17 - which admin queue tab an
// external activity belongs to. One pure function, used by BOTH the
// list and the tab counts, so a tab's number can never disagree with
// what opening that tab actually shows.
//
// The tabs are disjoint and together cover every possible
// (reviewStatus, discoveryStatus) pair:
//
//   REJECTED      - an admin decided not to use it (rejected, or marked
//                   as a duplicate). Wins over everything else.
//   ARCHIVED      - it's over: the date passed (EXPIRED) or the source
//                   says it was cancelled. Kept for reference, never in Play.
//   NEEDS_REVIEW  - something wants a human look: the Agent is unsure,
//                   suspects a duplicate, an approved event's source
//                   changed / went missing / became unreachable.
//   APPROVED      - an admin trusted it, and nothing currently questions it.
//   PENDING       - a clean new discovery awaiting its first look.

export type QueueTab = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | "ARCHIVED";

export function classifyQueueTab(reviewStatus: string, discoveryStatus: string): QueueTab {
  if (reviewStatus === "REJECTED" || reviewStatus === "DUPLICATE") return "REJECTED";
  if (discoveryStatus === "EXPIRED" || discoveryStatus === "CANCELLED") return "ARCHIVED";
  if (
    discoveryStatus === "NEEDS_REVIEW" ||
    discoveryStatus === "CHANGED" ||
    discoveryStatus === "SOURCE_UNAVAILABLE"
  ) {
    return "NEEDS_REVIEW";
  }
  if (reviewStatus === "APPROVED") return "APPROVED";
  return "PENDING";
}

/**
 * The status the Agent gives a freshly discovered item. Only genuinely
 * questionable items start as NEEDS_REVIEW - a clean, confident,
 * non-duplicate discovery starts as ACTIVE so it lands in Pending.
 * "Questionable" now also covers the validation gaps spec section 8
 * cares about: an unknown time zone (we won't silently assume Sydney),
 * or a recurrence we couldn't turn into real dates.
 */
export interface InitialFlagInput {
  confidence: "HIGH" | "MEDIUM" | "LOW";
  isPossibleDuplicate: boolean;
  timeZoneKnown?: boolean;
  recurrenceUnderstood?: boolean;
  /** The source's price wording couldn't be reduced to one honest number. */
  priceUnclear?: boolean;
}

/**
 * Plain-English reasons a new discovery needs a human look - shown to
 * the admin on the card, so "Needs Review" is never a mystery.
 */
export function initialFlagReasons(input: InitialFlagInput): string[] {
  const reasons: string[] = [];
  if (input.confidence === "LOW") reasons.push("Low confidence - key details (date, location) weren't clearly found");
  if (input.isPossibleDuplicate) reasons.push("Possible duplicate of an existing activity");
  if (input.timeZoneKnown === false) reasons.push("State unknown, so the time zone couldn't be determined");
  if (input.recurrenceUnderstood === false) reasons.push("Repeat pattern couldn't be turned into dates");
  if (input.priceUnclear === true) reasons.push("Price is unclear - check the source's wording");
  return reasons;
}

export function initialDiscoveryStatus(input: InitialFlagInput): "ACTIVE" | "NEEDS_REVIEW" {
  return initialFlagReasons(input).length > 0 ? "NEEDS_REVIEW" : "ACTIVE";
}
