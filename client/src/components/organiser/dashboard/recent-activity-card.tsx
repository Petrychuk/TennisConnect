import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityFeedItem } from "@shared/schema";

interface RecentActivityCardProps {
  items: ActivityFeedItem[];
  className?: string;
}

const TYPE_ICON: Record<ActivityFeedItem["type"], typeof UserPlus> = {
  joined: UserPlus,
  checked_in: CheckCircle2,
};

function activityMessage(item: ActivityFeedItem): string {
  return item.type === "joined"
    ? `${item.userName} joined ${item.sessionTitle}`
    : `${item.userName} checked in for ${item.sessionTitle}`;
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// "View all" was previously a disabled/"coming soon" link - removed
// entirely rather than shown-but-unclickable, since there's not enough
// activity yet for a fuller view to be worth linking to.
export function RecentActivityCard({ items, className }: RecentActivityCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-recent-activity-card">
      <CardHeader>
        <CardTitle className="text-base">Activity Feed</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-activity-empty">
            No activity yet.
          </p>
        ) : (
          <ul className="space-y-3.5">
            {items.map((item) => {
              const Icon = TYPE_ICON[item.type];
              return (
                <li key={item.id} className="flex items-start gap-3" data-testid={`organiser-activity-${item.id}`}>
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{activityMessage(item)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.at)}</p>
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
