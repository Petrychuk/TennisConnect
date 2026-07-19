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
import { MoreHorizontal, ArrowUpDown, Trash2, CheckCircle2, MessageSquare, UserCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mockSessionPlayers, type SessionPlayer } from "@/lib/organiser-sessions-mock-data";

const STATUS_LABEL: Record<SessionPlayer["status"], string> = {
  registered: "Registered",
  waiting: "Waiting List",
  cancelled: "Cancelled",
  invited: "Invited",
  "checked-in": "Checked In",
};

const STATUS_STYLE: Record<SessionPlayer["status"], string> = {
  registered: "bg-secondary text-secondary-foreground",
  waiting: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  invited: "bg-accent text-accent-foreground",
  "checked-in": "bg-primary/10 text-primary",
};

export function PlayersTab() {
  const { toast } = useToast();

  const notify = (action: string, player: SessionPlayer) =>
    toast({ title: `${action} — coming soon`, description: `Would apply to ${player.name}.` });

  return (
    <div className="space-y-3" data-testid="organiser-session-players-tab">
      {mockSessionPlayers.map((player) => (
        <Card key={player.id} className="shadow-sm" data-testid={`organiser-session-player-${player.id}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {player.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{player.name}</p>
              <Badge className={STATUS_STYLE[player.status]}>{STATUS_LABEL[player.status]}</Badge>
            </div>

            {player.status !== "checked-in" && player.status !== "cancelled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => notify("Check In", player)}
                data-testid={`organiser-session-player-${player.id}-checkin`}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Check In
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`organiser-session-player-${player.id}-menu`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => notify("Move to Waiting List", player)}>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
