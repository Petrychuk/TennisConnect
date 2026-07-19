import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shuffle, Repeat, Trophy, Ruler } from "lucide-react";
import { getSessionDetail, type SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface FormatRulesTabProps {
  session: SessionListItem;
}

export function FormatRulesTab({ session }: FormatRulesTabProps) {
  const detail = getSessionDetail(session);

  const items = [
    { icon: Shuffle, title: "Format", description: detail.format },
    { icon: Repeat, title: "Rounds", description: detail.roundsDescription },
    { icon: Trophy, title: "Scoring", description: "Games won across all rounds, then games-vs-opponent as tiebreak." },
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
