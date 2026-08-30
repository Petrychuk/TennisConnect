import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog } from "lucide-react";

// WMO weather codes (used by Open-Meteo) collapsed down to a handful of
// icons - shared by the header's current-weather widget and the
// create-session wizard's per-date forecast widget, so both read the
// same codes the same way instead of two copies drifting apart.
export function weatherIcon(code: number) {
  if (code === 0) return Sun;
  if ([1, 2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Sun;
}
