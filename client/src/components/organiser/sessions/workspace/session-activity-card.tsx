import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionActivityItem } from "@/lib/organiser-sessions-mock-data";

interface SessionActivityCardProps {
  items: SessionActivityItem[];
}

type Filter = "all" | SessionActivityItem["kind"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "players", label: "Players" },
  { key: "system", label: "System" },
  { key: "live", label: "Live" },
];

function formatActivityTime(iso: string) {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return isToday ? `Today, ${time}` : `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
}

export function SessionActivityCard({ items }: SessionActivityCardProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <Card className="shadow-sm" data-testid="organiser-session-activity-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <span className="text-xs font-medium text-primary flex items-center gap-0.5 cursor-pointer" data-testid="organiser-session-activity-view-all">
          View all
          <ChevronRight className="w-3 h-3" />
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-1.5 flex-wrap" data-testid="organiser-session-activity-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                filter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/40"
              )}
              data-testid={`organiser-session-activity-filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-session-activity-empty">
            Nothing here.
          </p>
        ) : (
          <ul className="space-y-3.5">
            {visible.map((item) => (
              <li key={item.id} className="flex items-start gap-3" data-testid={`organiser-session-activity-${item.id}`}>
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{item.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatActivityTime(item.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
