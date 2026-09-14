import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Menu,
  Trophy,
  Users,
  CalendarDays,
  TrendingUp,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Crown,
  Award,
  Info,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { formatInTimeZone } from "@/lib/timezone";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { seasonStatus, SEASON_STATUS_LABEL, SEASON_STATUS_STYLE, formatSeasonPeriod } from "@/lib/season-utils";
import { getSeasons, getSessionsForSeason } from "@/lib/api/organizer-sessions";
import {
  getSeriesForSeason,
  createSeries,
  getSessionsForSeries,
  addSessionsToSeries,
  getSeriesStandings,
  getSeriesSessionResults,
  getPlayerRecentForm,
} from "@/lib/api/organizer-rankings";
import type { SeriesStandingRow } from "@shared/schema";

const ALL_SESSIONS = "all";

const RANK_STYLE: Record<number, string> = {
  1: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  2: "bg-slate-200 text-slate-700 dark:bg-slate-400/20 dark:text-slate-300",
  3: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
};

function RankBadge({ pos }: { pos: number }) {
  return (
    <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0", RANK_STYLE[pos] ?? "bg-muted text-muted-foreground")}>
      {pos}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 text-sm font-medium"><ArrowUp className="w-3.5 h-3.5" /> {change}</span>;
  }
  if (change < 0) {
    return <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 text-sm font-medium"><ArrowDown className="w-3.5 h-3.5" /> {Math.abs(change)}</span>;
  }
  return <span className="inline-flex items-center text-muted-foreground text-sm">—</span>;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function PodiumCard({ pos, player }: { pos: number; player: SeriesStandingRow }) {
  const medalIcon = pos === 1 ? <Crown className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />;
  const bg = pos === 1 ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30" : pos === 2 ? "bg-slate-50 border-slate-200 dark:bg-slate-400/10 dark:border-slate-400/30" : "bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30";

  return (
    <div className={cn("flex-1 min-w-[9rem] flex items-center gap-3 rounded-2xl border p-3", bg)} data-testid={`organiser-rankings-podium-${pos}`}>
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11 border border-border">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials(player.userName)}</AvatarFallback>
        </Avatar>
        <span className={cn("absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center", RANK_STYLE[pos])}>{medalIcon}</span>
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate" data-testid={`organiser-rankings-podium-${pos}-name`}>{player.userName}</p>
        <p className="text-green-600 dark:text-green-400 font-bold text-sm" data-testid={`organiser-rankings-podium-${pos}-points`}>{player.points.toLocaleString()} pts</p>
      </div>
    </div>
  );
}

export default function OrganiserRankingsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false } : mockOrganiser;

  const [tab, setTab] = useState<"rankings" | "results" | "past">("rankings");
  const [seasonId, setSeasonId] = useState<string>("");
  const [seriesId, setSeriesId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>(ALL_SESSIONS);
  const [detailsPlayer, setDetailsPlayer] = useState<SeriesStandingRow | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [createSeriesOpen, setCreateSeriesOpen] = useState(false);
  const [attachSessionsOpen, setAttachSessionsOpen] = useState(false);

  const seasonsQuery = useQuery({
    queryKey: ["/api/organizer/seasons"],
    queryFn: getSeasons,
    enabled: isAuthenticated,
  });
  const seasons = seasonsQuery.data ?? [];

  // Default to the currently active season, falling back to the most
  // recent one - never silently pick an already-completed season over
  // an active one just because it happens to sort first.
  useEffect(() => {
    if (seasonId || seasons.length === 0) return;
    const active = seasons.find((s) => seasonStatus(s) === "active");
    setSeasonId((active ?? seasons[0]).id);
  }, [seasons, seasonId]);

  const season = seasons.find((s) => s.id === seasonId);

  const seriesQuery = useQuery({
    queryKey: ["/api/organizer/seasons", seasonId, "series"],
    queryFn: () => getSeriesForSeason(seasonId),
    enabled: !!seasonId,
  });
  const seriesList = seriesQuery.data ?? [];

  useEffect(() => {
    if (!seasonId) return;
    if (seriesList.length === 0) {
      setSeriesId("");
      return;
    }
    if (!seriesList.some((s) => s.id === seriesId)) {
      setSeriesId(seriesList[0].id);
    }
  }, [seasonId, seriesList, seriesId]);

  const series = seriesList.find((s) => s.id === seriesId);

  const sessionsQuery = useQuery({
    queryKey: ["/api/organizer/series", seriesId, "sessions"],
    queryFn: () => getSessionsForSeries(seriesId),
    enabled: !!seriesId,
  });
  const seriesSessions = sessionsQuery.data ?? [];
  const selectedSession = seriesSessions.find((s) => s.id === sessionId);

  useEffect(() => {
    setSessionId(ALL_SESSIONS);
  }, [seriesId]);

  const standingsQuery = useQuery({
    queryKey: ["/api/organizer/series", seriesId, "standings"],
    queryFn: () => getSeriesStandings(seriesId),
    enabled: !!seriesId && sessionId === ALL_SESSIONS,
  });
  const standings = standingsQuery.data ?? [];

  const sessionResultsQuery = useQuery({
    queryKey: ["/api/organizer/series", seriesId, "sessions", sessionId, "results"],
    queryFn: () => getSeriesSessionResults(seriesId, sessionId),
    enabled: !!seriesId && sessionId !== ALL_SESSIONS,
  });
  const sessionResults = sessionResultsQuery.data ?? [];

  const formQuery = useQuery({
    queryKey: ["/api/organizer/series", seriesId, "players", detailsPlayer?.userId, "form"],
    queryFn: () => getPlayerRecentForm(seriesId, detailsPlayer!.userId),
    enabled: !!seriesId && !!detailsPlayer,
  });
  const recentForm = formQuery.data ?? [];

  // Every session in this Season not yet claimed by a series - what
  // the "Attach sessions" dialog offers, since a session can only ever
  // contribute to one Series Ranking at a time.
  const seasonSessionsQuery = useQuery({
    queryKey: ["/api/organizer/seasons", seasonId, "sessions"],
    queryFn: () => getSessionsForSeason(seasonId),
    enabled: attachSessionsOpen && !!seasonId,
  });
  const attachableSessions = (seasonSessionsQuery.data ?? []).filter((s) => !s.seriesId);
  const [selectedToAttach, setSelectedToAttach] = useState<Set<string>>(new Set());

  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesFormat, setNewSeriesFormat] = useState<string>(SESSION_TYPE_OPTIONS[0]?.key ?? "social");
  const [newSeriesDescription, setNewSeriesDescription] = useState("");

  const createSeriesMutation = useMutation({
    mutationFn: () => createSeries({ seasonId, name: newSeriesName.trim(), format: newSeriesFormat, description: newSeriesDescription.trim() || undefined }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/seasons", seasonId, "series"] });
      setSeriesId(created.id);
      setCreateSeriesOpen(false);
      setNewSeriesName("");
      setNewSeriesDescription("");
      toast({ title: "Series created", description: `${created.name} is ready for sessions.` });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't create series", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const attachSessionsMutation = useMutation({
    mutationFn: () => addSessionsToSeries(seriesId, Array.from(selectedToAttach)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/series", seriesId, "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/series", seriesId, "standings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/seasons", seasonId, "sessions"] });
      setAttachSessionsOpen(false);
      setSelectedToAttach(new Set());
      toast({ title: "Sessions attached", description: "Their confirmed results will now count toward this ranking." });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't attach sessions", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const totalPlayers = useMemo(() => new Set(standings.map((p) => p.userId)).size, [standings]);

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }
  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardContent className="p-6 text-muted-foreground">You need to be an approved organiser to view this page.</CardContent>
        </Card>
      </div>
    );
  }

  const detailsPos = detailsPlayer ? standings.findIndex((p) => p.userId === detailsPlayer.userId) + 1 : 0;

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-rankings-page">
      <SEO title="Rankings | Organiser Hub | TennisConnect" description="Track player standings and results across seasons and session series." noIndex />

      <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-64")}>
        <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} className="w-full" collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((v) => !v)} />
      </aside>

      <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
        <div className="flex xl:hidden items-center justify-between px-4 h-14 border-b border-border bg-card">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" data-testid="organiser-sidebar-trigger">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
              <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} />
            </SheetContent>
          </Sheet>
          <div className="w-9 h-9 md:hidden" aria-hidden="true" />
          <div className="font-display font-bold">Rankings</div>
          <div className="flex items-center gap-1"><NotificationBell testId="organiser-header-bell-mobile" /></div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Rankings</h1>
              <p className="text-muted-foreground mt-1">Track player standings and results across seasons and session series.</p>
            </div>
            <Button variant="outline" className="gap-2 shrink-0" onClick={() => setHowItWorksOpen(true)} data-testid="organiser-rankings-how-it-works">
              <Info className="w-4 h-4" />
              How rankings work?
            </Button>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList data-testid="organiser-rankings-tabs">
              <TabsTrigger value="rankings" data-testid="organiser-rankings-tab-rankings">Rankings</TabsTrigger>
              <TabsTrigger value="results" data-testid="organiser-rankings-tab-results">Competition Results</TabsTrigger>
              <TabsTrigger value="past" data-testid="organiser-rankings-tab-past">Past Seasons</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "rankings" && (
            <>
              {seasonsQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-2xl" data-testid="organiser-rankings-loading" />
              ) : seasons.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-rankings-no-seasons">
                  <CalendarDays className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">No seasons yet</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">Rankings live inside a Season and Series - create a season first, then add a series for each recurring competition.</p>
                  </div>
                  <Button onClick={() => setLocation("/organiser/seasons/new")} data-testid="organiser-rankings-create-season">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Season
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 min-w-0 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="organiser-rankings-filters">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Season</label>
                        <Select value={seasonId} onValueChange={setSeasonId}>
                          <SelectTrigger data-testid="organiser-rankings-filter-season"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {seasons.map((s) => (
                              <SelectItem key={s.id} value={s.id} data-testid={`organiser-rankings-filter-season-${s.id}`}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Series</label>
                        <Select value={seriesId} onValueChange={setSeriesId} disabled={seriesList.length === 0}>
                          <SelectTrigger data-testid="organiser-rankings-filter-series"><SelectValue placeholder={seriesQuery.isLoading ? "Loading..." : "No series yet"} /></SelectTrigger>
                          <SelectContent>
                            {seriesList.map((s) => (
                              <SelectItem key={s.id} value={s.id} data-testid={`organiser-rankings-filter-series-${s.id}`}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Session</label>
                        <Select value={sessionId} onValueChange={setSessionId} disabled={!series}>
                          <SelectTrigger data-testid="organiser-rankings-filter-session"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_SESSIONS} data-testid="organiser-rankings-filter-session-all">All Sessions</SelectItem>
                            {seriesSessions.map((s) => (
                              <SelectItem key={s.id} value={s.id} data-testid={`organiser-rankings-filter-session-${s.id}`}>
                                {formatInTimeZone(s.startAt, s.timeZone, { day: "numeric", month: "long", year: "numeric" })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {!series ? (
                      <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-rankings-no-series">
                        <Trophy className="w-8 h-8 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">No series in {season?.name} yet</p>
                          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Create a series for each recurring competition (e.g. "Wednesday Competition") - each keeps its own independent ranking.</p>
                        </div>
                        <Button onClick={() => setCreateSeriesOpen(true)} data-testid="organiser-rankings-empty-create-series">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Series
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Card data-testid="organiser-rankings-context-card">
                          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Trophy className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h2 className="font-display font-bold text-lg" data-testid="organiser-rankings-context-title">{series.name}</h2>
                              {selectedSession ? (
                                <>
                                  <p className="text-sm text-muted-foreground mt-0.5" data-testid="organiser-rankings-context-subtitle">
                                    {formatInTimeZone(selectedSession.startAt, selectedSession.timeZone, { day: "numeric", month: "long", year: "numeric" })}
                                  </p>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{selectedSession.playersCount} players</span>
                                    <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4" />{selectedSession.roundsCount} rounds</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm text-muted-foreground mt-0.5" data-testid="organiser-rankings-context-subtitle">
                                    Part of {season?.name} · {SESSION_TYPE_OPTIONS.find((t) => t.key === series.format)?.label ?? series.format}
                                  </p>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                                    <span className="flex items-center gap-1.5" data-testid="organiser-rankings-context-sessions"><CalendarDays className="w-4 h-4" />{series.sessionsCount} sessions</span>
                                    <span className="flex items-center gap-1.5" data-testid="organiser-rankings-context-players"><Users className="w-4 h-4" />{totalPlayers || series.playersCount} players</span>
                                    <span>Points system: <span className="font-medium text-foreground">Social Tennis</span></span>
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <Badge className={cn(selectedSession ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400")} data-testid="organiser-rankings-context-badge">
                                {selectedSession ? "Session Results" : "Season Ranking"}
                              </Badge>
                              {season && <p className="text-xs text-muted-foreground">{formatSeasonPeriod(season)}</p>}
                            </div>
                          </CardContent>
                        </Card>

                        {!selectedSession && standings.length > 0 && (
                          <div className="flex flex-wrap gap-3" data-testid="organiser-rankings-podium">
                            {standings.slice(0, 3).map((p, i) => <PodiumCard key={p.userId} pos={i + 1} player={p} />)}
                          </div>
                        )}

                        {!selectedSession ? (
                          standingsQuery.isLoading ? (
                            <Skeleton className="h-64 w-full rounded-2xl" />
                          ) : standings.length === 0 ? (
                            <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-rankings-standings-empty">
                              <Trophy className="w-8 h-8 text-muted-foreground" />
                              <div>
                                <p className="font-semibold">No ranked results yet</p>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                  {seriesSessions.length === 0
                                    ? "Attach sessions to this series, then complete them and confirm scores to see standings here."
                                    : "None of this series' sessions are completed with confirmed scores yet."}
                                </p>
                              </div>
                              <Button variant="outline" onClick={() => setAttachSessionsOpen(true)} data-testid="organiser-rankings-standings-empty-attach">
                                <Plus className="w-4 h-4 mr-2" />
                                Attach Sessions
                              </Button>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-2xl border border-border" data-testid="organiser-rankings-table">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Player</TableHead>
                                    <TableHead className="text-right">Sessions</TableHead>
                                    <TableHead className="text-right">Wins</TableHead>
                                    <TableHead className="text-right">Points</TableHead>
                                    <TableHead className="text-right hidden sm:table-cell">Change</TableHead>
                                    <TableHead className="w-10" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {standings.map((player, i) => (
                                    <TableRow key={player.userId} className="cursor-pointer" onClick={() => setDetailsPlayer(player)} data-testid={`organiser-rankings-row-${player.userId}`}>
                                      <TableCell><RankBadge pos={i + 1} /></TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <Avatar className="h-8 w-8 border border-border shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials(player.userName)}</AvatarFallback></Avatar>
                                          <span className="font-medium truncate">{player.userName}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right">{player.sessionsPlayed}</TableCell>
                                      <TableCell className="text-right">{player.wins}</TableCell>
                                      <TableCell className="text-right font-bold">{player.points.toLocaleString()}</TableCell>
                                      <TableCell className="text-right hidden sm:table-cell"><ChangeIndicator change={player.change} /></TableCell>
                                      <TableCell>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDetailsPlayer(player); }} data-testid={`organiser-rankings-row-${player.userId}-menu`}>
                                          <MoreHorizontal className="w-4 h-4" />
                                          <span className="sr-only">View details</span>
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )
                        ) : sessionResultsQuery.isLoading ? (
                          <Skeleton className="h-64 w-full rounded-2xl" />
                        ) : sessionResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-rankings-session-results-empty">
                            {selectedSession?.status === "completed" ? "No confirmed scores for this session." : "This session hasn't been completed yet."}
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-border" data-testid="organiser-rankings-session-results-table">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">#</TableHead>
                                  <TableHead>Player</TableHead>
                                  <TableHead className="text-right">Matches</TableHead>
                                  <TableHead className="text-right">Wins</TableHead>
                                  <TableHead className="text-right">Session Points</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sessionResults.map((row, i) => (
                                  <TableRow key={row.userId} data-testid={`organiser-rankings-session-row-${row.userId}`}>
                                    <TableCell><RankBadge pos={i + 1} /></TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <Avatar className="h-8 w-8 border border-border shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials(row.userName)}</AvatarFallback></Avatar>
                                        <span className="font-medium truncate">{row.userName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">{row.matchesPlayed}</TableCell>
                                    <TableCell className="text-right">{row.wins}</TableCell>
                                    <TableCell className="text-right font-bold">{row.points}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {series && (
                    <aside className="w-full lg:w-80 shrink-0 space-y-4" data-testid="organiser-rankings-sidebar">
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Series sessions</h3>
                            <button type="button" className="text-xs font-medium text-primary flex items-center gap-0.5" onClick={() => setAttachSessionsOpen(true)} data-testid="organiser-rankings-sidebar-attach">
                              <Plus className="w-3 h-3" /> Attach
                            </button>
                          </div>
                          {sessionsQuery.isLoading ? (
                            <Skeleton className="h-32 w-full rounded-xl" />
                          ) : seriesSessions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No sessions attached yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {seriesSessions.slice(0, 5).map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => setSessionId(s.id)}
                                  className={cn("w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors", sessionId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40")}
                                  data-testid={`organiser-rankings-sidebar-session-${s.id}`}
                                >
                                  <div className="w-10 text-center shrink-0">
                                    <p className="text-xs font-bold leading-none">{formatInTimeZone(s.startAt, s.timeZone, { day: "numeric" })}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{formatInTimeZone(s.startAt, s.timeZone, { month: "short" })}</p>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{s.title}</p>
                                    <p className="text-xs text-muted-foreground">{formatInTimeZone(s.startAt, s.timeZone, { hour: "numeric", minute: "2-digit" })} · {s.playersCount} players</p>
                                  </div>
                                  <Badge variant="outline" className={cn("text-[10px] shrink-0", s.status === "completed" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30" : "bg-muted text-muted-foreground")}>
                                    {s.status === "completed" ? "Completed" : s.status}
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {season && (
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-sm">Season info</h3>
                              <Link href={`/organiser/seasons/${season.id}`} className="text-xs font-medium text-primary flex items-center gap-0.5" data-testid="organiser-rankings-sidebar-view-season">
                                View season <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                            <ul className="text-sm space-y-2 text-muted-foreground">
                              <li className="flex items-center gap-2"><CalendarDays className="w-4 h-4 shrink-0" />{formatSeasonPeriod(season)}</li>
                              <li className="flex items-center gap-2">
                                <span className={cn("w-2 h-2 rounded-full shrink-0", SEASON_STATUS_STYLE[seasonStatus(season)])} />
                                {season.name} ({SEASON_STATUS_LABEL[seasonStatus(season)]})
                              </li>
                              <li className="flex items-center gap-2"><Users className="w-4 h-4 shrink-0" />{seriesList.length} series in this season</li>
                              <li className="flex items-center gap-2"><Trophy className="w-4 h-4 shrink-0" />{season.sessionsCount} sessions · {season.playersCount} players total</li>
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      <Card className="border-primary/30 bg-primary/5">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center gap-2 font-semibold text-sm"><Trophy className="w-4 h-4 text-primary" />About rankings</div>
                          <p className="text-sm text-muted-foreground">This ranking shows accumulated points from all completed, confirmed sessions in the selected series. Each series has its own independent ranking within the season.</p>
                          <button type="button" className="text-sm font-medium text-primary flex items-center gap-0.5" onClick={() => setHowItWorksOpen(true)} data-testid="organiser-rankings-sidebar-learn-more">
                            Learn more <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </CardContent>
                      </Card>
                    </aside>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "results" && (
            <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-rankings-results-empty">
              <Trophy className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">Competition Results isn't built yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">One-off Championships and Tournaments will show their own independent results here, separate from every Series Ranking above.</p>
              </div>
            </div>
          )}

          {tab === "past" && (
            <div className="space-y-3" data-testid="organiser-rankings-past-seasons-list">
              {seasons.filter((s) => seasonStatus(s) === "completed").map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSeasonId(s.id); setTab("rankings"); }}
                  className="w-full text-left flex items-center justify-between gap-4 rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors"
                  data-testid={`organiser-rankings-past-season-${s.id}`}
                >
                  <div>
                    <p className="font-display font-bold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{formatSeasonPeriod(s)} · {s.sessionsCount} sessions</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
              {seasons.filter((s) => seasonStatus(s) === "completed").length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-rankings-past-seasons-empty">
                  No completed seasons yet - final standings will appear here once a season ends.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <OrganiserMobileNav />

      <Sheet open={!!detailsPlayer} onOpenChange={(open) => !open && setDetailsPlayer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md" data-testid="organiser-rankings-player-details">
          <SheetTitle className="sr-only">Player ranking details</SheetTitle>
          {detailsPlayer && series && (
            <div className="pt-6 space-y-6">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border border-border"><AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(detailsPlayer.userName)}</AvatarFallback></Avatar>
                <div>
                  <h3 className="font-display font-bold text-lg" data-testid="organiser-rankings-player-details-name">{detailsPlayer.userName}</h3>
                  <p className="text-sm text-muted-foreground">#{detailsPos} — {series.name}</p>
                  <p className="text-xs text-muted-foreground">{season?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border p-3"><p className="text-lg font-bold" data-testid="organiser-rankings-player-details-points">{detailsPlayer.points.toLocaleString()}</p><p className="text-xs text-muted-foreground">Points</p></div>
                <div className="rounded-xl border border-border p-3"><p className="text-lg font-bold">{detailsPlayer.sessionsPlayed}</p><p className="text-xs text-muted-foreground">Sessions</p></div>
                <div className="rounded-xl border border-border p-3"><p className="text-lg font-bold">{detailsPlayer.wins}</p><p className="text-xs text-muted-foreground">Wins</p></div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Recent form</h4>
                {formQuery.isLoading ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : recentForm.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed sessions yet.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader><TableRow><TableHead>Session</TableHead><TableHead>Result</TableHead><TableHead className="text-right">Points</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {recentForm.map((row) => (
                          <TableRow key={row.sessionId}>
                            <TableCell>{new Date(row.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</TableCell>
                            <TableCell>{row.position === 1 ? "1st" : row.position === 2 ? "2nd" : row.position === 3 ? "3rd" : `${row.position}th`}</TableCell>
                            <TableCell className="text-right font-medium">+{row.points}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent data-testid="organiser-rankings-how-it-works-dialog">
          <DialogHeader>
            <DialogTitle>How rankings work</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-foreground/90 text-left pt-2">
                <p>Each Season can contain several independent Series (e.g. Tuesday, Wednesday, Thursday Competition). Every Series keeps its own Ranking, built from its own attached sessions only - results never mix between series.</p>
                <p>Points come from confirmed match scores: 25 pts per win, 12 per draw, 1 per game won. Selecting <strong>All Sessions</strong> shows the accumulated total; selecting one session shows just that day's results.</p>
                <p>A session only counts once it's attached to a series and marked completed with confirmed scores. Casual sessions can simply stay unattached to opt out of Rankings entirely.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={createSeriesOpen} onOpenChange={setCreateSeriesOpen}>
        <DialogContent data-testid="organiser-rankings-create-series-dialog">
          <DialogHeader>
            <DialogTitle>Create Series</DialogTitle>
            <DialogDescription>A Series is a recurring competition within {season?.name} - each keeps its own independent ranking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="series-name">Series Name *</Label>
              <Input id="series-name" value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="Wednesday Competition" data-testid="organiser-rankings-create-series-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="series-format">Session Format *</Label>
              <Select value={newSeriesFormat} onValueChange={setNewSeriesFormat}>
                <SelectTrigger id="series-format" data-testid="organiser-rankings-create-series-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPE_OPTIONS.map((opt) => <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="series-description">Description</Label>
              <Textarea id="series-description" value={newSeriesDescription} onChange={(e) => setNewSeriesDescription(e.target.value)} placeholder="Weekly Wednesday competition." data-testid="organiser-rankings-create-series-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSeriesOpen(false)}>Cancel</Button>
            <Button
              disabled={!newSeriesName.trim() || createSeriesMutation.isPending}
              onClick={() => createSeriesMutation.mutate()}
              data-testid="organiser-rankings-create-series-submit"
            >
              {createSeriesMutation.isPending ? "Creating..." : "Create Series"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attachSessionsOpen} onOpenChange={(open) => { setAttachSessionsOpen(open); if (!open) setSelectedToAttach(new Set()); }}>
        <DialogContent data-testid="organiser-rankings-attach-sessions-dialog">
          <DialogHeader>
            <DialogTitle>Attach sessions to {series?.name}</DialogTitle>
            <DialogDescription>Results from selected sessions will contribute to this series' ranking for {season?.name}.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2 py-2">
            {seasonSessionsQuery.isLoading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : attachableSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No unattached sessions in {season?.name} - create or add sessions to this season first, from the Sessions page.
              </p>
            ) : (
              attachableSessions.map((s) => (
                <label key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-accent/40" data-testid={`organiser-rankings-attach-session-${s.id}`}>
                  <Checkbox
                    checked={selectedToAttach.has(s.id)}
                    onCheckedChange={(checked) => {
                      setSelectedToAttach((prev) => {
                        const next = new Set(prev);
                        checked ? next.add(s.id) : next.delete(s.id);
                        return next;
                      });
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{formatInTimeZone(s.startAt, s.timeZone, { day: "numeric", month: "short", year: "numeric" })} · {s.status}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachSessionsOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedToAttach.size === 0 || attachSessionsMutation.isPending}
              onClick={() => attachSessionsMutation.mutate()}
              data-testid="organiser-rankings-attach-sessions-submit"
            >
              {attachSessionsMutation.isPending ? "Attaching..." : `Attach ${selectedToAttach.size || ""} session${selectedToAttach.size === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
