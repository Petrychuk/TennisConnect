import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { WaitingPlayer } from "@/lib/organiser-sessions-mock-data";

interface WaitingListCardProps {
  players: WaitingPlayer[];
  className?: string;
}

const LEVEL_BADGE_STYLE: Record<WaitingPlayer["levelLabel"], string> = {
  Advanced: "bg-primary/10 text-primary",
  Intermediate: "bg-secondary text-secondary-foreground",
  Social: "bg-muted text-muted-foreground",
};

export function WaitingListCard({ players, className }: WaitingListCardProps) {
  const { toast } = useToast();

  return (
    <Card className={className} data-testid="organiser-waiting-list-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Waiting List ({players.length})</CardTitle>
        {players.length > 0 && (
          <span className="text-xs font-medium text-primary flex items-center gap-0.5 cursor-pointer" data-testid="organiser-waiting-list-view-all">
            View all waiting list
            <ChevronRight className="w-3 h-3" />
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center" data-testid="organiser-waiting-list-empty">
            Nobody's waiting.
          </p>
        ) : (
          players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 rounded-xl border border-border p-3"
              data-testid={`organiser-waiting-list-item-${player.id}`}
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {player.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{player.name}</p>
                <div className="flex items-center gap-1.5">
                  <Badge className={LEVEL_BADGE_STYLE[player.levelLabel]}>{player.levelLabel}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Joined {new Date(player.joinedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => toast({ title: "Move to Registered", description: `${player.name} would move to the registered list.` })}
                data-testid={`organiser-waiting-list-item-${player.id}-move`}
              >
                Move to Registered
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
