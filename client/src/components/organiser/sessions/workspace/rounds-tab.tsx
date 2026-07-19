import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Play, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface RoundsTabProps {
  session: SessionListItem;
}

export function RoundsTab({ session }: RoundsTabProps) {
  const hasStarted = session.status === "live" || session.status === "completed" || session.status === "archived";
  const roundTotal = session.roundTotal ?? 5;
  const roundCurrent = session.roundCurrent ?? 0;

  if (!hasStarted) {
    return (
      <Card className="shadow-sm" data-testid="organiser-session-rounds-tab">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="font-medium">Round 1 — Not Generated</p>
          <p className="text-sm mt-1">Rounds and court pairings appear here once the session goes live.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="organiser-session-rounds-tab">
      {Array.from({ length: roundTotal }, (_, i) => i + 1).map((roundNumber) => {
        const isCurrent = roundNumber === roundCurrent;
        const isDone = roundNumber < roundCurrent || session.status === "completed" || session.status === "archived";
        const isPending = !isCurrent && !isDone;

        return (
          <Card key={roundNumber} className={cn("shadow-sm", isCurrent && "border-primary/40")} data-testid={`organiser-session-round-${roundNumber}`}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isDone && <CheckCircle2 className="w-5 h-5 text-primary" />}
                {isCurrent && <Play className="w-5 h-5 text-primary" />}
                {isPending && <Hourglass className="w-5 h-5 text-muted-foreground" />}
                <div>
                  <p className="font-semibold">Round {roundNumber}</p>
                  {isCurrent && session.courts && (
                    <p className="text-xs text-muted-foreground">{session.courts.length} courts in play</p>
                  )}
                </div>
              </div>
              <Badge className={isCurrent ? "bg-primary text-primary-foreground" : isDone ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}>
                {isCurrent ? "In Progress" : isDone ? "Completed" : "Upcoming"}
              </Badge>
            </CardContent>
            {isCurrent && session.courts && session.courts.length > 0 && (
              <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {session.courts.map((court) => (
                  <div key={court.id} className="rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium text-center" data-testid={`organiser-session-round-${roundNumber}-court-${court.id}`}>
                    {court.label}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
