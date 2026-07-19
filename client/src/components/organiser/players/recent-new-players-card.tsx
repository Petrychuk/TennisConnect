import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, ChevronRight } from "lucide-react";
import type { RecentNewPlayer } from "@/lib/organiser-players-mock-data";

interface RecentNewPlayersCardProps {
  players: RecentNewPlayer[];
}

export function RecentNewPlayersCard({ players }: RecentNewPlayersCardProps) {
  return (
    <Card className="shadow-sm" data-testid="organiser-players-page-recent-new">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent New Players</CardTitle>
        <span className="text-xs font-medium text-primary flex items-center gap-0.5 cursor-pointer" data-testid="organiser-players-page-recent-new-view-all">
          View all
          <ChevronRight className="w-3 h-3" />
        </span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {players.map((player) => (
          <div key={player.id} className="flex items-center gap-3" data-testid={`organiser-players-page-recent-new-${player.id}`}>
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <UserPlus className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm flex-1 truncate">{player.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {new Date(player.joinedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
