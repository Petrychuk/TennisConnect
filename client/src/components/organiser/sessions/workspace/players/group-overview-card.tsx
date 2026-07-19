import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GroupOverviewItem } from "@/lib/organiser-sessions-mock-data";

interface GroupOverviewCardProps {
  groups: GroupOverviewItem[];
  className?: string;
}

export function GroupOverviewCard({ groups, className }: GroupOverviewCardProps) {
  return (
    <Card className={className} data-testid="organiser-group-overview-card">
      <CardHeader>
        <CardTitle className="text-base">Group Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((group) => (
          <div key={group.key} className="flex items-center gap-3" data-testid={`organiser-group-overview-${group.key}`}>
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {group.key}
            </span>
            <span className="text-sm shrink-0 w-16">{group.key} Group</span>
            <Progress value={(group.filled / group.capacity) * 100} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground shrink-0">{group.filled} / {group.capacity}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
