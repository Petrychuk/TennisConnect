import { Link } from "wouter";
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
//
// Each row links to the session it happened in (Players tab, where the
// organizer would actually act on it) - a full per-player profile link
// would need slug/role joined in too, which the backend doesn't fetch
// for this feed yet; scoped to the session for now rather than half-
// building player-profile linking without that data.
export function RecentActivityCard({ items, className }: RecentActivityCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-recent-activity-card">
      <CardHeader>
        <CardTitle asChild className="text-base"><h2>Activity Feed</h2></CardTitle>
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
                <li key={item.id} data-testid={`organiser-activity-${item.id}`}>
                  <Link
                    href={`/organiser/sessions/${item.sessionId}?tab=players`}
                    className="flex items-start gap-3 -m-1.5 p-1.5 rounded-lg hover:bg-accent/40 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{activityMessage(item)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.at)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
