import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CalendarRange, Users, Plus, MoreHorizontal, Archive, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { formatInTimeZone } from "@/lib/timezone";

import {
  getSeasonById,
  getSessionsForSeason,
  getMySessions,
  addSessionsToSeason,
  removeSessionFromSeason,
  archiveSeason,
  type SeasonWithCounts,
} from "@/lib/api/organizer-sessions";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { seasonStatus, SEASON_STATUS_LABEL, SEASON_STATUS_STYLE, formatSeasonPeriod } from "@/lib/season-utils";
import { cn } from "@/lib/utils";
import type { SessionWithDetails } from "@shared/schema";

// No Rankings preview section here, even though the spec's own mockup
// shows one - there's no real points/leaderboard system that
// aggregates across a whole season anywhere in the schema yet (match
// scores only ever exist per-session). Inventing season-wide standings
// numbers to fill that section would repeat the exact mistake already
// found and removed elsewhere (fake win rates, fake ratings) - once a
// real cross-session ranking exists, this is the natural place to link
// to it.
export default function OrganiserSeasonDetailsPage() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/seasons/:id");
  const seasonId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [addSessionsOpen, setAddSessionsOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SessionWithDetails | null>(null);

  const seasonQuery = useQuery({
    queryKey: ["/api/organizer/seasons", seasonId],
    queryFn: () => getSeasonById(seasonId!),
    enabled: isAuthenticated && !!seasonId,
  });
  const sessionsQuery = useQuery({
    queryKey: ["/api/organizer/seasons", seasonId, "sessions"],
    queryFn: () => getSessionsForSeason(seasonId!),
    enabled: isAuthenticated && !!seasonId,
  });
  // For the Add Sessions picker - every session of the same type this
  // organiser owns, which the picker then narrows to ones not already
  // in this season.
  const allSessionsQuery = useQuery({
    queryKey: ["/api/organizer/sessions/mine"],
    queryFn: getMySessions,
    enabled: addSessionsOpen,
  });

  const season = seasonQuery.data;
  const sessions = sessionsQuery.data ?? [];

  const invalidateSeason = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/seasons"] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/seasons", seasonId] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/seasons", seasonId, "sessions"] });
  };

  const addCandidates = useMemo(() => {
    if (!season) return [];
    const inSeasonIds = new Set(sessions.map((s) => s.id));
    const query = addSearch.trim().toLowerCase();
    return (allSessionsQuery.data ?? [])
      .filter((s) => s.type === season.type && !inSeasonIds.has(s.id))
      .filter((s) => !query || s.title.toLowerCase().includes(query));
  }, [allSessionsQuery.data, season, sessions, addSearch]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddSessions = async () => {
    if (!seasonId || selectedIds.size === 0) return;
    try {
      await addSessionsToSeason(seasonId, Array.from(selectedIds));
      invalidateSeason();
      toast({ title: `${selectedIds.size} session${selectedIds.size === 1 ? "" : "s"} added to ${season?.name}` });
      setAddSessionsOpen(false);
      setSelectedIds(new Set());
      setAddSearch("");
    } catch (error: any) {
      toast({ title: "Couldn't add sessions", description: error?.message ?? "Please try again.", variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    if (!seasonId || !removeTarget) return;
    try {
      await removeSessionFromSeason(seasonId, removeTarget.id);
      invalidateSeason();
      toast({ title: `Removed from ${season?.name}`, description: "The session itself wasn't affected." });
    } catch (error: any) {
      toast({ title: "Couldn't remove session", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setRemoveTarget(null);
    }
  };

  const handleArchive = async () => {
    if (!seasonId) return;
    try {
      await archiveSeason(seasonId);
      toast({ title: "Season archived" });
      setLocation("/organiser/seasons");
    } catch (error: any) {
      toast({ title: "Couldn't archive season", description: error?.message ?? "Please try again.", variant: "destructive" });
    }
  };

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }
  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardContent className="p-6 text-muted-foreground">
            You need to be an approved organiser to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (seasonQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <TennisBallSpinner />
      </div>
    );
  }

  if (!season) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Season not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/seasons">Back to Seasons</Link>
        </Button>
      </div>
    );
  }

  const status = seasonStatus(season);
  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === season.type)?.label ?? season.type;

  return (
    <div className="min-h-screen bg-background" data-testid="organiser-season-details-page">
      <SEO title={`${season.name} | Seasons | TennisConnect`} description={`Season details for ${season.name}.`} noIndex />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href="/organiser/seasons"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="organiser-season-details-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Seasons
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold" data-testid="organiser-season-details-name">{season.name}</h1>
              <Badge variant="outline">{typeLabel}</Badge>
              <Badge className={SEASON_STATUS_STYLE[status]} data-testid="organiser-season-details-status">
                {SEASON_STATUS_LABEL[status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatSeasonPeriod(season)}</p>
            {season.description && <p className="text-sm text-muted-foreground mt-2 max-w-lg">{season.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => setLocation(`/organiser/seasons/${season.id}/edit`)} data-testid="organiser-season-details-edit">
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="organiser-season-details-menu">
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setArchiveOpen(true)} data-testid="organiser-season-details-archive">
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Season
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm" data-testid="organiser-season-details-summary">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold">{sessions.length}</span>
            <span className="text-muted-foreground">Sessions</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold">{season.playersCount ?? 0}</span>
            <span className="text-muted-foreground">Players</span>
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold">Sessions</h2>
            <Button size="sm" onClick={() => setAddSessionsOpen(true)} data-testid="organiser-season-details-add-sessions">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Sessions
            </Button>
          </div>

          {sessionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-2 py-10 rounded-2xl border border-dashed border-border" data-testid="organiser-season-details-empty">
              <p className="text-sm text-muted-foreground">No sessions added yet.</p>
              <p className="text-xs text-muted-foreground">Add sessions to start building this season.</p>
              <Button size="sm" className="mt-2" onClick={() => setAddSessionsOpen(true)} data-testid="organiser-season-details-empty-add">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Sessions
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                  data-testid={`organiser-season-details-session-${s.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatInTimeZone(s.startAt, s.timeZone, { day: "numeric", month: "short" })} · {SESSION_TYPE_OPTIONS.find((t) => t.key === s.type)?.label ?? s.type} · {s.registeredCount} players
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLocation(`/organiser/sessions/${s.id}`)} data-testid={`organiser-season-details-session-${s.id}-view`}>
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemoveTarget(s)}
                    title="Remove from Season"
                    data-testid={`organiser-season-details-session-${s.id}-remove`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={addSessionsOpen} onOpenChange={(open) => { setAddSessionsOpen(open); if (!open) { setSelectedIds(new Set()); setAddSearch(""); } }}>
        <DialogContent data-testid="organiser-season-add-sessions-dialog">
          <DialogHeader>
            <DialogTitle>Add Sessions to {season.name}</DialogTitle>
            <DialogDescription>
              Only {typeLabel} sessions that aren't already in this season are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search sessions..."
              className="pl-9"
              data-testid="organiser-season-add-sessions-search"
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {allSessionsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading sessions...</p>
            ) : addCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No {typeLabel} sessions available to add.
              </p>
            ) : (
              addCandidates.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/40 cursor-pointer"
                  data-testid={`organiser-season-add-sessions-item-${s.id}`}
                >
                  <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelected(s.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{formatInTimeZone(s.startAt, s.timeZone, { day: "numeric", month: "short" })}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSessionsOpen(false)} data-testid="organiser-season-add-sessions-cancel">
              Cancel
            </Button>
            <Button onClick={handleAddSessions} disabled={selectedIds.size === 0} data-testid="organiser-season-add-sessions-confirm">
              Add Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{removeTarget?.title}" from {season.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The session itself, its players, and its results are not affected - it just stops
              counting toward this season.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="organiser-season-details-remove-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} data-testid="organiser-season-details-remove-confirm">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {season.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the season from your Seasons list, but its sessions, players, scores, and
              results are all preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="organiser-season-details-archive-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} data-testid="organiser-season-details-archive-confirm">
              Archive Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
