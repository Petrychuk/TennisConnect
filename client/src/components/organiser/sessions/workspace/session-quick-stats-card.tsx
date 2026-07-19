import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, TrendingUp, Clock, Star, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionQuickStat, SessionTopPlayer } from "@/lib/organiser-sessions-mock-data";

interface SessionQuickStatsCardProps {
  stats: SessionQuickStat[];
  topPlayers: SessionTopPlayer[];
  extraCount?: number;
}

const STAT_ICON: Record<string, typeof Users> = {
  "avg-players": Users,
  "attendance-rate": TrendingUp,
  "avg-length": Clock,
  satisfaction: Star,
};

export function SessionQuickStatsCard({ stats, topPlayers, extraCount = 0 }: SessionQuickStatsCardProps) {
  return (
    <Card className="shadow-sm" data-testid="organiser-session-quick-stats-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Quick Stats</CardTitle>
        <span className="text-xs text-muted-foreground">This Week</span>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = STAT_ICON[stat.key] ?? Users;
            const DeltaIcon = stat.deltaDirection === "up" ? ArrowUp : ArrowDown;
            return (
              <div key={stat.key} className="rounded-xl border border-border p-3" data-testid={`organiser-session-quick-stat-${stat.key}`}>
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

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Top Players <span className="text-muted-foreground font-normal">By Attendance</span></p>
          <div className="flex items-center" data-testid="organiser-session-top-players">
            {topPlayers.map((player, i) => (
              <Avatar
                key={player.id}
                className={cn("h-8 w-8 border-2 border-card", i > 0 && "-ml-2")}
                data-testid={`organiser-session-top-player-${player.id}`}
              >
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {player.name[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            {extraCount > 0 && (
              <div className="h-8 w-8 -ml-2 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                +{extraCount}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
