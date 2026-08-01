import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, CheckCircle2, XCircle, MessageSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/organiser-hub-mock-data";

interface RecentActivityCardProps {
  items: ActivityItem[];
  className?: string;
}

const KIND_ICON: Record<ActivityItem["kind"], typeof UserPlus> = {
  registration: UserPlus,
  join: UserPlus,
  checkin: CheckCircle2,
  cancellation: XCircle,
  message: MessageSquare,
};

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function RecentActivityCard({ items, className }: RecentActivityCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-recent-activity-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Activity Feed</CardTitle>
        <span
          className="text-xs font-medium text-muted-foreground/70 flex items-center gap-0.5 cursor-not-allowed"
          data-testid="organiser-activity-view-all"
          title="Coming soon"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </span>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-activity-empty">
            No activity yet.
          </p>
        ) : (
          <ul className="space-y-3.5">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id} className="flex items-start gap-3" data-testid={`organiser-activity-${item.id}`}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
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
