import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/organiser-hub-mock-data";

interface SeasonProgressCardProps {
  seasonLabel: string;
  weekLabel: string;
  progressPercent: number;
  leaderboard: LeaderboardEntry[];
  className?: string;
}

export function SeasonProgressCard({
  seasonLabel,
  weekLabel,
  progressPercent,
  leaderboard,
  className,
}: SeasonProgressCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-season-progress-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Season Overview</CardTitle>
        <span className="text-xs font-medium text-muted-foreground">{seasonLabel}</span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs text-muted-foreground mb-2">{weekLabel}</p>
          <Progress value={progressPercent} data-testid="organiser-season-progress-bar" />
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Leaderboard Top 3</p>
            <span
              className="text-xs font-medium text-muted-foreground/70 flex items-center gap-0.5 cursor-not-allowed"
              data-testid="organiser-leaderboard-view-full"
              title="Coming soon"
            >
              View full
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2" data-testid="organiser-leaderboard-empty">
              No results yet this season.
            </p>
          ) : (
            <div className="space-y-2.5">
              {leaderboard.map((entry) => (
                <div key={entry.rank} className="flex items-center gap-3" data-testid={`organiser-leaderboard-entry-${entry.rank}`}>
                  <span className="w-4 text-xs font-bold text-muted-foreground text-center shrink-0">
                    {entry.rank}
                  </span>
                  <Avatar className="h-6 w-6 border border-border">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                      {entry.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1 truncate">{entry.name}</span>
                  <span className="text-sm font-semibold">{entry.points.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
