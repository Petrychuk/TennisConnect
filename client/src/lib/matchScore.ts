// Real match scoring between two players' profiles, replacing the
// previous hardcoded 92%/mock reasons. Deliberately conservative about
// what it claims: there's no real geocoding/lat-lng in this app yet, so
// "distance" is approximated as "do they list any of the same
// preferred areas" rather than fabricating a specific km number - an
// honest, coarser signal instead of a precise-looking fake one.
//
// Scoring out of 100: level similarity (30), availability overlap (25),
// shared preferred areas (25), shared game format / looking-for goals
// (20). Each criterion that contributes any points also contributes
// its own human-readable reason string, so the reasons list always
// matches what was actually scored - never a static list independent
// of the number shown next to it.

const SKILL_LEVEL_ORDER = ["Social", "Beginner", "Intermediate", "Advanced", "Pro"];

export interface MatchProfileInput {
  skillLevel?: string;
  availability?: string[];
  preferredCourts?: string[];
  gameFormat?: string;
  lookingFor?: string[];
}

export interface MatchResult {
  percent: number;
  reasons: string[];
}

export function computeMatchScore(
  viewer: MatchProfileInput,
  owner: MatchProfileInput
): MatchResult {
  let score = 0;
  const reasons: string[] = [];

  // Level similarity (30)
  const vIdx = SKILL_LEVEL_ORDER.indexOf(viewer.skillLevel || "");
  const oIdx = SKILL_LEVEL_ORDER.indexOf(owner.skillLevel || "");
  if (vIdx !== -1 && oIdx !== -1) {
    const gap = Math.abs(vIdx - oIdx);
    if (gap === 0) {
      score += 30;
      reasons.push("Similar level");
    } else if (gap === 1) {
      score += 15;
      reasons.push("Close skill level");
    }
  }

  // Availability overlap (25) - proportional to how many shared slots,
  // capped at 25.
  const vAvail = viewer.availability || [];
  const oAvail = owner.availability || [];
  const sharedAvail = vAvail.filter((slot) => oAvail.includes(slot));
  if (sharedAvail.length > 0) {
    score += Math.min(25, sharedAvail.length * 12);
    reasons.push(
      sharedAvail.length === 1
        ? `Both available ${sharedAvail[0].toLowerCase()}`
        : "Overlapping availability"
    );
  }

  // Shared preferred areas (25) - a coarse "nearby" proxy, not real
  // distance (no geocoding exists yet).
  const vCourts = (viewer.preferredCourts || []).map((c) => c.toLowerCase().trim());
  const oCourts = (owner.preferredCourts || []).map((c) => c.toLowerCase().trim());
  const sharedArea = vCourts.some((c) => oCourts.includes(c));
  if (sharedArea) {
    score += 25;
    reasons.push("Plays in the same area");
  }

  // Shared game format or looking-for goals (20)
  let sharedGoal = false;
  if (viewer.gameFormat && viewer.gameFormat === owner.gameFormat) {
    sharedGoal = true;
    reasons.push(`Both prefer ${viewer.gameFormat.toLowerCase()}`);
  }
  const sharedLookingFor = (viewer.lookingFor || []).filter((tag) =>
    (owner.lookingFor || []).includes(tag)
  );
  if (sharedLookingFor.length > 0) {
    sharedGoal = true;
    reasons.push(`Both looking for ${sharedLookingFor[0].toLowerCase()}`);
  }
  if (sharedGoal) {
    score += 20;
  }

  return { percent: Math.min(100, score), reasons };
}
