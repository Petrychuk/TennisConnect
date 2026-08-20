// player_profiles.skill_level is a free-text label (Beginner / Intermediate
// / Advanced / Social) - there's no numeric rating anywhere in the schema.
// This maps each label to an approximate UTR-style midpoint for display
// only, per product decision: Social has no meaningful numeric rating
// (it's the "just here to play, not to be ranked" tier), so it shows "-"
// rather than a made-up number.
const SKILL_LEVEL_MIDPOINT: Record<string, number> = {
  Beginner: 2.5,
  Intermediate: 3.5,
  Advanced: 4.5,
};

export function skillLevelToUtr(skillLevel: string | null | undefined): number | null {
  if (!skillLevel) return null;
  return SKILL_LEVEL_MIDPOINT[skillLevel] ?? null;
}

/** Display string for a UTR-style stat: "2.5" / "3.5" / "4.5", or "-" for Social / no level on file. */
export function formatSkillLevelUtr(skillLevel: string | null | undefined): string {
  const utr = skillLevelToUtr(skillLevel);
  return utr === null ? "-" : utr.toFixed(1);
}
