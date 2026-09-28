// Shared geocoding, for players, coaches, clubs/organisations, and
// sessions alike - one service, one cache, used everywhere a location
// string needs coordinates.
//
// Lookup order, cheapest/most-trustworthy first:
//   1. The small hand-checked table (server/lib/knownLocationCoordinates.ts) -
//      instant, no network, no cache write needed (it's already a
//      permanent source).
//   2. The shared DB cache (geocode_cache table) - a location already
//      resolved once (by anyone: a player, a coach, a club) is never
//      looked up externally again.
//   3. OpenStreetMap's Nominatim (https://nominatim.openstreetmap.org) -
//      free, no API key required, which matters here since this app
//      has no existing geocoding provider/key configured and I have no
//      network access in this sandbox to add and test a paid one.
//      Nominatim's own usage policy requires a real User-Agent
//      identifying the application and no more than ~1 request/second -
//      easily satisfied here since every result gets cached permanently,
//      so the same location is only ever sent externally once.
//
// Every step is allowed to simply find nothing - this returns null
// rather than throwing, so a caller always has a safe "no coordinates
// available" path, exactly like every other optional signal in the
// recommendation/match engines.

import { storage } from "../storage";
import { lookupKnownCoordinates } from "../lib/knownLocationCoordinates";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const NOMINATIM_USER_AGENT = "TennisConnect/1.0 (+https://tennisconnect.com.au)";

async function fetchFromNominatim(location: string, countryCodes?: string): Promise<Coordinates | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const country = countryCodes ? `&countrycodes=${encodeURIComponent(countryCodes)}` : "";
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1${country}&q=${encodeURIComponent(location)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch {
    // Timeout, network error, or an unparseable response - all the
    // same outcome: no coordinates this time, never a thrown error the
    // caller has to handle specially.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolves a location string to coordinates, checking the curated
 * table and shared DB cache first, and only reaching out to Nominatim
 * (and caching the result) when neither already has it. Safe to call
 * from any profile/session save path - players, coaches, clubs,
 * sessions - with the same location string a person typed, no
 * per-entity-type logic needed here at all.
 */
export async function resolveCoordinates(
  location: string | null | undefined,
  options?: { countryCodes?: string }
): Promise<Coordinates | null> {
  if (!location || !location.trim()) return null;

  const known = lookupKnownCoordinates(location);
  if (known) return known;

  const cached = await storage.getCachedGeocode(location);
  if (cached) return cached;

  const external = await fetchFromNominatim(location, options?.countryCodes);
  if (external) {
    // Best-effort - if the cache write fails for some reason, the
    // caller still gets a usable result this one time; it'll just be
    // looked up externally again next time, not a broken feature.
    await storage.saveCachedGeocode(location, external.latitude, external.longitude, "nominatim").catch(() => {});
    return external;
  }

  return null;
}

/**
 * Coordinates for an externally discovered venue (Discovery Agent,
 * spec section 9). Australia-wide, so a bare suburb is NOT enough:
 * "Richmond" is a suburb in VIC, NSW, QLD and TAS. This resolves at
 * suburb level as "<suburb>, <state>, Australia" (restricted to
 * Australian results), and returns null - never a guess - when the state
 * is unknown ("do not guess coordinates if location cannot be
 * confidently resolved"). The hand-checked table is consulted first for
 * places that appear in this app's own data; its unqualified entries
 * are all Sydney locations, so those are only used for NSW.
 */
export async function resolveAustralianVenueCoordinates(input: {
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<Coordinates | null> {
  const place = (input.suburb || input.city || "").trim();
  const state = (input.state || "").trim().toUpperCase();
  if (!place || !state) return null;

  const curated =
    lookupKnownCoordinates(`${place}, ${state}`) ?? (state === "NSW" ? lookupKnownCoordinates(place) : null);
  if (curated) return curated;

  return resolveCoordinates(`${place}, ${state}, Australia`, { countryCodes: "au" });
}
