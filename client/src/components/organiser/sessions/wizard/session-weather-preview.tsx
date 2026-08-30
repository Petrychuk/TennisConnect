import { useEffect, useState } from "react";
import { weatherIcon } from "@/lib/weatherIcon";

interface ForecastResponse {
  available: boolean;
  reason?: "past" | "too_far";
  date?: string;
  tempMax?: number;
  tempMin?: number;
  weatherCode?: number;
}

interface SessionWeatherPreviewProps {
  city: string; // matches an AU_CITY_TIMEZONES label, e.g. "Sydney"
  date: string; // "YYYY-MM-DD"
}

// "What will the weather be like for this session" - a different
// question from the header's "what's it like right now" widget, which
// this doesn't touch or share state with. Shown in the wizard once both
// a date and a venue city are picked; a free-tier forecast only covers
// ~16 days out, so dates beyond that get an honest "not available yet"
// instead of a guessed number presented as if it were real.
export function SessionWeatherPreview({ city, date }: SessionWeatherPreviewProps) {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city || !date) {
      setForecast(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/weather/forecast?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`)
      .then((res) => res.json())
      .then((data: ForecastResponse) => {
        if (!cancelled) setForecast(data);
      })
      .catch(() => {
        if (!cancelled) setForecast(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, date]);

  if (!city || !date) return null;

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="session-weather-loading">
        Checking forecast for {city}…
      </p>
    );
  }

  if (!forecast) return null;

  if (!forecast.available) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="session-weather-unavailable">
        {forecast.reason === "past"
          ? "That date has already passed."
          : `Forecast for ${city} isn't available yet - check back closer to the date.`}
      </p>
    );
  }

  const Icon = weatherIcon(forecast.weatherCode ?? 0);

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="session-weather-forecast">
      <Icon className="w-4 h-4 shrink-0" />
      <span>
        {city} on this date: {forecast.tempMin}°–{forecast.tempMax}°C
      </span>
    </div>
  );
}
