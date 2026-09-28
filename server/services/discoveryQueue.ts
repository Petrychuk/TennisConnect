// [PLAY][AI] TC Discovery Agent, section 17 - which admin queue tab an
// external activity belongs to. One pure function, used by BOTH the
// list and the tab counts, so a tab's number can never disagree with
// what opening that tab actually shows.
//
// The four tabs are disjoint and together cover every possible
// (reviewStatus, discoveryStatus) pair:
//
//   REJECTED      - an admin decided not to use it (rejected, or marked
//                   as a duplicate). Wins over everything else.
//   NEEDS_REVIEW  - the Agent isn't sure (low confidence, or a possible
//                   duplicate it flagged), or an already-approved item
//                   whose source needs re-checking. Still undecided /
//                   under question.
//   PENDING       - a clean new discovery awaiting its first look.
//   APPROVED      - an admin trusted it, and nothing currently
//                   questions it.

export type QueueTab = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW";

export function classifyQueueTab(reviewStatus: string, discoveryStatus: string): QueueTab {
  if (reviewStatus === "REJECTED" || reviewStatus === "DUPLICATE") return "REJECTED";
  if (discoveryStatus === "NEEDS_REVIEW") return "NEEDS_REVIEW";
  if (reviewStatus === "APPROVED") return "APPROVED";
  return "PENDING";
}

/**
 * The status the Agent gives a freshly discovered item. Only genuinely
 * questionable items start as NEEDS_REVIEW - a clean, confident,
 * non-duplicate discovery starts as ACTIVE so it lands in Pending
 * (previously every new item defaulted to NEEDS_REVIEW, which would
 * have made that tab a copy of Pending and hidden the real signal).
 */
export function initialDiscoveryStatus(input: {
  confidence: "HIGH" | "MEDIUM" | "LOW";
  isPossibleDuplicate: boolean;
}): "ACTIVE" | "NEEDS_REVIEW" {
  return input.confidence === "LOW" || input.isPossibleDuplicate ? "NEEDS_REVIEW" : "ACTIVE";
}
