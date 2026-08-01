import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Clock, Star, TrendingUp, Trophy, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickStat } from "@/lib/organiser-hub-mock-data";

interface StatisticsCardProps {
  stats: QuickStat[];
  highlight?: string;
  onViewLeaderboard?: () => void;
  className?: string;
}

const STAT_ICON: Record<string, typeof Users> = {
  "avg-players": Users,
  "avg-length": Clock,
  satisfaction: Star,
  "attendance-rate": TrendingUp,
};

export function StatisticsCard({ stats, highlight, onViewLeaderboard, className }: StatisticsCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-statistics-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Quick Analytics</CardTitle>
        <span className="text-xs text-muted-foreground">This Week</span>
      </CardHeader>
      <CardContent className="space-y-5">
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-quick-analytics-empty">
            Run a few sessions and your analytics will show up here.
          </p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = STAT_ICON[stat.key] ?? Users;
            const DeltaIcon = stat.deltaDirection === "up" ? ArrowUp : ArrowDown;
            return (
              <div
                key={stat.key}
                className="rounded-xl border border-border p-3"
                data-testid={`organiser-quick-analytics-${stat.key}`}
              >
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className="text-[11px] text-primary flex items-center gap-0.5 mt-1">
                  <DeltaIcon className="w-3 h-3" />
                  {stat.deltaLabel}
                </p>
              </div>
            );
          })}
        </div>
        )}

        {highlight && (
          <div className="rounded-xl bg-primary/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              {highlight}
            </div>
            <Button size="sm" onClick={onViewLeaderboard} disabled={!onViewLeaderboard} title={!onViewLeaderboard ? "Coming soon" : undefined} data-testid="organiser-statistics-view-leaderboard">
              View Leaderboard
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
