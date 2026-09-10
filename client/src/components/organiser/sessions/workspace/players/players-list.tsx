import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowUpDown, Trash2, MessageSquare, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface PlayersListProps {
  players: SessionPlayer[];
  onCheckIn?: (player: SessionPlayer) => void;
  onRemove?: (player: SessionPlayer) => void;
  onMoveToWaiting?: (player: SessionPlayer) => void;
  onViewProfile?: (player: SessionPlayer) => void;
}

const LEVEL_BADGE_STYLE: Record<SessionPlayer["levelLabel"], string> = {
  Advanced: "bg-primary/10 text-primary",
  Intermediate: "bg-secondary text-secondary-foreground",
  Beginner: "bg-secondary text-secondary-foreground",
  Social: "bg-muted text-muted-foreground",
};

export function PlayersList({ players, onCheckIn, onRemove, onMoveToWaiting, onViewProfile }: PlayersListProps) {
  const { toast } = useToast();
  const notify = (action: string, player: SessionPlayer) =>
    toast({ title: `${action} — coming soon`, description: `Would apply to ${player.name}.` });

  return (
    <div className="space-y-2" data-testid="organiser-players-list">
      {players.map((player) => (
        <Card key={player.id} className="shadow-sm" data-testid={`organiser-players-list-item-${player.id}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={player.avatar ?? undefined} alt={player.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {player.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate flex items-center gap-1.5">
                {player.name}
                {player.isReal && (
                  <Badge className="bg-primary/10 text-primary" data-testid={`organiser-players-list-item-${player.id}-real`}>
                    Real
                  </Badge>
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{player.level.toFixed(1)}</span>
                <Badge className={LEVEL_BADGE_STYLE[player.levelLabel]}>{player.levelLabel}</Badge>
              </div>
            </div>

            {player.status === "registered" &&
              (player.checkedIn && player.checkInTime ? (
                <span className="flex items-center gap-1 text-primary text-xs font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {new Date(player.checkInTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              ) : (
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => onCheckIn?.(player)} data-testid={`organiser-players-list-item-${player.id}-checkin`}>
                  Check In
                </Button>
              ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" data-testid={`organiser-players-list-item-${player.id}-menu`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => (onMoveToWaiting ? onMoveToWaiting(player) : notify("Move to Waiting", player))}>
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Move to Waiting
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Message", player)}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Message
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => (onViewProfile ? onViewProfile(player) : notify("View Profile", player))}>
                  <UserCircle className="w-4 h-4 mr-2" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => (onRemove ? onRemove(player) : notify("Remove", player))} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
