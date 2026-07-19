import { useState } from "react";
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
import { Search, UserPlus, MoreHorizontal, CheckCircle2, ArrowUpDown, MessageSquare, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface RegistrationPlayersPanelProps {
  players: SessionPlayer[];
  onOpenPlayerActions?: (player: SessionPlayer) => void;
  showDetailColumns?: boolean; // payment status + rating - desktop only
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

const PAYMENT_LABEL: Record<NonNullable<SessionPlayer["paymentStatus"]>, string> = {
  paid: "Paid",
  pending: "Paid Pending",
  guest: "Guest",
};

const PAYMENT_STYLE: Record<NonNullable<SessionPlayer["paymentStatus"]>, string> = {
  paid: "bg-primary/10 text-primary",
  pending: "bg-destructive/10 text-destructive",
  guest: "bg-muted text-muted-foreground",
};

export function RegistrationPlayersPanel({ players, onOpenPlayerActions, showDetailColumns = false }: RegistrationPlayersPanelProps) {
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
    <div data-testid="organiser-registration-players-panel">
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative sm:max-w-xs sm:flex-none flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Player..."
            className="pl-9"
            data-testid="organiser-registration-search-input"
          />
        </div>
        <Button
          variant="outline"
          className="hidden sm:inline-flex shrink-0"
          onClick={() => toast({ title: "Invite Player isn't wired up yet" })}
          data-testid="organiser-registration-invite-player"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Player
        </Button>
      </div>

      <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-registration-players-empty">
            Nobody here.
          </p>
        ) : (
          visible.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-3 py-3 hover:bg-accent/20 transition-colors"
              data-testid={`organiser-registration-player-${player.id}`}
            >
              <Checkbox
                checked={selected.has(player.id)}
                onCheckedChange={() => toggle(player.id)}
                data-testid={`organiser-registration-player-${player.id}-select`}
              />
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{player.name}</span>

              <Badge className={cn("shrink-0", STATUS_STYLE[player.status])}>
                {player.status === "registered" && player.checkedIn ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Checked In
                  </span>
                ) : (
                  STATUS_LABEL[player.status]
                )}
              </Badge>

              {showDetailColumns && player.paymentStatus && (
                <Badge className={cn("shrink-0 hidden md:inline-flex", PAYMENT_STYLE[player.paymentStatus])}>
                  {PAYMENT_LABEL[player.paymentStatus]}
                </Badge>
              )}
              {showDetailColumns && player.rating && (
                <span className="hidden xl:flex items-center gap-1 text-xs text-muted-foreground shrink-0" data-testid={`organiser-registration-player-${player.id}-rating`}>
                  <Star className="w-3 h-3" />
                  Rating {player.rating.toFixed(1)}
                </span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" data-testid={`organiser-registration-player-${player.id}-menu`}>
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

      {/* Bulk actions bar - directly under the list, no gap, appears once
          anything's selected. Select All lives inside this same bar. */}
      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-b-2xl border border-t-0 border-border bg-muted/30 px-3 py-2.5" data-testid="organiser-registration-bulk-bar">
          <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setSelected(checked ? new Set(visible.map((p) => p.id)) : new Set())}
              data-testid="organiser-registration-select-all"
            />
            Select All {selected.size > 0 && `(${selected.size} selected)`}
          </label>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2" data-testid="organiser-registration-bulk-actions">
              <Button size="sm" variant="outline" onClick={() => bulk("Check In")} data-testid="organiser-registration-bulk-checkin">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Check In
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulk("Move to Waiting")} data-testid="organiser-registration-bulk-move">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                Move to Waiting
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulk("Send Message")} data-testid="organiser-registration-bulk-message">
                <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                Send Message
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulk("Remove")} className="text-destructive" data-testid="organiser-registration-bulk-remove">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Remove
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
