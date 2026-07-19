import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Download, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface ResultsTabProps {
  session: SessionListItem;
}

const mockStandings = [
  { rank: 1, name: "Alex Brown", points: 1250 },
  { rank: 2, name: "Kate Smith", points: 1180 },
  { rank: 3, name: "Emma Wilson", points: 1090 },
  { rank: 4, name: "Michael Lee", points: 980 },
];

export function ResultsTab({ session }: ResultsTabProps) {
  const { toast } = useToast();

  if (!session.resultsPublished) {
    return (
      <Card className="shadow-sm" data-testid="organiser-session-results-tab">
        <CardContent className="py-16 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Results aren't published yet</p>
          <p className="text-sm mt-1">
            {session.status === "live" ? "They'll appear here once the session finishes." : "They'll appear here once you publish them."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm" data-testid="organiser-session-results-tab">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Final Standings
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => toast({ title: "Export isn't wired up yet" })} data-testid="organiser-session-results-export">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {mockStandings.map((entry) => (
          <div key={entry.rank} className="flex items-center gap-3" data-testid={`organiser-session-results-${entry.rank}`}>
            <span className="w-5 text-sm font-bold text-muted-foreground text-center shrink-0">{entry.rank}</span>
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{entry.name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm flex-1">{entry.name}</span>
            <span className="text-sm font-semibold">{entry.points.toLocaleString()} pts</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
