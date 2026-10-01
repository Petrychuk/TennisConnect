// [PLAY][AI] Partner Events - pure display decisions shared between the
// server (building PublicSessionCard rows) and the client (Play's own
// session card / Quick View modal), so the CTA/badge wording can never
// drift between the two. See server/services/partnerEvents.ts for the
// server-only dedup-priority logic (sourceTypePriority/resolveDuplicateWinner),
// which has no client-side use and stays out of the client bundle.

export type EventSourceType = "TENNISCONNECT" | "PARTNER" | "EXTERNAL";

export interface RegistrationCta {
  /** What the button/link should say. */
  label: "Join" | "Register on partner website" | "View original";
  /** Where it goes - null only for "Join" (an internal action, no link). */
  url: string | null;
  /** Whether this opens somewhere else entirely (shows the external-link
      icon, opens in a new tab) rather than acting on the session in place. */
  external: boolean;
}

export interface RegistrationInput {
  sourceType: EventSourceType;
  /** Populated only when registration happens somewhere other than
      TennisConnect itself - a verified link, or (per spec section 19)
      the source/partner's own page as a fallback when no specific
      registration link was ever given. Never fabricated here - this
      function only decides WORDING, not what counts as a valid link. */
  externalUrl: string | null;
}

/**
 * The exact CTA spec sections 18-19 (and the Partner Events brief) ask
 * for: a real TennisConnect session (Partner or not) joins internally; a
 * row with an external link says whose site it's going to, so a Partner
 * row reads "Register on partner website" rather than the generic
 * "View original" a plain Discovery find gets.
 */
export function resolveRegistrationCta(input: RegistrationInput): RegistrationCta {
  if (!input.externalUrl) {
    return { label: "Join", url: null, external: false };
  }
  return {
    label: input.sourceType === "PARTNER" ? "Register on partner website" : "View original",
    url: input.externalUrl,
    external: true,
  };
}

export interface PartnerBadgeInput {
  sourceType: EventSourceType;
  /** organizationName (TC-registered) or partnerName (not yet
      registered) - whichever the card actually carries. */
  name: string;
}

export interface PartnerBadge {
  /** null means no special badge (an ordinary TennisConnect session). */
  label: "Partner" | "Found by TennisConnect" | null;
  name: string | null;
}

/** What the source-attribution line shows (spec: "Partner badge in
    Play", spec section 18's "Found by TennisConnect" for plain
    Discovery finds). An ordinary TC session gets no badge at all. */
export function resolvePartnerBadge(input: PartnerBadgeInput): PartnerBadge {
  if (input.sourceType === "PARTNER") return { label: "Partner", name: input.name };
  if (input.sourceType === "EXTERNAL") return { label: "Found by TennisConnect", name: input.name };
  return { label: null, name: null };
}
