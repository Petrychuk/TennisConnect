import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, CheckCircle2, ArrowUpDown, MessageSquare, Download, Trash2, Hourglass } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface RegistrationPlayersPanelProps {
  players: SessionPlayer[];
  onOpenPlayerActions?: (player: SessionPlayer) => void;
}

const STATUS_LABEL: Record<SessionPlayer["status"], string> = {
  registered: "Registered",
  waiting: "Waiting List",
  cancelled: "Cancelled",
  invited: "Invited",
  "no-response": "No Response",
};

const STATUS_STYLE: Record<SessionPlayer["status"], string> = {
  registered: "bg-primary/10 text-primary",
  waiting: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  invited: "bg-accent text-accent-foreground",
  "no-response": "bg-muted text-muted-foreground",
};

export function RegistrationPlayersPanel({ players, onOpenPlayerActions }: RegistrationPlayersPanelProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = search.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : players;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  const bulk = (action: string) => {
    toast({ title: `${action} — coming soon`, description: `Would apply to ${selected.size} player${selected.size === 1 ? "" : "s"}.` });
    setSelected(new Set());
  };

  return (
    <Card className="shadow-sm" data-testid="organiser-registration-players-panel">
      <CardHeader>
        <CardTitle className="text-base">Players</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player..."
            className="pl-9"
            data-testid="organiser-registration-search-input"
          />
        </div>

        <div className="space-y-1">
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center" data-testid="organiser-registration-players-empty">
              Nobody here.
            </p>
          ) : (
            visible.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-accent/30 transition-colors"
                data-testid={`organiser-registration-player-${player.id}`}
              >
                <Checkbox
                  checked={selected.has(player.id)}
                  onCheckedChange={() => toggle(player.id)}
                  data-testid={`organiser-registration-player-${player.id}-select`}
                />
                {player.status === "waiting" ? (
                  <Hourglass className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <span className="text-sm font-medium flex-1 truncate">{player.name}</span>
                <Badge className={STATUS_STYLE[player.status]}>
                  {player.status === "registered" && player.checkedIn ? "Checked In" : STATUS_LABEL[player.status]}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`organiser-registration-player-${player.id}-menu`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpenPlayerActions?.(player)}>More actions…</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>

        {visible.length > 0 && (
          <label className="flex items-center gap-2.5 px-2 pt-1 text-sm cursor-pointer" data-testid="organiser-registration-select-all">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setSelected(checked ? new Set(visible.map((p) => p.id)) : new Set())}
            />
            Select All
          </label>
        )}

        {selected.size > 0 && (
          <div
            className={cn("flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5 mt-2")}
            data-testid="organiser-registration-bulk-actions"
          >
            <span className="text-sm font-medium mr-1">Selected: {selected.size}</span>
            <Button size="sm" variant="outline" onClick={() => bulk("Check In")} data-testid="organiser-registration-bulk-checkin">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Check In
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("Move to Waiting")} data-testid="organiser-registration-bulk-move">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              Move
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("Send Message")} data-testid="organiser-registration-bulk-message">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Message
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("Export")} data-testid="organiser-registration-bulk-export">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk("Remove")} className="text-destructive" data-testid="organiser-registration-bulk-remove">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Remove
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
