import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Percent, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuickStat } from "@/lib/organiser-hub-mock-data";

interface StatisticsCardProps {
  stats: QuickStat[];
  className?: string;
}

const STAT_ICON: Record<string, LucideIcon> = {
  "avg-players": Users,
  "avg-capacity": Percent,
};

// Deliberately no "Smart Insight" banner here anymore - it was a
// hardcoded claim ("your attendance rate is one of the highest in your
// area") with no real comparison data behind it, exactly the kind of
// unsupported claim the spec calls out by name. A real insight needs
// real historical/comparison data to back it - worth adding once that
// exists, not worth faking until then.
export function StatisticsCard({ stats, className }: StatisticsCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-statistics-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle asChild className="text-base"><h2>Quick Analytics</h2></CardTitle>
        <span className="text-xs text-muted-foreground">This Week</span>
      </CardHeader>
      <CardContent>
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-quick-analytics-empty">
            Run a few sessions and your analytics will show up here.
          </p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = STAT_ICON[stat.key] ?? Users;
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
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
