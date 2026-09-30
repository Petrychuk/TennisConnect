// Deterministic player <-> player matching for "Players Looking to
// Play" and the profile's own "Good Match for You" - ONE matching
// service powers both (spec section 13), same principle as
// recommendationEngine.ts: no LLM anywhere in here, a fixed weighting,
// missing data excluded from scoring rather than treated as a
// mismatch, and hard exclusions kept separate from the score itself.

export type PlayerMatchReasonCode =
  | "SIMILAR_LEVEL"
  | "CLOSE_LEVEL"
  | "SAME_AVAILABILITY"
  | "NEARBY"
  | "SAME_FORMAT"
  | "SAME_INTENT";

const SKILL_LEVEL_ORDER = ["Beginner", "Intermediate", "Advanced", "Pro"];

export interface MatchCandidateInput {
  userId: string;
  skillLevel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  playRadiusKm?: number | null;
  gameFormat?: string | null; // Singles / Doubles / Both (profile's general preference)
  playStyle?: string | null; // Social / Competitive / Both
  // "Looking to Play" specific fields - what THIS candidate is
  // available for right now, distinct from their general profile
  // preferences above.
  lookingToPlayEnabled: boolean;
  lookingToPlayExpiresAt: Date | null;
  lookingToPlayWhen?: "today" | "this_week" | "this_weekend" | null;
  lookingToPlayFormat?: "singles" | "doubles" | "either" | null;
  // Hard-exclusion inputs (spec section 8) - never used for scoring.
  isSelf?: boolean;
  isBlocked?: boolean;
  accountStatus?: string | null; // "active" means not deactivated/suspended
  isHiddenFromDiscovery?: boolean;
}

export interface PlayerMatchResult {
  score: number;
  reasons: PlayerMatchReasonCode[];
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * True if `candidate`'s Looking to Play status counts as ACTIVE right
 * now - enabled AND not past its own expiry. `now` is a parameter (not
 * `new Date()` inside) purely so tests can pin time deterministically.
 */
export function isLookingToPlayActive(candidate: Pick<MatchCandidateInput, "lookingToPlayEnabled" | "lookingToPlayExpiresAt">, now: Date): boolean {
  if (!candidate.lookingToPlayEnabled) return false;
  if (!candidate.lookingToPlayExpiresAt) return false;
  return candidate.lookingToPlayExpiresAt.getTime() > now.getTime();
}

/**
 * Computes when a freshly-enabled Looking to Play status should expire
 * (spec section 3), given the moment it was turned on. Pure/testable -
 * the actual "now" the caller uses when persisting this is up to them.
 */
export function computeLookingToPlayExpiry(when: "today" | "this_week" | "this_weekend", now: Date): Date {
  const result = new Date(now);
  if (when === "today") {
    result.setHours(23, 59, 59, 999);
    return result;
  }
  if (when === "this_week") {
    result.setDate(result.getDate() + 7);
    return result;
  }
  const day = result.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  result.setDate(result.getDate() + daysUntilSunday);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Hard exclusions (spec section 8) - these remove a candidate from
 * consideration entirely, never just lower their score.
 */
export function isPlayerEligibleForMatching(candidate: MatchCandidateInput, now: Date): boolean {
  if (candidate.isSelf) return false;
  if (candidate.isBlocked) return false;
  if (candidate.accountStatus && candidate.accountStatus !== "active") return false;
  if (candidate.isHiddenFromDiscovery) return false;
  if (!isLookingToPlayActive(candidate, now)) return false;
  return true;
}

/**
 * Scores two ELIGIBLE players against each other. Callers must run
 * isPlayerEligibleForMatching on the candidate first.
 */
export function computePlayerMatch(viewer: MatchCandidateInput, candidate: MatchCandidateInput): PlayerMatchResult {
  let matched = 0;
  let available = 0;
  const reasons: PlayerMatchReasonCode[] = [];

  if (viewer.skillLevel && candidate.skillLevel) {
    available += 30;
    const vIdx = SKILL_LEVEL_ORDER.indexOf(viewer.skillLevel);
    const cIdx = SKILL_LEVEL_ORDER.indexOf(candidate.skillLevel);
    if (vIdx !== -1 && cIdx !== -1) {
      const gap = Math.abs(vIdx - cIdx);
      if (gap === 0) {
        matched += 30;
        reasons.push("SIMILAR_LEVEL");
      } else if (gap === 1) {
        matched += 18;
        reasons.push("CLOSE_LEVEL");
      }
    }
  }

  if (viewer.lookingToPlayWhen && candidate.lookingToPlayWhen) {
    available += 25;
    if (viewer.lookingToPlayWhen === candidate.lookingToPlayWhen) {
      matched += 25;
      reasons.push("SAME_AVAILABILITY");
    }
  }

  if (
    viewer.latitude != null &&
    viewer.longitude != null &&
    candidate.latitude != null &&
    candidate.longitude != null &&
    viewer.playRadiusKm
  ) {
    available += 20;
    const km = haversineKm(viewer.latitude, viewer.longitude, candidate.latitude, candidate.longitude);
    if (km <= viewer.playRadiusKm) {
      matched += 20;
      reasons.push("NEARBY");
    } else if (km <= viewer.playRadiusKm * 2) {
      const fraction = 1 - (km - viewer.playRadiusKm) / viewer.playRadiusKm;
      matched += Math.round(20 * fraction);
      if (fraction >= 0.5) reasons.push("NEARBY");
    }
  }

  if (candidate.lookingToPlayFormat && candidate.lookingToPlayFormat !== "either" && viewer.gameFormat && viewer.gameFormat !== "Both") {
    available += 15;
    if (candidate.lookingToPlayFormat === viewer.gameFormat.toLowerCase()) {
      matched += 15;
      reasons.push("SAME_FORMAT");
    }
  }

  if (viewer.playStyle && candidate.playStyle && viewer.playStyle !== "Both" && candidate.playStyle !== "Both") {
    available += 10;
    if (viewer.playStyle === candidate.playStyle) {
      matched += 10;
      reasons.push("SAME_INTENT");
    }
  }

  const score = available > 0 ? Math.round((matched / available) * 100) : 0;
  return { score, reasons: reasons.slice(0, 3) };
}

/**
 * True once there's enough real signal to show an honest percentage at
 * all (spec section 7 - "Potential match" instead of a fake %).
 */
export function hasEnoughSignalForPlayerMatch(reasons: PlayerMatchReasonCode[]): boolean {
  return reasons.length > 0;
}
