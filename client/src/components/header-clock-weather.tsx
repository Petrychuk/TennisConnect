import { useEffect, useState } from "react";
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog } from "lucide-react";

// WMO weather codes (used by Open-Meteo) collapsed down to a handful of
// icons — this is a compact header widget, not a forecast page.
function weatherIcon(code: number) {
  if (code === 0) return Sun;
  if ([1, 2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Sun;
}

export function HeaderClockWeather() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<{ temperature: number; weatherCode: number } | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 30_000); // once every 30s is plenty for a clock display
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      try {
        const res = await fetch("/api/weather/sydney");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setWeather(data);
      } catch {
        // header widget — fail silently, just don't show the temperature
      }
    }

    loadWeather();
    const interval = setInterval(loadWeather, 15 * 60 * 1000); // refresh every 15 min
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const time = now.toLocaleTimeString("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
  });

  const WeatherIcon = weather ? weatherIcon(weather.weatherCode) : null;

  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-muted/40 text-xs font-medium text-muted-foreground whitespace-nowrap"
      data-testid="header-clock-weather"
    >
      <span>{time}</span>
      <span className="opacity-40">/</span>
      <span>{date}</span>
      <span className="opacity-40">/</span>
      <span>Sydney</span>
      {weather && WeatherIcon && (
        <span className="flex items-center gap-1 text-primary font-semibold" data-testid="header-weather-temp">
          <WeatherIcon className="w-3.5 h-3.5" />
          {weather.temperature}°C
        </span>
      )}
    </div>
  );
}
