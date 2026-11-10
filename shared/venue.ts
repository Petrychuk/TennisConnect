/*
  Pure helpers for a session's venue (server/services/venueLookup.ts and the
  public session page). No network, no database - unit-tested in venue.test.ts.
*/

/** "Australia/Sydney" -> "Sydney". */
export function cityFromTimeZone(timeZone: string | null | undefined): string {
  const part = (timeZone ?? "").split("/").pop() ?? "";
  return part.replace(/_/g, " ");
}

export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A club counts only on an exact name match (case and punctuation aside). */
export function findClubByVenueName<T extends { name: string }>(venue: string, clubs: T[]): T | undefined {
  const key = norm(venue);
  if (!key) return undefined;
  return clubs.find((c) => norm(c.name) === key);
}

/** Nominatim's address parts -> "12 Example Rd, Moore Park NSW 2021". */
export function formatNominatimAddress(addr: Record<string, string> | null | undefined): string | null {
  if (!addr) return null;
  const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
  const locality = addr.suburb || addr.town || addr.village || addr.city_district || addr.city || "";
  const state = STATE_ABBR[addr.state ?? ""] ?? addr.state ?? "";
  const tail = [locality, [state, addr.postcode].filter(Boolean).join(" ")].filter(Boolean).join(" ");
  const out = [street, tail].filter(Boolean).join(", ");
  return out || null;
}

const STATE_ABBR: Record<string, string> = {
  "New South Wales": "NSW",
  Victoria: "VIC",
  Queensland: "QLD",
  "Western Australia": "WA",
  "South Australia": "SA",
  Tasmania: "TAS",
  "Australian Capital Territory": "ACT",
  "Northern Territory": "NT",
};

/**
 * Web-Mercator pixel position of a point at a zoom level (256px tiles, the
 * OpenStreetMap tile scheme) - used to place map tiles around a venue pin.
 */
export function tilePixel(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const lat = (Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * scale,
  };
}

/** "Australia/Sydney" style city + venue -> the Google Maps search for the court. */
export function venueMapsQuery(venue: string, timeZone: string | null | undefined): string {
  const city = cityFromTimeZone(timeZone);
  return city ? `${venue}, ${city}` : venue;
}
