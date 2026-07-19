import { Users, Star, UserPlus, RefreshCcw, ArrowUp } from "lucide-react";
import type { mockOrgPlayersSummary } from "@/lib/organiser-players-mock-data";

interface PlayersStatStripProps {
  summary: typeof mockOrgPlayersSummary;
}

export function PlayersStatStrip({ summary }: PlayersStatStripProps) {
  const items = [
    { key: "total", icon: Users, value: String(summary.totalPlayers), label: "Total Players", delta: summary.totalPlayersDelta },
    { key: "active", icon: Star, value: String(summary.activeThisSeason), label: "Active this season", delta: summary.activeThisSeasonDelta },
    { key: "new", icon: UserPlus, value: String(summary.newThisMonth), label: "New this month", delta: summary.newThisMonthDelta },
    { key: "return", icon: RefreshCcw, value: `${summary.returnRate}%`, label: "Return Rate", delta: summary.returnRateDelta },
    { key: "rating", icon: Star, value: summary.avgRating.toFixed(1), label: "Avg. Rating", delta: summary.avgRatingDelta },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="organiser-players-page-stat-strip">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="rounded-2xl border border-border p-4" data-testid={`organiser-players-page-stat-${item.key}`}>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold leading-tight">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-[11px] text-primary flex items-center gap-0.5 mt-1">
              <ArrowUp className="w-3 h-3" />
              {item.delta}
            </p>
          </div>
        );
      })}
    </div>
  );
}
