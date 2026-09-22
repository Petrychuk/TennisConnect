import { useState } from "react";
import { useLocation } from "wouter";
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
import { MoreHorizontal, UserCircle, MessageSquare } from "lucide-react";
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

// Win Rate removed - it was hardcoded to 0 for every real player (no
// win/loss data exists at the org-wide level), never a real column.
// Clicking a row (or "View Player" in the menu) opens Player Details
// (/organiser/players/:slug) - the one place session-level performance
// data actually makes sense to show, once that's genuinely available.
// "Remove"/"Add to Group" aren't here - no real backend action exists
// for either yet (Group doesn't exist at all - Phase 2), and a fake
// destructive-looking "Remove" that does nothing is worse than not
// offering it.
export function PlayersTable({ players }: PlayersTableProps) {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openDetails = (player: OrgPlayer) => setLocation(`/organiser/players/${player.slug}`);

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
            <TableHead>Sessions</TableHead>
            <TableHead>Last Played</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow
              key={player.id}
              className="cursor-pointer"
              onClick={() => openDetails(player)}
              data-testid={`organiser-players-page-row-${player.id}`}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
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
              <TableCell className="text-muted-foreground text-sm">
                {new Date(player.lastPlayed).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </TableCell>
              <TableCell>
                <Badge className={player.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                  {player.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`organiser-players-page-row-${player.id}-menu`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDetails(player)} data-testid={`organiser-players-page-row-${player.id}-view`}>
                      <UserCircle className="w-4 h-4 mr-2" />
                      View Player
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation(`/player/${player.slug}`)} data-testid={`organiser-players-page-row-${player.id}-public-profile`}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      View Public Profile
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
