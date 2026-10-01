// [PLAY][AI] Partner Events - server-only decisions: the dedup-priority
// logic (never needed client-side). The display logic (registration CTA,
// badge wording) that IS shared with the client lives in
// shared/partnerEvents.ts - re-exported here too so nothing importing
// from this file needs to change.

export {
  resolveRegistrationCta,
  resolvePartnerBadge,
  type EventSourceType,
  type RegistrationCta,
  type RegistrationInput,
  type PartnerBadgeInput,
  type PartnerBadge,
} from "@shared/partnerEvents";
import type { EventSourceType } from "@shared/partnerEvents";

/**
 * Lower number = higher priority (spec: "TENNISCONNECT -> PARTNER ->
 * EXTERNAL"). A real TC-managed session always wins; a confirmed Partner
 * Event outranks a plain Discovery find of the same real-world activity.
 */
const PRIORITY: Record<EventSourceType, number> = { TENNISCONNECT: 0, PARTNER: 1, EXTERNAL: 2 };

export function sourceTypePriority(sourceType: EventSourceType): number {
  return PRIORITY[sourceType];
}

export interface DedupCandidate {
  id: string;
  sourceType: EventSourceType;
  /** When the candidate was created/discovered - the tiebreaker when
      both sides share a priority tier (e.g. two plain EXTERNAL finds):
      the existing, earlier one stays canonical, matching the Discovery
      Agent's existing "new one gets flagged against the old one"
      behaviour. */
  createdAt: Date;
}

export interface DedupResolution {
  /** The id that should be treated as the real event - the other is the
      one a caller should mark as a duplicate of this one. */
  canonicalId: string;
  /** The id that should be flagged/hidden as a duplicate. */
  duplicateId: string;
  reason: "higher-priority-source" | "earlier-at-same-priority";
}

/**
 * Given two candidate rows that are believed to describe the same real
 * event (their duplicate CONFIDENCE is someone else's job - see
 * discoveryDuplicateDetection.ts - this only decides who wins once
 * they're already believed to be duplicates). Priority tier wins
 * outright, regardless of which was created first - a Partner Event
 * entered today must supersede a Discovery find from last month, and
 * equally a Discovery Agent re-scan must never un-supersede an existing
 * approved Partner Event just because it happened to see the source
 * page again later. Within the same tier, the earlier one stays
 * canonical (unchanged existing behaviour for two plain EXTERNAL finds).
 */
export function resolveDuplicateWinner(a: DedupCandidate, b: DedupCandidate): DedupResolution {
  const pa = sourceTypePriority(a.sourceType);
  const pb = sourceTypePriority(b.sourceType);

  if (pa !== pb) {
    const [winner, loser] = pa < pb ? [a, b] : [b, a];
    return { canonicalId: winner.id, duplicateId: loser.id, reason: "higher-priority-source" };
  }

  const [winner, loser] = a.createdAt.getTime() <= b.createdAt.getTime() ? [a, b] : [b, a];
  return { canonicalId: winner.id, duplicateId: loser.id, reason: "earlier-at-same-priority" };
}

