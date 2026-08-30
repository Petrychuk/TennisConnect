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
const CACHE_MS = 10 * 60 * 1000; // 10 minutes — plenty fresh for a header widget

// GET /api/weather/sydney -> { temperature: number, weatherCode: number }
router.get("/sydney", async (_req, res) => {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_MS) {
      return res.json({ temperature: cache.temperature, weatherCode: cache.weatherCode });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&current=temperature_2m,weather_code&timezone=Australia%2FSydney`;
    const controller = new AbortController();
    // Same reasoning as emailService.ts/telegramService.ts - previously
    // no ceiling at all, so a slow Open-Meteo response would hold this
    // request open indefinitely instead of falling through to the
    // stale-cache fallback below, which is the whole point of having it.
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
    const temperature = Math.round(data?.current?.temperature_2m);
    const weatherCode = data?.current?.weather_code ?? 0;

    if (Number.isNaN(temperature)) {
      throw new Error("Missing temperature in Open-Meteo response");
    }

    cache = { temperature, weatherCode, fetchedAt: Date.now() };
    res.json({ temperature, weatherCode });
  } catch (error) {
    // If we have any cached value, even a stale one, prefer it over a
    // broken widget — a slightly old temperature is fine, a blank one isn't.
    if (cache) {
      return res.json({ temperature: cache.temperature, weatherCode: cache.weatherCode });
    }
    res.status(503).json({ message: "Weather unavailable" });
  }
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
