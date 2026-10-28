import { CalendarDays, CalendarHeart, MapPin, Trophy, Users } from "lucide-react";
import { HeroShortcuts } from "@/components/shared/hero-search";
import type { PlayDateFilter } from "@/lib/play-status";

// Spec [PLAY] section 14 ("Reusable Event Components") - the quick
// filters, shown as round icon shortcuts under the hero search. Pure
// props-in/callbacks-out, no fetching or filtering logic of its own:
// every shortcut only switches one of the page's existing filters
// (location, date, format, competitions). The Filters dialog opens from
// the sliders button inside the search bar.
export interface PlayQuickFiltersProps {
  location: string;
  dateFilter: PlayDateFilter;
  format: string;
  competitionsOnly: boolean;
  isAuthenticated: boolean;
  onNearMe: () => void;
  onToggleThisWeek: () => void;
  onToggleThisWeekend: () => void;
  onToggleSocial: () => void;
  onToggleCompetitions: () => void;
  /** "photo" on the hero image (tablet/desktop), "light" below it (phones). */
  tone?: "photo" | "light";
  className?: string;
  /** Test ids get this suffix (e.g. "-mobile") so both copies stay unique. */
  testIdSuffix?: string;
}

export function PlayQuickFilters({
  location,
  dateFilter,
  format,
  competitionsOnly,
  isAuthenticated,
  onNearMe,
  onToggleThisWeek,
  onToggleThisWeekend,
  onToggleSocial,
  onToggleCompetitions,
  tone = "photo",
  className,
  testIdSuffix = "",
}: PlayQuickFiltersProps) {
  return (
    <HeroShortcuts
      label="Quick filters"
      tone={tone}
      className={className}
      testId={`play-page-quick-filters${testIdSuffix}`}
      items={[
        {
          key: "competitions",
          label: "Tournaments",
          icon: <Trophy />,
          selected: competitionsOnly,
          onClick: onToggleCompetitions,
          testId: `play-quick-filter-competitions${testIdSuffix}`,
        },
        {
          key: "social",
          label: "Social Tennis",
          icon: <Users />,
          selected: format === "social",
          onClick: onToggleSocial,
          testId: `play-quick-filter-social${testIdSuffix}`,
        },
        {
          key: "near-me",
          label: "Near Me",
          icon: <MapPin />,
          selected: !!location,
          onClick: onNearMe,
          disabled: !isAuthenticated,
          title: !isAuthenticated ? "Sign in to filter by your own area" : undefined,
          testId: `play-quick-filter-near-me${testIdSuffix}`,
        },
        {
          key: "this-week",
          label: "This Week",
          icon: <CalendarDays />,
          selected: dateFilter === "this_week",
          onClick: onToggleThisWeek,
          testId: `play-quick-filter-this-week${testIdSuffix}`,
        },
        {
          key: "this-weekend",
          label: "This Weekend",
          icon: <CalendarHeart />,
          selected: dateFilter === "this_weekend",
          onClick: onToggleThisWeekend,
          testId: `play-quick-filter-this-weekend${testIdSuffix}`,
        },
      ]}
    />
  );
}
