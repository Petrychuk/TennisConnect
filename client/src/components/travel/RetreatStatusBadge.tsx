import { Badge } from "@/components/ui/badge";

// The one "Archived" label for an ended retreat's card - the same text,
// colours and position wherever a retreat card appears (home section,
// /travels). Neutral grey with white text (~7:1), so it reads as "past"
// rather than as a promotion; the screen-reader text says what it means.
// Whether a retreat is archived: lib/travelStatus.ts (isRetreatArchived).
export function RetreatArchivedBadge() {
  return (
    <Badge className="bg-muted-foreground text-white font-bold border-none" data-testid="retreat-archived-badge">
      Archived<span className="sr-only"> - this retreat has ended</span>
    </Badge>
  );
}
