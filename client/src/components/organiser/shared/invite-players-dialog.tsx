import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Check, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { searchPlayers, type SearchablePlayer } from "@/lib/api/organizer-sessions";

interface InvitePlayersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onInvite: (userId: string) => Promise<void>;
  /** Passed straight through to the search - flags players already connected in this specific context so they can't be re-invited. */
  searchContext?: { sessionId?: string; community?: boolean };
  /** Label shown (instead of "Invite") for a player already connected in this context. */
  alreadyConnectedLabel?: string;
}

export function InvitePlayersDialog({
  open,
  onOpenChange,
  title,
  description,
  onInvite,
  searchContext,
  alreadyConnectedLabel = "Already joined",
}: InvitePlayersDialogProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchablePlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setInvitedIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlayers(query.trim(), searchContext));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleInvite = async (player: SearchablePlayer) => {
    setInvitingId(player.id);
    try {
      await onInvite(player.id);
      setInvitedIds((prev) => new Set(prev).add(player.id));
      toast({ title: `Invited ${player.name}` });
    } catch (error: any) {
      toast({ title: "Couldn't send invite", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="invite-players-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players by name..."
            className="pl-9"
            autoFocus
            data-testid="invite-players-search-input"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {searching && (
            <p className="text-sm text-muted-foreground text-center py-6">Searching...</p>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="invite-players-no-results">
              No players found matching "{query}".
            </p>
          )}
          {!searching && query.trim().length < 2 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Type at least 2 characters to search.
            </p>
          )}
          {results.map((player) => {
            const isInvited = invitedIds.has(player.id);
            const isAlreadyConnected = player.alreadyConnected && !isInvited;
            return (
              <div
                key={player.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40"
                data-testid={`invite-players-result-${player.id}`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={player.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {player.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{player.name}</p>
                </div>
                {isAlreadyConnected ? (
                  <span
                    className="text-xs font-medium text-muted-foreground px-2 py-1"
                    data-testid={`invite-players-already-${player.id}`}
                  >
                    {alreadyConnectedLabel}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={isInvited ? "outline" : "default"}
                    disabled={isInvited || invitingId === player.id}
                    onClick={() => handleInvite(player)}
                    data-testid={`invite-players-invite-${player.id}`}
                  >
                    {isInvited ? (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        Invited
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-1.5" />
                        {invitingId === player.id ? "Inviting..." : "Invite"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
