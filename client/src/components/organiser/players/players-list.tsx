import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserCircle, ExternalLink } from "lucide-react";
import type { OrgPlayer } from "@/lib/organiser-players-mock-data";

interface PlayersListProps {
  players: OrgPlayer[];
  showSessions?: boolean;
}

const LEVEL_BADGE_STYLE: Record<OrgPlayer["levelLabel"], string> = {
  Advanced: "bg-primary/10 text-primary",
  Intermediate: "bg-secondary text-secondary-foreground",
  Social: "bg-muted text-muted-foreground",
  Beginner: "bg-accent text-accent-foreground",
};

// Same real navigation as players-table.tsx's own desktop version -
// see its comment for why "Remove"/"Message"/"View History" aren't
// fake toast stubs here anymore.
export function PlayersList({ players, showSessions = true }: PlayersListProps) {
  const [, setLocation] = useLocation();
  const openDetails = (player: OrgPlayer) => setLocation(`/organiser/players/${player.slug}`);

  return (
    <div className="space-y-2" data-testid="organiser-players-page-list">
      {players.map((player) => (
        <Card
          key={player.id}
          className="shadow-sm cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => openDetails(player)}
          data-testid={`organiser-players-page-list-item-${player.id}`}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {player.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{player.name}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{player.level.toFixed(1)}</span>
                <Badge className={LEVEL_BADGE_STYLE[player.levelLabel]}>{player.levelLabel}</Badge>
              </div>
            </div>
            {showSessions && (
              <span className="text-sm text-muted-foreground shrink-0" data-testid={`organiser-players-page-list-item-${player.id}-sessions`}>
                {player.sessionsPlayed}
              </span>
            )}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0" data-testid={`organiser-players-page-list-item-${player.id}-menu`}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openDetails(player)}>
                    <UserCircle className="w-4 h-4 mr-2" />
                    View Player
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation(`/player/${player.slug}`)}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Public Profile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
