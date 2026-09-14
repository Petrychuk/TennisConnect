import type { SeasonWithCounts } from "@/lib/api/organizer-sessions";

export type SeasonStatus = "upcoming" | "active" | "completed";

// Status is never stored - always derived from today vs
// startDate/endDate (both plain YYYY-MM-DD strings, so a simple
// string comparison is enough and avoids timezone edge cases a Date
// comparison would introduce). Matches the spec's own explicit rule:
// the organiser should never have to keep a status field in sync by
// hand.
export function seasonStatus(season: Pick<SeasonWithCounts, "startDate" | "endDate">): SeasonStatus {
  const today = new Date().toISOString().slice(0, 10);
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
  active: "bg-primary/10 text-primary",
  completed: "bg-muted text-muted-foreground",
};

export function formatSeasonPeriod(season: Pick<SeasonWithCounts, "startDate" | "endDate">): string {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(season.startDate)} – ${fmt(season.endDate)}`;
}
