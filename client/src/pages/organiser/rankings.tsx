import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Minus,
  Crown,
  Award,
  Info,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import {
  mockRankingSeasons,
  mockChampionships,
  getRecentFormForPlayer,
  type RankingPlayerRow,
  type RankingSeries,
} from "@/lib/organiser-rankings-mock-data";

const ALL_SESSIONS = "all";

const RANK_STYLE: Record<number, string> = {
  1: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  2: "bg-slate-200 text-slate-700 dark:bg-slate-400/20 dark:text-slate-300",
  3: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
};

function RankBadge({ pos }: { pos: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0",
        RANK_STYLE[pos] ?? "bg-muted text-muted-foreground"
      )}
    >
      {pos}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 text-sm font-medium">
        <ArrowUp className="w-3.5 h-3.5" /> {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 text-sm font-medium">
        <ArrowDown className="w-3.5 h-3.5" /> {Math.abs(change)}
      </span>
    );
  }
  return <span className="inline-flex items-center text-muted-foreground text-sm">—</span>;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PodiumCard({ pos, player }: { pos: number; player: RankingPlayerRow }) {
  const medalIcon = pos === 1 ? <Crown className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />;
  const bg = pos === 1 ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30" : pos === 2 ? "bg-slate-50 border-slate-200 dark:bg-slate-400/10 dark:border-slate-400/30" : "bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30";

  return (
    <div className={cn("flex-1 min-w-[9rem] flex items-center gap-3 rounded-2xl border p-3", bg)} data-testid={`organiser-rankings-podium-${pos}`}>
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11 border border-border">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials(player.name)}</AvatarFallback>
        </Avatar>
        <span className={cn("absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center", RANK_STYLE[pos])}>
          {medalIcon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate" data-testid={`organiser-rankings-podium-${pos}-name`}>{player.name}</p>
        <p className="text-green-600 dark:text-green-400 font-bold text-sm" data-testid={`organiser-rankings-podium-${pos}-points`}>
          {player.points.toLocaleString()} pts
        </p>
      </div>
    </div>
  );
}

export default function OrganiserRankingsPage() {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false } : mockOrganiser;

  const [tab, setTab] = useState<"rankings" | "results" | "past">("rankings");
  const [seasonId, setSeasonId] = useState(mockRankingSeasons[0].id);
  const season = mockRankingSeasons.find((s) => s.id === seasonId) ?? mockRankingSeasons[0];

  const [seriesId, setSeriesId] = useState(season.series[0]?.id);
  const series: RankingSeries | undefined = season.series.find((s) => s.id === seriesId) ?? season.series[0];

  const [sessionId, setSessionId] = useState<string>(ALL_SESSIONS);
  const selectedSession = series?.sessions.find((s) => s.id === sessionId);

  const [detailsPlayer, setDetailsPlayer] = useState<RankingPlayerRow | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const totalPlayers = useMemo(() => {
    if (!series) return 0;
    return new Set(series.standings.map((p) => p.playerId)).size;
  }, [series]);

  const handleSeasonChange = (id: string) => {
    setSeasonId(id);
    const nextSeason = mockRankingSeasons.find((s) => s.id === id);
    setSeriesId(nextSeason?.series[0]?.id ?? "");
    setSessionId(ALL_SESSIONS);
  };

  const handleSeriesChange = (id: string) => {
    setSeriesId(id);
    setSessionId(ALL_SESSIONS);
  };

  const recentForm = detailsPlayer && series ? getRecentFormForPlayer(series, detailsPlayer.playerId) : [];
  const detailsPos = detailsPlayer && series ? series.standings.findIndex((p) => p.playerId === detailsPlayer.playerId) + 1 : 0;

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-rankings-page">
      <SEO
        title="Rankings | Organiser Hub | TennisConnect"
        description="Track player standings and results across seasons and session series."
        noIndex
      />

      <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-64")}>
        <OrganiserSidebarNav
          organiser={organiser}
          profileHref={profileHref}
          className="w-full"
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
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
          <div className="flex items-center gap-1">
            <NotificationBell testId="organiser-header-bell-mobile" />
          </div>
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

          {tab === "rankings" && series && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 min-w-0 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="organiser-rankings-filters">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Season</label>
                    <Select value={seasonId} onValueChange={handleSeasonChange}>
                      <SelectTrigger data-testid="organiser-rankings-filter-season"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {mockRankingSeasons.map((s) => (
                          <SelectItem key={s.id} value={s.id} data-testid={`organiser-rankings-filter-season-${s.id}`}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Series</label>
                    <Select value={seriesId} onValueChange={handleSeriesChange}>
                      <SelectTrigger data-testid="organiser-rankings-filter-series"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {season.series.map((s) => (
                          <SelectItem key={s.id} value={s.id} data-testid={`organiser-rankings-filter-series-${s.id}`}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Session</label>
                    <Select value={sessionId} onValueChange={setSessionId}>
                      <SelectTrigger data-testid="organiser-rankings-filter-session"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_SESSIONS} data-testid="organiser-rankings-filter-session-all">All Sessions</SelectItem>
                        {series.sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id} data-testid={`organiser-rankings-filter-session-${s.id}`}>{s.fullDate}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Card data-testid="organiser-rankings-context-card">
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display font-bold text-lg" data-testid="organiser-rankings-context-title">
                        {selectedSession ? series.name : series.name}
                      </h2>
                      {selectedSession ? (
                        <>
                          <p className="text-sm text-muted-foreground mt-0.5" data-testid="organiser-rankings-context-subtitle">
                            {selectedSession.fullDate}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{selectedSession.players} players</span>
                            <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4" />{selectedSession.rounds} rounds</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground mt-0.5" data-testid="organiser-rankings-context-subtitle">
                            Part of {season.name} · {series.format}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                            <span className="flex items-center gap-1.5" data-testid="organiser-rankings-context-sessions"><CalendarDays className="w-4 h-4" />{series.sessions.length} sessions</span>
                            <span className="flex items-center gap-1.5" data-testid="organiser-rankings-context-players"><Users className="w-4 h-4" />{totalPlayers} players</span>
                            <span>Points system: <span className="font-medium text-foreground">{series.pointsSystemLabel}</span></span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <Badge className={cn(selectedSession ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400")} data-testid="organiser-rankings-context-badge">
                        {selectedSession ? "Session Results" : "Season Ranking"}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{season.period}</p>
                    </div>
                  </CardContent>
                </Card>

                {!selectedSession && (
                  <div className="flex flex-wrap gap-3" data-testid="organiser-rankings-podium">
                    {series.standings.slice(0, 3).map((p, i) => (
                      <PodiumCard key={p.playerId} pos={i + 1} player={p} />
                    ))}
                  </div>
                )}

                {!selectedSession ? (
                  <div className="overflow-x-auto rounded-2xl border border-border" data-testid="organiser-rankings-table">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead className="hidden sm:table-cell">Level</TableHead>
                          <TableHead className="text-right">Sessions</TableHead>
                          <TableHead className="text-right">Wins</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Change</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {series.standings.map((player, i) => (
                          <TableRow
                            key={player.playerId}
                            className="cursor-pointer"
                            onClick={() => setDetailsPlayer(player)}
                            data-testid={`organiser-rankings-row-${player.playerId}`}
                          >
                            <TableCell><RankBadge pos={i + 1} /></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar className="h-8 w-8 border border-border shrink-0">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials(player.name)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium truncate">{player.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">{player.level}</TableCell>
                            <TableCell className="text-right">{player.sessionsPlayed}</TableCell>
                            <TableCell className="text-right">{player.wins}</TableCell>
                            <TableCell className="text-right font-bold">{player.points.toLocaleString()}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell"><ChangeIndicator change={player.change} /></TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailsPlayer(player);
                                }}
                                data-testid={`organiser-rankings-row-${player.playerId}-menu`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                                <span className="sr-only">View details</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
                        {selectedSession.results.map((row, i) => (
                          <TableRow key={row.playerId} data-testid={`organiser-rankings-session-row-${row.playerId}`}>
                            <TableCell><RankBadge pos={i + 1} /></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar className="h-8 w-8 border border-border shrink-0">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials(row.name)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium truncate">{row.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{row.matches}</TableCell>
                            <TableCell className="text-right">{row.wins}</TableCell>
                            <TableCell className="text-right font-bold">{row.sessionPoints}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <aside className="w-full lg:w-80 shrink-0 space-y-4" data-testid="organiser-rankings-sidebar">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Series sessions</h3>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary flex items-center gap-0.5"
                        onClick={() => setSessionId(ALL_SESSIONS)}
                        data-testid="organiser-rankings-sidebar-view-all"
                      >
                        View all <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {series.sessions.slice(0, 5).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSessionId(s.id)}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                            sessionId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
                          )}
                          data-testid={`organiser-rankings-sidebar-session-${s.id}`}
                        >
                          <div className="w-10 text-center shrink-0">
                            <p className="text-xs font-bold leading-none">{s.dayLabel}</p>
                            <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{s.monthLabel}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{series.name}</p>
                            <p className="text-xs text-muted-foreground">{s.time} · {s.players} players</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30">
                            {s.status}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Season info</h3>
                      <Link href={`/organiser/seasons/${season.id}`} className="text-xs font-medium text-primary flex items-center gap-0.5" data-testid="organiser-rankings-sidebar-view-season">
                        View season <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li className="flex items-center gap-2"><CalendarDays className="w-4 h-4 shrink-0" />{season.period}</li>
                      <li className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", season.status === "Active" ? "bg-green-500" : season.status === "Upcoming" ? "bg-amber-500" : "bg-muted-foreground")} />
                        {season.name} ({season.status})
                      </li>
                      <li className="flex items-center gap-2"><Users className="w-4 h-4 shrink-0" />{season.series.length} series ({season.series.map((s) => s.name.split(" ")[0]).join(", ")})</li>
                      <li className="flex items-center gap-2"><Trophy className="w-4 h-4 shrink-0" />{season.series.reduce((sum, s) => sum + s.sessions.length, 0)} completed sessions</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Trophy className="w-4 h-4 text-primary" />
                      About rankings
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This ranking shows accumulated points from all completed sessions in the selected series.
                      Each series has its own independent ranking within the season.
                    </p>
                    <button
                      type="button"
                      className="text-sm font-medium text-primary flex items-center gap-0.5"
                      onClick={() => setHowItWorksOpen(true)}
                      data-testid="organiser-rankings-sidebar-learn-more"
                    >
                      Learn more <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}

          {tab === "results" && (
            <div className="space-y-3" data-testid="organiser-rankings-results-list">
              {mockChampionships.map((c) => (
                <Card key={c.id} data-testid={`organiser-rankings-championship-${c.id}`}>
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold">{c.name}</h3>
                        <Badge variant="outline">Championship</Badge>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">{c.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{c.players} players · independent from series rankings</p>
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        {c.podium.map((p, i) => (
                          <span key={p.playerId} className="flex items-center gap-1.5 text-sm font-medium">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {tab === "past" && (
            <div className="space-y-3" data-testid="organiser-rankings-past-seasons-list">
              {mockRankingSeasons.filter((s) => s.status === "Completed").map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    handleSeasonChange(s.id);
                    setTab("rankings");
                  }}
                  className="w-full text-left flex items-center justify-between gap-4 rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors"
                  data-testid={`organiser-rankings-past-season-${s.id}`}
                >
                  <div>
                    <p className="font-display font-bold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.period} · {s.series.length} series</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
              {mockRankingSeasons.filter((s) => s.status === "Completed").length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-rankings-past-seasons-empty">
                  No completed seasons yet — final standings will appear here once a season ends.
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
                <Avatar className="h-14 w-14 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(detailsPlayer.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-display font-bold text-lg" data-testid="organiser-rankings-player-details-name">{detailsPlayer.name}</h3>
                  <p className="text-sm text-muted-foreground">#{detailsPos} — {series.name}</p>
                  <p className="text-xs text-muted-foreground">{season.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-lg font-bold" data-testid="organiser-rankings-player-details-points">{detailsPlayer.points.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-lg font-bold">{detailsPlayer.sessionsPlayed}</p>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-lg font-bold">{detailsPlayer.wins}</p>
                  <p className="text-xs text-muted-foreground">Wins</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Recent form</h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentForm.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.result}</TableCell>
                          <TableCell className="text-right font-medium">+{row.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
                <p>Each Season can contain several independent Series (e.g. Tuesday, Wednesday, Thursday Competition). Every Series keeps its own Ranking — results never mix between them.</p>
                <p>Selecting <strong>All Sessions</strong> shows the accumulated Series Ranking for the Season. Selecting one Session shows just that day's results instead.</p>
                <p>Casual sessions can opt out of Rankings entirely, and one-off Championships stay independent unless you configure otherwise.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
