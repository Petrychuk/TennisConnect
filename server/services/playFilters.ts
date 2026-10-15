// [PLAY] Soft filter rules for the Play list.
//
// A filter the player did NOT choose themselves (pre-filled from their
// profile) must never hide sessions they could actually play in. Two rules:
//   - Level: "Intermediate" also matches sessions open to every level
//     ("All Levels") and sessions that don't state one (common for
//     discovered events). It only excludes sessions that name another level.
//   - Location: a profile location like "Sydney, NSW" is several terms, any
//     of which may match ("Sydney" in a suburb, "NSW" in an address). A plain
//     single word stays a single term, so a typed filter behaves as before.
//
// Pure and dependency-free so both rules can be tested without a database.

const IGNORED_TERMS = new Set(["australia", "au"]);

/** Search terms for a free-text location filter: comma-separated parts, at most 3. */
export function locationTerms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const part of raw.split(",")) {
    const term = part.trim();
    const key = term.toLowerCase();
    if (!term || IGNORED_TERMS.has(key) || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  return terms.slice(0, 3);
}

/** Level values that satisfy a level filter. A session with no level also does (see matchesLevel). */
export function softLevelValues(level: string): string[] {
  return level.toLowerCase() === "all levels" ? [level] : [level, "All Levels"];
}

/** Same rule in plain JS, for tests and in-memory filtering. */
export function matchesLevel(sessionLevel: string | null | undefined, wanted: string): boolean {
  if (!sessionLevel || !sessionLevel.trim()) return true;
  return softLevelValues(wanted).some((v) => v.toLowerCase() === sessionLevel.trim().toLowerCase());
}
