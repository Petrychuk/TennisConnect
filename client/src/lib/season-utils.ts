import type { SeasonWithCounts } from "@/lib/api/organizer-sessions";

export type SeasonStatus = "upcoming" | "active" | "completed";

/** Today's YYYY-MM-DD in a given IANA time zone (browser-side). */
function todayInZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Status is never stored - always derived from today vs
// startDate/endDate (both plain YYYY-MM-DD strings). "today" is
// resolved in the session/org timezone so that a Sydney organiser at
// 08:00 AEDT (still "yesterday" in UTC) sees the correct status.
// Falls back to Australia/Sydney when no timezone is supplied.
export function seasonStatus(
  season: Pick<SeasonWithCounts, "startDate" | "endDate">,
  timeZone = "Australia/Sydney"
): SeasonStatus {
  const today = todayInZone(timeZone);
  if (today < season.startDate) return "upcoming";
  if (today > season.endDate) return "completed";
  return "active";
}

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
};

export const SEASON_STATUS_STYLE: Record<SeasonStatus, string> = {
  upcoming: "bg-secondary text-secondary-foreground",
  active: "bg-primary/20 text-primary-text",
  completed: "bg-muted text-muted-foreground",
};

export function formatSeasonPeriod(season: Pick<SeasonWithCounts, "startDate" | "endDate">): string {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(season.startDate)} – ${fmt(season.endDate)}`;
}
