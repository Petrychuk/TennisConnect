import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
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
import { formatInTimeZone } from "@/lib/timezone";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";
import { LEVEL_BADGE_STYLE, STATUS_BADGE_STYLE, STATUS_LABEL, playerRowActions } from "./player-row-actions";

interface PlayersTableProps {
  players: SessionPlayer[];
  onCheckIn?: (player: SessionPlayer) => void;
  onRemove?: (player: SessionPlayer) => void;
  onMessage?: (player: SessionPlayer) => void;
  onMoveToWaiting?: (player: SessionPlayer) => void;
  onViewProfile?: (player: SessionPlayer) => void;
  showJoinedColumn?: boolean;
  // The venue's own zone (session.timeZone) - Joined/Check-in times are
  // absolute instants and must be shown in the venue's time, not the
  // organiser's browser's.
  timeZone: string;
}

// Phase 2: no selection checkboxes (there were no bulk actions behind
// them), no "Real" badge or demo rating (left over from mock players), and
// every menu item does what it says - Message opens the real composer.
export function PlayersTable({ players, onCheckIn, onRemove, onMessage, onMoveToWaiting, onViewProfile, showJoinedColumn = true, timeZone }: PlayersTableProps) {
  return (
    <div className="overflow-x-auto" data-testid="organiser-players-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check-in</TableHead>
            {showJoinedColumn && <TableHead>Joined</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => {
            const actions = playerRowActions(player, { onMoveToWaiting, onMessage, onViewProfile, onRemove });
            return (
              <TableRow key={player.id} data-testid={`organiser-players-row-${player.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarImage src={player.avatar ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary/10 text-primary-text text-xs font-bold">
                        {player.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{player.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={LEVEL_BADGE_STYLE[player.levelLabel]}>{player.levelLabel}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE_STYLE[player.status]}>{STATUS_LABEL[player.status]}</Badge>
                </TableCell>
                <TableCell>
                  {player.status !== "registered" || (!onCheckIn && !player.checkedIn) ? (
                    "—"
                  ) : player.checkedIn && player.checkInTime ? (
                    <span className="flex items-center gap-1 text-primary-text font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
                      {formatInTimeZone(player.checkInTime, timeZone, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCheckIn?.(player)}
                      aria-label={`Check in ${player.name}`}
                      data-testid={`organiser-players-row-${player.id}-checkin`}
                    >
                      Check In
                    </Button>
                  )}
                </TableCell>
                {showJoinedColumn && (
                  <TableCell className="text-muted-foreground text-sm">
                    {formatInTimeZone(player.joinedAt, timeZone, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {actions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${player.name}`} data-testid={`organiser-players-row-${player.id}-menu`}>
                          <MoreHorizontal aria-hidden="true" className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action) => (
                          <DropdownMenuItem
                            key={action.key}
                            onClick={action.onSelect}
                            className={action.destructive ? "text-destructive" : undefined}
                            data-testid={`organiser-players-row-${player.id}-${action.key}`}
                          >
                            <action.icon className="w-4 h-4 mr-2" />
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}