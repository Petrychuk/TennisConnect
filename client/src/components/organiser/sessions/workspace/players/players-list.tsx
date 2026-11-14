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
import { MoreHorizontal } from "lucide-react";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";
import { formatInTimeZone } from "@/lib/timezone";
import { LEVEL_BADGE_STYLE, STATUS_BADGE_STYLE, STATUS_LABEL, playerRowActions } from "./player-row-actions";

interface PlayersListProps {
  players: SessionPlayer[];
  onCheckIn?: (player: SessionPlayer) => void;
  onRemove?: (player: SessionPlayer) => void;
  onMessage?: (player: SessionPlayer) => void;
  onMoveToWaiting?: (player: SessionPlayer) => void;
  onViewProfile?: (player: SessionPlayer) => void;
  // Venue time zone - see players-table.tsx.
  timeZone: string;
}

// Tablet/phone version of PlayersTable - same real actions
// (player-row-actions.ts). No demo "0.0" rating or "Real" badge any more.
export function PlayersList({ players, onCheckIn, onRemove, onMessage, onMoveToWaiting, onViewProfile, timeZone }: PlayersListProps) {
  return (
    <div className="space-y-2" data-testid="organiser-players-list">
      {players.map((player) => {
        const actions = playerRowActions(player, { onMoveToWaiting, onMessage, onViewProfile, onRemove });
        return (
          <Card key={player.id} className="shadow-sm" data-testid={`organiser-players-list-item-${player.id}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src={player.avatar ?? undefined} alt="" />
                <AvatarFallback className="bg-primary/10 text-primary-text text-xs font-bold">
                  {player.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{player.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className={LEVEL_BADGE_STYLE[player.levelLabel]}>{player.levelLabel}</Badge>
                  {player.status !== "registered" && (
                    <Badge className={STATUS_BADGE_STYLE[player.status]}>{STATUS_LABEL[player.status]}</Badge>
                  )}
                </div>
              </div>

              {player.status === "registered" &&
                (player.checkedIn && player.checkInTime ? (
                  <span className="flex items-center gap-1 text-primary-text text-xs font-medium shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                    {formatInTimeZone(player.checkInTime, timeZone, { hour: "numeric", minute: "2-digit" })}
                  </span>
                ) : !onCheckIn ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 min-h-11 px-4"
                    onClick={() => onCheckIn?.(player)}
                    aria-label={`Check in ${player.name}`}
                    data-testid={`organiser-players-list-item-${player.id}-checkin`}
                  >
                    Check In
                  </Button>
                ))}

              {actions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${player.name}`} className="shrink-0 h-11 w-11" data-testid={`organiser-players-list-item-${player.id}-menu`}>
                      <MoreHorizontal aria-hidden="true" className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {actions.map((action) => (
                      <DropdownMenuItem
                        key={action.key}
                        onClick={action.onSelect}
                        className={action.destructive ? "text-destructive" : undefined}
                        data-testid={`organiser-players-list-item-${player.id}-${action.key}`}
                      >
                        <action.icon className="w-4 h-4 mr-2" />
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}