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
import { Search, Check, UserPlus, MapPin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterChip } from "@/components/shared/filters";
import { useToast } from "@/hooks/use-toast";
import { searchPlayers, type SearchablePlayer } from "@/lib/api/organizer-sessions";

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Professional"];
const ANY_LEVEL = "any";

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
  // Not everyone wants to play every format, so the list can be narrowed.
  // Players only by default: coaches and organisers are rarely who an
  // organiser means when filling a game (they can be included).
  const [level, setLevel] = useState("");
  const [location, setLocation] = useState("");
  const [lookingToPlay, setLookingToPlay] = useState(false);
  const [includeCoaches, setIncludeCoaches] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setInvitedIds(new Set());
      setLevel("");
      setLocation("");
      setLookingToPlay(false);
      setIncludeCoaches(false);
    }
  }, [open]);

  const hasFilter = !!level || location.trim().length > 0 || lookingToPlay;
  // A name (2+ characters) or any narrowing filter is enough to show a list.
  const canSearch = query.trim().length >= 2 || hasFilter;

  useEffect(() => {
    if (!canSearch) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlayers(query.trim(), searchContext, { level: level || undefined, location, lookingToPlay, allRoles: includeCoaches }));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, level, location, lookingToPlay, includeCoaches]);

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
            aria-label="Search players by name"
            className="pl-9"
            autoFocus
            data-testid="invite-players-search-input"
          />
        </div>

        <div className="space-y-2" data-testid="invite-players-filters">
          <div className="grid grid-cols-2 gap-2">
            <Select value={level || ANY_LEVEL} onValueChange={(v) => setLevel(v === ANY_LEVEL ? "" : v)}>
              <SelectTrigger aria-label="Level" className="h-9" data-testid="invite-players-filter-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_LEVEL}>Any level</SelectItem>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or suburb"
                aria-label="Location"
                className="h-9 pl-8"
                data-testid="invite-players-filter-location"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip compact selected={lookingToPlay} onClick={() => setLookingToPlay((v) => !v)} data-testid="invite-players-filter-looking-to-play">
              Looking to play
            </FilterChip>
            <FilterChip compact selected={includeCoaches} onClick={() => setIncludeCoaches((v) => !v)} data-testid="invite-players-filter-include-coaches">
              Include coaches &amp; organisers
            </FilterChip>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {searching && (
            <p className="text-sm text-muted-foreground text-center py-6">Searching...</p>
          )}
          {!searching && canSearch && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="invite-players-no-results">
              {query.trim().length >= 2 ? `No players found matching "${query.trim()}".` : "No players match these filters."}
            </p>
          )}
          {!searching && !canSearch && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Type a name (2+ characters) or pick a filter.
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
                  <AvatarFallback className="bg-primary/10 text-primary-text text-sm">
                    {player.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  {/* Opens the public profile in a new tab - a quick look without losing this list. */}
                  <a
                    href={`/${player.role}/${player.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex max-w-full items-center gap-1 text-sm font-medium hover:underline"
                    data-testid={`invite-players-profile-${player.id}`}
                  >
                    <span className="truncate">{player.name}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
                    <span className="sr-only">(opens profile in a new tab)</span>
                  </a>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    {player.role !== "player" && <span className="capitalize">{player.role}</span>}
                    {player.skillLevel && <span>{player.skillLevel}</span>}
                    {player.location && <span className="truncate">{player.location}</span>}
                    {player.lookingToPlay && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Looking to play</Badge>}
                  </p>
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
