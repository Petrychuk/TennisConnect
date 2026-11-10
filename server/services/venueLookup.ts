/*
  Where a session is played, for the public session page's map: the
  court's name (the session's Venue), its street address and coordinates.

  Sessions only store the venue NAME (no address column), so the address is
  looked up automatically from that name - nothing extra to fill in:
    1. a published TennisConnect club with exactly that name (its address,
       coordinates and Google Maps link, as the club itself set them);
    2. otherwise OpenStreetMap's Nominatim, searching "<venue>, <city>,
       Australia" - the same free geocoder geocodingService.ts uses (no key;
       its policy asks for a real User-Agent and a light request rate, so
       results are cached in memory).
  Nothing found -> no address, no pin; the page still offers "Open in Google
  Maps" with the venue name as the search. Never a guess at a nearby place.
*/
import { storage } from "../storage";
import { cityFromTimeZone, findClubByVenueName, formatNominatimAddress, googleMapsSearchUrl } from "@shared/venue";

export interface VenueInfo {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Where the address came from; null when only the name is known. */
  source: "club" | "map" | null;
  googleMapsUrl: string;
}

const NOMINATIM_USER_AGENT = "TennisConnect/1.0 (+https://tennisconnect.com.au)";
const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: Omit<VenueInfo, "googleMapsUrl" | "name"> }>();

async function searchNominatim(query: string): Promise<Omit<VenueInfo, "googleMapsUrl" | "name"> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=au&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { address: formatNominatimAddress(results[0].address), latitude: lat, longitude: lon, source: "map" };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupVenue(session: {
  location: string | null;
  timeZone: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<VenueInfo | null> {
  const name = (session.location ?? "").trim();
  if (!name) return null;
  const city = cityFromTimeZone(session.timeZone);
  const query = [name, city, "Australia"].filter(Boolean).join(", ");

  const key = query.toLowerCase();
  const hit = cache.get(key);
  let found = hit && Date.now() - hit.at < CACHE_MS ? hit.value : null;
  let mapsUrl = googleMapsSearchUrl(`${name}, ${city}`);

  if (!found) {
    const club = findClubByVenueName(name, await storage.getPublishedClubs().catch(() => []));
    if (club) {
      const address = club.address || [club.suburb, club.state].filter(Boolean).join(" ") || null;
      found = { address, latitude: club.latitude ?? null, longitude: club.longitude ?? null, source: "club" };
      if (club.googleMapsUrl && /^https?:\/\//i.test(club.googleMapsUrl)) mapsUrl = club.googleMapsUrl;
    } else {
      found = await searchNominatim(query);
    }
    if (found) cache.set(key, { at: Date.now(), value: found });
  }

  // Coordinates the session itself carries win over a looked-up pin.
  const latitude = session.latitude ?? found?.latitude ?? null;
  const longitude = session.longitude ?? found?.longitude ?? null;
  return {
    name,
    address: found?.address ?? null,
    latitude,
    longitude,
    source: found?.source ?? null,
    googleMapsUrl: mapsUrl,
  };
}
