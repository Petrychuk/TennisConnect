import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";

// Spec [PLAY] section 6/14: "replace the large empty layout" - two
// distinct states (no matches for the current filters vs genuinely no
// published activities yet), extracted so any future Play-style block
// (Social Tennis for You, Competitions for You, etc.) can reuse the
// same two states instead of re-writing this copy each time.
export function PlayNoMatches({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16" data-testid="play-page-no-matches">
      <Search className="w-8 h-8 text-muted-foreground" />
      <div>
        <p className="font-semibold">No games found</p>
        <p className="text-sm text-muted-foreground mt-1">Try changing your date, location or filters.</p>
      </div>
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClearFilters} data-testid="play-page-clear-filters">
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function PlayNoActivitiesYet() {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-16" data-testid="play-page-empty">
      <Sparkles className="w-8 h-8 text-muted-foreground" />
      <div>
        <p className="font-semibold">New games are coming soon</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          TennisConnect organisers are adding new sessions and competitions.
        </p>
      </div>
    </div>
  );
}
