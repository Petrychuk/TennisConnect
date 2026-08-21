import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shuffle, Repeat, Trophy, Ruler } from "lucide-react";
import { type SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface FormatRulesTabProps {
  session: SessionListItem;
}

export function FormatRulesTab({ session }: FormatRulesTabProps) {
  // Real fields (sessions.match_mode/category/games_to/no_ad/tiebreak/
  // planned_rounds_count) - this tab used to always show the same
  // hardcoded "Fun doubles · Random partners · Balance skill" via
  // getSessionDetail()'s mock fallback, regardless of what the
  // organizer actually picked in the wizard. Same real data
  // session-details-card.tsx's Overview cards already use.
  const formatLabel =
    session.matchMode == null
      ? "Not set"
      : session.category === "mens"
      ? `Men's ${session.matchMode === "singles" ? "Singles" : "Doubles"}`
      : session.category === "womens"
      ? `Women's ${session.matchMode === "singles" ? "Singles" : "Doubles"}`
      : session.matchMode === "singles"
      ? "Singles"
      : "Doubles";
  const roundsCount = session.roundTotal ?? session.plannedRoundsCount ?? null;
  const scoringLabel =
    session.gamesTo != null
      ? `First to ${session.gamesTo} games${session.noAd ? ", no-ad" : ""}${session.tiebreak ? ", tiebreak at deuce" : ""}.`
      : "Not set.";

  const items = [
    { icon: Shuffle, title: "Format", description: formatLabel },
    { icon: Repeat, title: "Rounds", description: roundsCount != null ? `${roundsCount} planned rounds.` : "Not set." },
    { icon: Trophy, title: "Scoring", description: scoringLabel },
    { icon: Ruler, title: "Court Assignment", description: "Random each round — partners and courts reshuffle to keep things fair." },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="organiser-session-format-tab">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="shadow-sm" data-testid={`organiser-session-format-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
