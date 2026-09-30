import { Button } from "@/components/ui/button";
import { MapPin, SlidersHorizontal, Trophy } from "lucide-react";
import type { PlayDateFilter } from "@/lib/play-status";

// Spec [PLAY] section 14 ("Reusable Event Components") - the compact
// quick-filter row that replaced the old permanent sidebar. Pure
// props-in/callbacks-out, no fetching or filtering logic of its own,
// so it can be reused anywhere else Play-style discovery shows up
// later (spec's own list: Play This Week, Social Tennis for You,
// Competitions for You, etc.) without dragging page-specific state
// along with it.
export interface PlayQuickFiltersProps {
  location: string;
  dateFilter: PlayDateFilter;
  competitionsOnly: boolean;
  isAuthenticated: boolean;
  onNearMe: () => void;
  onToggleThisWeek: () => void;
  onToggleThisWeekend: () => void;
  onToggleCompetitions: () => void;
  onOpenFilters: () => void;
}

export function PlayQuickFilters({
  location,
  dateFilter,
  competitionsOnly,
  isAuthenticated,
  onNearMe,
  onToggleThisWeek,
  onToggleThisWeekend,
  onToggleCompetitions,
  onOpenFilters,
}: PlayQuickFiltersProps) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0"
      data-testid="play-page-quick-filters"
    >
      <Button
        variant={location ? "default" : "outline"}
        size="sm"
        className="shrink-0 rounded-full"
        onClick={onNearMe}
        disabled={!isAuthenticated}
        title={!isAuthenticated ? "Sign in to filter by your own area" : undefined}
        data-testid="play-quick-filter-near-me"
      >
        <MapPin className="w-3.5 h-3.5 mr-1.5" /> Near me
      </Button>
      <Button
        variant={dateFilter === "this_week" ? "default" : "outline"}
        size="sm"
        className="shrink-0 rounded-full"
        onClick={onToggleThisWeek}
        data-testid="play-quick-filter-this-week"
      >
        This week
      </Button>
      <Button
        variant={dateFilter === "this_weekend" ? "default" : "outline"}
        size="sm"
        className="shrink-0 rounded-full"
        onClick={onToggleThisWeekend}
        data-testid="play-quick-filter-this-weekend"
      >
        This weekend
      </Button>
      <Button
        variant={competitionsOnly ? "default" : "outline"}
        size="sm"
        className="shrink-0 rounded-full"
        onClick={onToggleCompetitions}
        data-testid="play-quick-filter-competitions"
      >
        <Trophy className="w-3.5 h-3.5 mr-1.5" /> Competitions
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 rounded-full"
        onClick={onOpenFilters}
        data-testid="play-quick-filter-open"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters
      </Button>
    </div>
  );
}
