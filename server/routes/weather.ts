import { Router } from "express";

const router = Router();

// Sydney CBD coordinates — the header widget is Sydney-only for now.
const SYDNEY_LAT = -33.8688;
const SYDNEY_LON = 151.2093;

// Same 5 cities as AU_CITY_TIMEZONES (client/src/lib/timezone.ts) - keys
// match those labels exactly, since the wizard's forecast widget looks
// itself up by the same city the organizer already picked there.
const CITY_COORDS: Record<string, { lat: number; lon: number; timeZone: string }> = {
  Sydney: { lat: -33.8688, lon: 151.2093, timeZone: "Australia/Sydney" },
  Melbourne: { lat: -37.8136, lon: 144.9631, timeZone: "Australia/Melbourne" },
  Brisbane: { lat: -27.4698, lon: 153.0251, timeZone: "Australia/Brisbane" },
  Perth: { lat: -31.9505, lon: 115.8605, timeZone: "Australia/Perth" },
  Adelaide: { lat: -34.9285, lon: 138.6007, timeZone: "Australia/Adelaide" },
};

interface CachedWeather {
  temperature: number;
  weatherCode: number;
  fetchedAt: number;
}

let cache: CachedWeather | null = null;
let refreshing: Promise<void> | null = null;
const CACHE_MS = 10 * 60 * 1000; // 10 minutes — plenty fresh for a header widget
const FETCH_TIMEOUT_MS = 8000;

// Reads `cache` through a function rather than referencing the module
// variable directly. TypeScript's narrowing of a `let` doesn't get
// invalidated by an intervening `await` on a call that reassigns it
// (a known TS control-flow limitation), so a direct `if (cache)` after
// an earlier `if (cache) return` + `await refreshCache()` gets wrongly
// narrowed to `never`. Going through a function call sidesteps that -
// each call re-reads the current value with its declared type.
function getCache(): CachedWeather | null {
  return cache;
}

// Talks to Open-Meteo and updates `cache` on success. Never throws -
// callers don't need to handle failure, they just keep whatever was
// in `cache` before (possibly nothing, possibly stale).
async function refreshCache(): Promise<void> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&current=temperature_2m,weather_code&timezone=Australia%2FSydney`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Open-Meteo responded ${response.status}`);
    }

    const data = await response.json();
    const temperature = Math.round(data?.current?.temperature_2m);
    const weatherCode = data?.current?.weather_code ?? 0;

    if (Number.isNaN(temperature)) {
      throw new Error("Missing temperature in Open-Meteo response");
    }

    cache = { temperature, weatherCode, fetchedAt: Date.now() };
  } catch (error) {
    // Leave whatever's already in `cache` alone - a failed refresh
    // shouldn't wipe out the last good reading. Logged, not thrown:
    // this runs in the background, there's no request to fail here.
    console.error(
      "[weather] refresh failed:",
      error instanceof Error ? error.message : error
    );
  } finally {
    clearTimeout(timeout);
  }
}

// De-dupes concurrent refresh attempts (startup warm-up, the
// interval, and any request that notices a stale cache can all call
// this around the same time) down to a single in-flight fetch.
function triggerRefresh(): Promise<void> {
  if (!refreshing) {
    refreshing = refreshCache().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// Warm the cache as soon as the server boots, then keep it warm on a
// timer, so requests read from memory instead of waiting on
// Open-Meteo. This is what actually fixes the
// "[SLOW REQUEST] ... /api/weather/sydney ... 8014ms" pattern: before
// this, every request that landed on an expired (or never-populated)
// cache paid the full network round trip - and the full 8s timeout
// whenever Open-Meteo was slow or unreachable - before the client saw
// a response.
void triggerRefresh();
setInterval(() => void triggerRefresh(), CACHE_MS);

// GET /api/weather/sydney -> { temperature: number, weatherCode: number }
router.get("/sydney", async (_req, res) => {
  const cached = getCache();
  const isStale = !cached || Date.now() - cached.fetchedAt >= CACHE_MS;

  if (isStale) {
    // Stale-while-revalidate: kick a refresh off in the background,
    // but this request doesn't wait on it, ever - not even on cold
    // start. If Open-Meteo is slow or unreachable, that's this
    // refresh's problem to eventually resolve (or keep failing at),
    // not this request's.
    void triggerRefresh();
  }

  if (cached) {
    // Fresh or briefly stale, always served from memory - a slightly
    // old temperature beats a blank widget, and either way this
    // never blocks on the network.
    return res.json({ temperature: cached.temperature, weatherCode: cached.weatherCode });
  }

  // Cache hasn't been populated yet - either the first few seconds
  // after boot, or Open-Meteo has been unreachable for every attempt
  // so far. Either way, respond immediately rather than making this
  // request pay for the upstream's own timeout; the background
  // refresh kicked off above (or the next one on the interval) will
  // populate the cache for the next request.
  res.status(503).json({ message: "Weather unavailable" });
});

// GET /api/weather/forecast?city=Sydney&date=2026-09-15
// -> { available: true, date, tempMax, tempMin, weatherCode }
// -> { available: false, reason: "past" | "too_far" } when the date is
//    outside what a free-tier daily forecast actually covers - this is
//    for the "what will the weather be like for this session" widget in
//    the create-session wizard (organizer picks a date and a venue city
//    there), a genuinely different question from the header's "what's
//    it like right now" one above, which this doesn't touch.
//
// Open-Meteo's forecast endpoint only covers ~16 days ahead on the free
// tier - there's no long-range forecast to show beyond that, and
// guessing (e.g. from historical averages) would be presented as if it
// were a real forecast, which is worse than an honest "not available
// yet". No caching here (unlike /sydney) - every city+date combination
// is its own cache key and organizers aren't refreshing this every few
// seconds the way the header widget's viewers are.
const FORECAST_DAYS = 16;

router.get("/forecast", async (req, res) => {
  const city = String(req.query.city || "");
  const date = String(req.query.date || "");

  const coords = CITY_COORDS[city];
  if (!coords) {
    return res.status(400).json({ message: "Unknown city" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "date must be YYYY-MM-DD" });
  }

  // Today in the VENUE's own timezone, not the server's - a date that's
  // "yesterday" in Perth might still be "today" in Sydney depending on
  // when this runs, and the forecast's own day-index is built the same
  // venue-local way by Open-Meteo's `timezone` param below.
  const todayInVenue = new Intl.DateTimeFormat("en-CA", { timeZone: coords.timeZone }).format(new Date());
  if (date < todayInVenue) {
    return res.json({ available: false, reason: "past" });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(coords.timeZone)}` +
      `&forecast_days=${FORECAST_DAYS}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Open-Meteo responded ${response.status}`);
    }

    const data = await response.json();
    const days: string[] = data?.daily?.time ?? [];
    const idx = days.indexOf(date);

    if (idx === -1) {
      // Not an error - just genuinely beyond what a forecast can cover yet.
      return res.json({ available: false, reason: "too_far" });
    }

    const tempMax = Math.round(data.daily.temperature_2m_max[idx]);
    const tempMin = Math.round(data.daily.temperature_2m_min[idx]);
    const weatherCode = data.daily.weather_code[idx] ?? 0;

    if (Number.isNaN(tempMax) || Number.isNaN(tempMin)) {
      throw new Error("Missing temperature in Open-Meteo response");
    }

    res.json({ available: true, date, tempMax, tempMin, weatherCode });
  } catch (error) {
    res.status(503).json({ message: "Weather unavailable" });
  }
});

export default router;
