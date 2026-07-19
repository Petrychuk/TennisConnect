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
import { MoreHorizontal, UserCircle, MessageSquare, History, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { OrgPlayer } from "@/lib/organiser-players-mock-data";

interface PlayersTableProps {
  players: OrgPlayer[];
}

const LEVEL_BADGE_STYLE: Record<OrgPlayer["levelLabel"], string> = {
  Advanced: "bg-primary/10 text-primary",
  Intermediate: "bg-secondary text-secondary-foreground",
  Social: "bg-muted text-muted-foreground",
  Beginner: "bg-accent text-accent-foreground",
};

export function PlayersTable({ players }: PlayersTableProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const notify = (action: string, player: OrgPlayer) =>
    toast({ title: `${action} — coming soon`, description: `Would apply to ${player.name}.` });

  return (
    <div className="overflow-x-auto" data-testid="organiser-players-page-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                checked={selected.size > 0 && selected.size === players.length}
                onCheckedChange={(checked) => setSelected(checked ? new Set(players.map((p) => p.id)) : new Set())}
                data-testid="organiser-players-page-select-all"
              />
            </TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Sessions Played</TableHead>
            <TableHead>Win Rate</TableHead>
            <TableHead>Last Played</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id} data-testid={`organiser-players-page-row-${player.id}`}>
              <TableCell>
                <Checkbox
                  checked={selected.has(player.id)}
                  onCheckedChange={() => toggle(player.id)}
                  data-testid={`organiser-players-page-row-${player.id}-select`}
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
              <TableCell>{player.sessionsPlayed}</TableCell>
              <TableCell>{player.winRate}%</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(player.lastPlayed).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </TableCell>
              <TableCell>
                <Badge className={player.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                  {player.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`organiser-players-page-row-${player.id}-menu`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => notify("View Profile", player)}>
                      <UserCircle className="w-4 h-4 mr-2" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => notify("Message", player)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => notify("View History", player)}>
                      <History className="w-4 h-4 mr-2" />
                      View History
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => notify("Remove", player)} className="text-destructive">
                      <UserX className="w-4 h-4 mr-2" />
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
