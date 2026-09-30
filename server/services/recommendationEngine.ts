// Deterministic Player <-> Event matching for Play's "Recommended for
// You". No LLM anywhere in this file - a fixed weighting over a
// handful of signals, normalised when player-profile data is missing
// rather than penalising the player for not having filled everything
// in. See the spec's own worked example: matched=55 out of an
// available=65 (not 100) -> 85%, not 55%.
//
// Reason codes are returned as short symbolic strings (SIMILAR_LEVEL,
// NEARBY, etc.) - the UI is what turns these into player-friendly
// sentences (playRecommendationReasonText below), never technical
// scoring language, per the spec's explicit "bad: location weighting
// contributed 18%" example.

export type RecommendationReasonCode =
  | "SIMILAR_LEVEL"
  | "CLOSE_LEVEL"
  | "MATCHING_AVAILABILITY"
  // NEARBY is intentionally unused right now - see the Distance
  // section below for why. Kept in the type so the follow-up
  // (radius-based distance matching) doesn't need to touch every
  // caller again once it lands.
  | "NEARBY"
  | "PREFERRED_FORMAT"
  | "PREFERRED_STYLE"
  | "LOOKING_FOR_COMPETITIONS"
  | "LOOKING_FOR_DOUBLES";

export interface RecommendationPlayerInput {
  skillLevel?: string | null; // Beginner / Intermediate / Advanced / Pro
  preferredCourts?: string[] | null;
  playRadiusKm?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  availability?: string[] | null; // "Weekday evenings", "Saturday", "Sunday", ...
  gameFormat?: string | null; // Singles / Doubles / Both
  playStyle?: string | null; // Social / Competitive / Both
  lookingFor?: string[] | null;
}

export interface RecommendationEventInput {
  id: string;
  type: string; // SESSION_TYPE_OPTIONS key
  skillLevel?: string | null; // the event's own accepted level, if organiser set one
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startAt: string; // ISO
  timeZone?: string | null; // IANA zone - when omitted, startAt is read in the server's own local time (only safe for tests/local data with no real zone attached)
  playStatus: string; // PublicSessionStatus
  registeredCount: number;
  maxParticipants?: number | null;
  waitingListEnabled?: boolean;
  matchFormat?: string | null; // singles / doubles / mixed, when the event exposes one
}

export interface RecommendationResult {
  score: number; // 0-100, only ever computed for an eligible event
  reasons: RecommendationReasonCode[];
}

const SKILL_LEVEL_ORDER = ["Beginner", "Intermediate", "Advanced", "Pro"];

// Standard haversine great-circle distance, in km. Accurate enough for
// "is this within my preferred radius" - no need for anything more
// precise (ellipsoidal models etc.) at this scale.
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
 * Returns the real distance in km, or null when either side's
 * coordinates are missing - callers must treat null as "unknown", not
 * "far away". Exported so a caller (e.g. the Play route) can show an
 * honest "4.8 km away" in the UI wherever both sides happen to have
 * coordinates, independent of whether the match score itself uses it.
 */
export function computeDistanceKm(
  player: Pick<RecommendationPlayerInput, "latitude" | "longitude">,
  event: Pick<RecommendationEventInput, "latitude" | "longitude">
): number | null {
  if (player.latitude == null || player.longitude == null || event.latitude == null || event.longitude == null) {
    return null;
  }
  return haversineKm(player.latitude, player.longitude, event.latitude, event.longitude);
}

// Coarse day/time -> availability-bucket mapping, resolved in the
// EVENT's own IANA time zone when one is supplied (a session already
// carries its own zone elsewhere in this codebase) - "Thursday
// evening" means the tennis club's Thursday evening, never the
// server's. Falls back to the server's local time only when no zone
// is given (tests, or any caller that hasn't wired timeZone through
// yet), so this degrades gracefully rather than throwing.
function availabilityBucketsFor(startAtIso: string, timeZone?: string | null): string[] {
  let day: number;
  let hour: number;
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date(startAtIso));
    const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    day = weekdayMap[weekdayShort] ?? new Date(startAtIso).getDay();
    hour = parseInt(hourStr, 10) % 24;
  } else {
    const d = new Date(startAtIso);
    day = d.getDay();
    hour = d.getHours();
  }

  const buckets: string[] = [];
  if (day === 6) buckets.push("Saturday");
  if (day === 0) buckets.push("Sunday");
  if (day >= 1 && day <= 5) {
    buckets.push(hour < 12 ? "Weekday mornings" : "Weekday evenings");
  }
  return buckets;
}

/**
 * Hard eligibility - these exclude an event from recommendations
 * entirely rather than lowering its score (spec section 4). Building
 * on top of getPublicSessions, which already excludes draft/
 * archived/private/cancelled/unpublished/completed sessions at the
 * query level - this only adds the two checks that need the PLAYER's
 * own data to evaluate (registration availability, level mismatch).
 */
export function isEventEligibleForPlayer(
  player: RecommendationPlayerInput,
  event: RecommendationEventInput
): boolean {
  // No room and no waiting list - nothing to recommend into.
  if (event.playStatus === "full") return false;
  if (event.playStatus === "closed") return false;

  // A hard level mismatch: the organiser set an accepted level and the
  // player's own level is more than one step away from it. One step
  // (e.g. Intermediate event, Advanced player) is still a real,
  // scoreable match (CLOSE_LEVEL below) - two or more steps apart is
  // treated as a hard exclusion, not just a lower score, in the
  // absence of a real UTR-range field on the event to compare against
  // directly.
  if (event.skillLevel && player.skillLevel) {
    const eventIdx = SKILL_LEVEL_ORDER.indexOf(event.skillLevel);
    const playerIdx = SKILL_LEVEL_ORDER.indexOf(player.skillLevel);
    if (eventIdx !== -1 && playerIdx !== -1 && Math.abs(eventIdx - playerIdx) >= 2) {
      return false;
    }
  }

  return true;
}

/**
 * Computes a 0-100 match score + reason codes for one ELIGIBLE event.
 * Callers must check isEventEligibleForPlayer first - this function
 * doesn't re-check hard rules, only scores.
 *
 * Weights (spec section 3): Level 30, Availability 25, Distance 20,
 * Game format 15, Intent/play style 10. When a signal's underlying
 * player data is missing, its weight is excluded from BOTH the
 * matched total and the available total - the score is then out of
 * whatever was actually available, never penalised as a mismatch.
 */
export function computeRecommendation(
  player: RecommendationPlayerInput,
  event: RecommendationEventInput
): RecommendationResult {
  let matched = 0;
  let available = 0;
  const reasons: RecommendationReasonCode[] = [];

  // Level (30)
  if (player.skillLevel) {
    available += 30;
    if (!event.skillLevel) {
      // No organiser-set level restriction - open to everyone, treat
      // as a full match rather than unknown.
      matched += 30;
    } else {
      const eventIdx = SKILL_LEVEL_ORDER.indexOf(event.skillLevel);
      const playerIdx = SKILL_LEVEL_ORDER.indexOf(player.skillLevel);
      const gap = Math.abs(eventIdx - playerIdx);
      if (gap === 0) {
        matched += 30;
        reasons.push("SIMILAR_LEVEL");
      } else if (gap === 1) {
        matched += 18;
        reasons.push("CLOSE_LEVEL");
      }
    }
  }

  // Availability (25)
  if (player.availability && player.availability.length > 0) {
    available += 25;
    const eventBuckets = availabilityBucketsFor(event.startAt, event.timeZone);
    if (eventBuckets.some((b) => player.availability!.includes(b))) {
      matched += 25;
      reasons.push("MATCHING_AVAILABILITY");
    }
  }

  // Distance/location (spec weight: 20) - real haversine distance
  // against the player's own preferred radius, only when BOTH sides
  // have coordinates. Neither field is populated anywhere yet (no
  // geocoding or manual-entry UI - see the schema comments on
  // player_profiles.latitude/sessions.latitude), so this signal is
  // simply unavailable for everyone until that's built - the moment
  // it's not, no code here needs to change again. Distance inside the
  // radius scores full weight; outside it scores proportionally less
  // down to 0 at 2x the radius, never negative.
  const distanceKm = computeDistanceKm(player, event);
  if (distanceKm != null && player.playRadiusKm != null && player.playRadiusKm > 0) {
    available += 20;
    if (distanceKm <= player.playRadiusKm) {
      matched += 20;
      reasons.push("NEARBY");
    } else if (distanceKm <= player.playRadiusKm * 2) {
      // Linear falloff from full credit at the radius to zero at 2x it -
      // "weak match" per the spec's own worked example (27 km vs a
      // 15 km radius), not a hard cliff.
      const fraction = 1 - (distanceKm - player.playRadiusKm) / player.playRadiusKm;
      matched += Math.round(20 * fraction);
      if (fraction >= 0.5) reasons.push("NEARBY");
    }
  }

  // Game format (spec weight: 15) - only counted when the event
  // actually exposes a real singles/doubles/mixed value. Sessions
  // don't carry that field yet (PublicSessionCard has no gameFormat/
  // matchFormat column - found this gap while building Smart Search),
  // so right now this is always available=0/matched=0 for everyone,
  // same honest "signal not yet backed by real data" treatment as
  // Distance was before real coordinates existed. Previously this
  // added 15 to `available` whenever the PLAYER had a preference, with
  // no way to ever match it - silently dragging every such player's
  // score down. Fixed to gate on the event actually having the data.
  if (player.gameFormat && player.gameFormat !== "Both" && event.matchFormat) {
    available += 15;
    if (event.matchFormat.toLowerCase() === player.gameFormat.toLowerCase()) {
      matched += 15;
      reasons.push(player.gameFormat === "Doubles" ? "LOOKING_FOR_DOUBLES" : "PREFERRED_FORMAT");
    }
  }

  // Intent / play style (10)
  const hasIntentSignal = (player.playStyle && player.playStyle !== "Both") || (player.lookingFor?.length ?? 0) > 0;
  if (hasIntentSignal) {
    available += 10;
    const isCompetitionEvent = ["tournament", "league", "club-championship", "junior-event"].includes(event.type);
    if (player.playStyle === "Competitive" && isCompetitionEvent) {
      matched += 10;
      reasons.push("PREFERRED_STYLE");
    } else if (player.lookingFor?.includes("Playing Events") && isCompetitionEvent) {
      matched += 10;
      reasons.push("LOOKING_FOR_COMPETITIONS");
    } else if (player.playStyle === "Social" && !isCompetitionEvent) {
      matched += 10;
      reasons.push("PREFERRED_STYLE");
    }
  }

  const score = available > 0 ? Math.round((matched / available) * 100) : 0;
  // At most 3 reasons shown (spec section 5: "2-3 simple reasons"),
  // highest-weighted signals first (the order they were evaluated in
  // above already follows the spec's own weighting).
  return { score, reasons: reasons.slice(0, 3) };
}

/**
 * True once there's enough real signal to show an honest percentage
 * at all (spec section 8) - a brand new profile with just a location
 * set shouldn't be told "95% match", it should see a neutral
 * "Popular near you" heading instead. The threshold is deliberately
 * low (any two signals present) rather than requiring a fully
 * completed profile - spec section 6 is explicit that recommendations
 * must work with incomplete profiles.
 */
export function hasEnoughSignalForPersonalisation(player: RecommendationPlayerInput): boolean {
  let signalCount = 0;
  if (player.skillLevel) signalCount++;
  if (player.availability && player.availability.length > 0) signalCount++;
  if (player.preferredCourts && player.preferredCourts.length > 0) signalCount++;
  if (player.gameFormat) signalCount++;
  if (player.playStyle || (player.lookingFor && player.lookingFor.length > 0)) signalCount++;
  return signalCount >= 2;
}
