import type { PublicSessionStatus } from "@shared/schema";

// Player-facing status labels/colors (spec §8) - never the organiser's
// own draft/pending_review/rejected/live-internal vocabulary.
export const PLAY_STATUS_LABEL: Record<PublicSessionStatus, string> = {
  live: "Live",
  upcoming: "Upcoming",
  open: "Registration Open",
  almost_full: "Almost Full",
  full: "Full",
  waitlist: "Waiting List",
  closed: "Registration Closed",
};

export const PLAY_STATUS_STYLE: Record<PublicSessionStatus, string> = {
  live: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  open: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  almost_full: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  full: "bg-muted text-muted-foreground",
  waitlist: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  closed: "bg-muted text-muted-foreground",
};

export type PlayDateFilter = "any" | "today" | "this_week" | "this_weekend" | "next_7_days" | "custom";

export const PLAY_DATE_FILTER_OPTIONS: { value: PlayDateFilter; label: string }[] = [
  { value: "any", label: "Any Date" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_weekend", label: "This Weekend" },
  { value: "next_7_days", label: "Next 7 Days" },
  { value: "custom", label: "Choose Date" },
];

// Resolves a PlayDateFilter into an absolute [from, to] range, "now"
// being when the person is actually browsing - kept out of the API
// layer so it's trivially unit-testable and never depends on the
// server's own clock/timezone.
export function resolveDateFilterRange(filter: PlayDateFilter, customDate?: string): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const endOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy;
  };

  switch (filter) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "this_week": {
      const day = now.getDay(); // 0 = Sunday
      const daysUntilSunday = 7 - day;
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + daysUntilSunday);
      return { from: startOfDay(now), to: endOfDay(endOfWeek) };
    }
    case "this_weekend": {
      const day = now.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7;
      const saturday = new Date(now);
      saturday.setDate(now.getDate() + daysUntilSaturday);
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      return { from: startOfDay(saturday), to: endOfDay(sunday) };
    }
    case "next_7_days": {
      const end = new Date(now);
      end.setDate(now.getDate() + 7);
      return { from: startOfDay(now), to: endOfDay(end) };
    }
    case "custom":
      if (!customDate) return {};
      return { from: startOfDay(new Date(customDate)), to: endOfDay(new Date(customDate)) };
    case "any":
    default:
      return {};
  }
}

// Session levels a player actually recognises (see
// client/src/lib/skillLevel.ts) - "All Levels" is the filter's own
// "no restriction" option, not a real skillLevel value stored on a
// session.
export const PLAY_LEVEL_OPTIONS = ["All Levels", "Beginner", "Intermediate", "Advanced"] as const;
