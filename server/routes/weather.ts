import { Router } from "express";

const router = Router();

// Sydney CBD coordinates — the header widget is Sydney-only for now.
const SYDNEY_LAT = -33.8688;
const SYDNEY_LON = 151.2093;

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

export default router;
