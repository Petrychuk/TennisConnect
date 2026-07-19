import { useState } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowUpDown, Trash2, MessageSquare, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface PlayersTableProps {
  players: SessionPlayer[];
  onCheckIn?: (player: SessionPlayer) => void;
  showGroupColumn?: boolean;
  showJoinedColumn?: boolean;
}

const LEVEL_BADGE_STYLE: Record<SessionPlayer["levelLabel"], string> = {
  Advanced: "bg-primary/10 text-primary",
  Intermediate: "bg-secondary text-secondary-foreground",
  Social: "bg-muted text-muted-foreground",
};

const STATUS_BADGE_STYLE: Record<SessionPlayer["status"], string> = {
  registered: "bg-primary/10 text-primary",
  waiting: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  invited: "bg-accent text-accent-foreground",
  "no-response": "bg-muted text-muted-foreground",
};

export function PlayersTable({ players, onCheckIn, showGroupColumn = true, showJoinedColumn = true }: PlayersTableProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const notify = (action: string, player: SessionPlayer) =>
    toast({ title: `${action} — coming soon`, description: `Would apply to ${player.name}.` });

  return (
    <div className="overflow-x-auto" data-testid="organiser-players-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                checked={selected.size > 0 && selected.size === players.length}
                onCheckedChange={(checked) => setSelected(checked ? new Set(players.map((p) => p.id)) : new Set())}
                data-testid="organiser-players-select-all"
              />
            </TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Level</TableHead>
            {showGroupColumn && <TableHead>Group</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Check-in</TableHead>
            {showJoinedColumn && <TableHead>Joined</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id} data-testid={`organiser-players-row-${player.id}`}>
              <TableCell>
                <Checkbox
                  checked={selected.has(player.id)}
                  onCheckedChange={() => toggle(player.id)}
                  data-testid={`organiser-players-row-${player.id}-select`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {player.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{player.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{player.level.toFixed(1)}</span>
                  <Badge className={LEVEL_BADGE_STYLE[player.levelLabel]}>{player.levelLabel}</Badge>
                </div>
              </TableCell>
              {showGroupColumn && <TableCell>{player.group ?? "—"}</TableCell>}
              <TableCell>
                <Badge className={STATUS_BADGE_STYLE[player.status]}>
                  {player.status === "registered"
                    ? "Registered"
                    : player.status === "waiting"
                    ? "Waiting"
                    : player.status === "cancelled"
                    ? "Cancelled"
                    : player.status === "invited"
                    ? "Invited"
                    : "No Response"}
                </Badge>
              </TableCell>
              <TableCell>
                {player.status !== "registered" ? (
                  "—"
                ) : player.checkedIn && player.checkInTime ? (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {new Date(player.checkInTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCheckIn?.(player)}
                    data-testid={`organiser-players-row-${player.id}-checkin`}
                  >
                    Check In
                  </Button>
                )}
              </TableCell>
              {showJoinedColumn && (
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(player.joinedAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })}
                </TableCell>
              )}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`organiser-players-row-${player.id}-menu`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => notify("Move to Waiting", player)}>
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      Move to Waiting
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => notify("Message", player)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => notify("View Profile", player)}>
                      <UserCircle className="w-4 h-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => notify("Remove", player)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
