// Curated, approximate coordinates for the places that actually appear
// in this app's own seed/demo data (server/seed*.ts) - NOT a real
// geocoding service, and NOT exhaustive (the full Sydney suburb
// autocomplete list in coach-profile.tsx has hundreds of entries this
// doesn't cover). Purpose: let distance-based recommendation testing
// actually work today without an external geocoding API/key, which
// this sandbox has no network access to add or verify.
//
// Coordinates are city/suburb-centre approximations, not exact venue
// addresses - accurate enough to test "is this within my radius",
// not for anything that needs precision.
//
// Usage: exact, case-insensitive match against a location string.
// Extend this table as needed; when real geocoding is eventually
// wired up, this whole file can be deleted without touching the
// engine itself (recommendationEngine.ts/playerMatchEngine.ts just
// consume whatever latitude/longitude they're given).
export const KNOWN_LOCATION_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  // Sydney
  "bondi beach": { latitude: -33.8908, longitude: 151.2743 },
  "manly": { latitude: -33.7969, longitude: 151.2878 },
  "manly, nsw": { latitude: -33.7969, longitude: 151.2878 },
  "sydney cbd": { latitude: -33.8688, longitude: 151.2093 },
  "coogee": { latitude: -33.9198, longitude: 151.2589 },
  "coogee, nsw": { latitude: -33.9198, longitude: 151.2589 },
  "chatswood": { latitude: -33.7969, longitude: 151.1830 },
  "chatswood, nsw": { latitude: -33.7969, longitude: 151.1830 },
  "rose bay": { latitude: -33.8656, longitude: 151.2701 },
  "rose bay, nsw": { latitude: -33.8656, longitude: 151.2701 },
  "rushcutters bay": { latitude: -33.8756, longitude: 151.2280 },
  "rushcutters bay, nsw": { latitude: -33.8756, longitude: 151.2280 },
  "paddington": { latitude: -33.8848, longitude: 151.2280 },
  "paddington, nsw": { latitude: -33.8848, longitude: 151.2280 },
  "kingsford": { latitude: -33.9187, longitude: 151.2280 },
  "kingsford, nsw": { latitude: -33.9187, longitude: 151.2280 },
  "homebush": { latitude: -33.8479, longitude: 151.0687 },
  "homebush, nsw": { latitude: -33.8479, longitude: 151.0687 },
  "olympic park tennis centre, sydney": { latitude: -33.8477, longitude: 151.0658 },
  "wolli creek": { latitude: -33.9308, longitude: 151.1439 },
  "parramatta": { latitude: -33.8150, longitude: 151.0011 },
  "parramatta, nsw": { latitude: -33.8150, longitude: 151.0011 },
  "moore park": { latitude: -33.8933, longitude: 151.2245 },
  "eastern suburbs": { latitude: -33.8933, longitude: 151.2500 },

  // Other Australian cities that show up in seed data
  "melbourne park, melbourne": { latitude: -37.8221, longitude: 144.9793 },
  "melbourne richmond": { latitude: -37.8183, longitude: 144.9963 },
  "brisbane newstead": { latitude: -27.4415, longitude: 153.0475 },
  "queensland tennis centre, brisbane": { latitude: -27.5167, longitude: 153.0333 },
  "perth subiaco": { latitude: -31.9483, longitude: 115.8267 },
  "state tennis centre, perth": { latitude: -31.9522, longitude: 115.9142 },
  "darwin tennis club, darwin": { latitude: -12.4634, longitude: 130.8456 },
  "memorial drive tennis centre, adelaide": { latitude: -34.9205, longitude: 138.5964 },
};

/**
 * Case-insensitive exact lookup. Returns null (never throws, never
 * guesses) when the location string isn't in the table - callers
 * should treat that exactly like "no coordinates available" everywhere
 * else in the distance-matching code, not as an error.
 */
export function lookupKnownCoordinates(location: string | null | undefined): { latitude: number; longitude: number } | null {
  if (!location) return null;
  return KNOWN_LOCATION_COORDINATES[location.trim().toLowerCase()] ?? null;
}
