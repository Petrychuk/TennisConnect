import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, UserPlus, CheckCircle2, XCircle, Clock3, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/organiser-hub-mock-data";

interface RecentActivityCardProps {
  items: ActivityItem[];
  className?: string;
}

const KIND_ICON: Record<ActivityItem["kind"], typeof UserPlus> = {
  registration: UserPlus,
  approval: CheckCircle2,
  rejection: XCircle,
  cancellation: Clock3,
  waitlist: Hourglass,
};

const KIND_COLOR: Record<ActivityItem["kind"], string> = {
  registration: "bg-primary/10 text-primary",
  approval: "bg-green-100 text-green-700",
  rejection: "bg-destructive/10 text-destructive",
  cancellation: "bg-orange-100 text-orange-700",
  waitlist: "bg-blue-100 text-blue-700",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function RecentActivityCard({ items, className }: RecentActivityCardProps) {
  return (
    <Card className={cn(className)} data-testid="organiser-hub-recent-activity-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-hub-activity-empty">
            No activity yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id} className="flex items-start gap-3" data-testid={`organiser-hub-activity-${item.id}`}>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5", KIND_COLOR[item.kind])}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{item.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.timestamp)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
