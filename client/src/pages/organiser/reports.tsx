import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Menu,
  Users,
  CalendarDays,
  Percent,
  Repeat,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  X,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { seasonStatus, formatSeasonPeriod } from "@/lib/season-utils";
import { getSeasons } from "@/lib/api/organizer-sessions";
import { getSeriesForSeason } from "@/lib/api/organizer-rankings";
import { getReportsData } from "@/lib/api/organizer-reports";
import type { ReportsPeriod } from "@shared/schema";

const PERIOD_OPTIONS: { value: ReportsPeriod; label: string }[] = [
  { value: "this_season", label: "This Season" },
  { value: "previous_season", label: "Previous Season" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "custom", label: "Custom Range" },
];

function comparisonLabel(period: ReportsPeriod): string {
  switch (period) {
    case "this_season":
      return "vs previous season";
    case "last_30_days":
      return "vs previous 30 days";
    case "last_3_months":
      return "vs previous 3 months";
    default:
      return "vs previous period";
  }
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function ComparisonBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  if (value === 0) {
    return <p className="text-xs text-muted-foreground mt-1">— {label}</p>;
  }
  const up = value > 0;
  return (
    <p className={cn("text-xs mt-1 flex items-center gap-0.5", up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
      {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(value)}% <span className="text-muted-foreground">{label}</span>
    </p>
  );
}

function KpiCard({
  icon: Icon,
  iconClass,
  value,
  label,
  comparison,
  comparisonText,
  testId,
}: {
  icon: typeof Users;
  iconClass: string;
  value: string;
  label: string;
  comparison: number | null;
  comparisonText: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4 sm:p-5 flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight" data-testid={`${testId}-value`}>{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          <ComparisonBadge value={comparison} label={comparisonText} />
        </div>
      </CardContent>
    </Card>
  );
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const EMPTY_STATE_COPY: Record<string, { title: string; body: string }> = {
  no_org_data: {
    title: "Not enough data yet",
    body: "Reports will appear after your sessions start collecting registrations and attendance.",
  },
  no_season_data: {
    title: "No completed sessions yet",
    body: "Reports for this period will appear after the first session is completed.",
  },
  no_series_data: {
    title: "No report data for this series yet",
    body: "Reports will appear once this series has a completed session with attendance recorded.",
  },
};

export default function OrganiserReportsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false } : mockOrganiser;

  const [period, setPeriod] = useState<ReportsPeriod>("this_season");
  const [seasonId, setSeasonId] = useState<string>("");
  const [seriesId, setSeriesId] = useState<string | undefined>(undefined);
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const seasonsQuery = useQuery({
    queryKey: ["/api/organizer/seasons"],
    queryFn: getSeasons,
    enabled: isAuthenticated,
  });
  const seasons = seasonsQuery.data ?? [];

  useEffect(() => {
    if (seasonId || seasons.length === 0) return;
    const active = seasons.find((s) => seasonStatus(s) === "active");
    setSeasonId((active ?? seasons[0]).id);
  }, [seasons, seasonId]);

  const seasonAware = period === "this_season" || period === "previous_season";

  const seriesQuery = useQuery({
    queryKey: ["/api/organizer/seasons", seasonId, "series"],
    queryFn: () => getSeriesForSeason(seasonId),
    enabled: !!seasonId,
  });
  const seriesList = seriesQuery.data ?? [];
  const selectedSeries = seriesList.find((s) => s.id === seriesId);

  useEffect(() => {
    setSeriesId(undefined);
  }, [seasonId]);

  const filtersReady = period === "custom" ? !!customFrom && !!customTo : true;

  const reportsQuery = useQuery({
    queryKey: [
      "/api/organizer/reports",
      period,
      seasonAware ? seasonId : null,
      seriesId ?? null,
      period === "custom" ? customFrom : null,
      period === "custom" ? customTo : null,
    ],
    queryFn: () =>
      getReportsData({
        period,
        seasonId: seasonAware ? seasonId : undefined,
        seriesId,
        from: period === "custom" ? customFrom : undefined,
        to: period === "custom" ? customTo : undefined,
      }),
    enabled: isAuthenticated && filtersReady && seasonsQuery.isFetched && (!seasonAware || seasons.length === 0 || !!seasonId),
  });
  const data = reportsQuery.data;

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

  const emptyCopy = data?.emptyReason ? EMPTY_STATE_COPY[data.emptyReason] : null;

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-reports-page">
      <SEO title="Reports | Organiser Hub | TennisConnect" description="Understand participation and attendance across your sessions." noIndex />

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
          <div className="font-display font-bold">Reports</div>
          <div className="flex items-center gap-1"><NotificationBell testId="organiser-header-bell-mobile" /></div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">Understand participation and attendance across your sessions.</p>
          </div>

          <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", period === "custom" ? "lg:grid-cols-5" : "lg:grid-cols-3")} data-testid="organiser-reports-filters">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Period</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as ReportsPeriod)}>
                <SelectTrigger data-testid="organiser-reports-filter-period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} data-testid={`organiser-reports-filter-period-${opt.value}`}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Season</label>
              <Select value={seasonId} onValueChange={setSeasonId} disabled={!seasonAware || seasons.length === 0}>
                <SelectTrigger data-testid="organiser-reports-filter-season"><SelectValue placeholder="No seasons yet" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`organiser-reports-filter-season-${s.id}`}>{s.name} ({formatSeasonPeriod(s)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Series</label>
              <Select value={seriesId ?? "all"} onValueChange={(v) => setSeriesId(v === "all" ? undefined : v)} disabled={!seasonId}>
                <SelectTrigger data-testid="organiser-reports-filter-series"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="organiser-reports-filter-series-all">All Series</SelectItem>
                  {seriesList.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`organiser-reports-filter-series-${s.id}`}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">From</label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} data-testid="organiser-reports-filter-from" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">To</label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} data-testid="organiser-reports-filter-to" />
                </div>
              </>
            )}
          </div>

          {seriesId && (
            <button
              type="button"
              onClick={() => setSeriesId(undefined)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
              data-testid="organiser-reports-clear-series"
            >
              <X className="w-3.5 h-3.5" />
              Clear filter ({selectedSeries?.name ?? "series"})
            </button>
          )}

          {reportsQuery.isLoading || !data ? (
            <div className="space-y-4" data-testid="organiser-reports-loading">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
          ) : emptyCopy ? (
            <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-reports-empty">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">{emptyCopy.title}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">{emptyCopy.body}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="organiser-reports-kpis">
                <KpiCard
                  icon={Users}
                  iconClass="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                  value={String(data.kpis.uniquePlayers)}
                  label="Unique Players"
                  comparison={data.comparison.uniquePlayers}
                  comparisonText={comparisonLabel(period)}
                  testId="organiser-reports-kpi-unique-players"
                />
                <KpiCard
                  icon={CalendarDays}
                  iconClass="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                  value={String(data.kpis.sessionsHeld)}
                  label="Sessions Held"
                  comparison={data.comparison.sessionsHeld}
                  comparisonText={comparisonLabel(period)}
                  testId="organiser-reports-kpi-sessions-held"
                />
                <KpiCard
                  icon={Percent}
                  iconClass="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                  value={`${data.kpis.attendanceRate}%`}
                  label="Attendance Rate"
                  comparison={data.comparison.attendanceRate}
                  comparisonText={comparisonLabel(period)}
                  testId="organiser-reports-kpi-attendance-rate"
                />
                <KpiCard
                  icon={Repeat}
                  iconClass="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
                  value={`${data.kpis.returningPlayers}%`}
                  label="Returning Players"
                  comparison={data.comparison.returningPlayers}
                  comparisonText={comparisonLabel(period)}
                  testId="organiser-reports-kpi-returning-players"
                />
              </div>

              <Card data-testid="organiser-reports-participation-chart">
                <CardContent className="p-4 sm:p-5">
                  <h2 className="font-display font-bold text-lg">Player Participation</h2>
                  <p className="text-sm text-muted-foreground mb-4">Registered vs attended players over time.</p>
                  {data.participation.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No sessions in this period yet.</p>
                  ) : (
                    <div className="h-64 sm:h-80 -ml-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.participation} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="registeredFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#86efac" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#86efac" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                          <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={30} />
                          <Tooltip
                            labelFormatter={(v) => formatShortDate(v as string)}
                            formatter={(value: number, name: string) => [value, name === "registered" ? "Registered" : "Attended"]}
                            contentStyle={{ borderRadius: 12, fontSize: 13 }}
                          />
                          <Area type="monotone" dataKey="registered" stroke="#4ade80" strokeWidth={2} fill="url(#registeredFill)" name="registered" />
                          <Area type="monotone" dataKey="attended" stroke="#15803d" strokeWidth={2} fill="transparent" name="attended" />
                        </AreaChart>
                      </ResponsiveContainer>
                      <div className="flex items-center gap-4 justify-center mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />Registered</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#15803d]" />Attended</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {seriesId ? (
                  <Card data-testid="organiser-reports-session-performance">
                    <CardContent className="p-4 sm:p-5">
                      <h2 className="font-display font-bold text-lg">Session Performance — {selectedSeries?.name}</h2>
                      <p className="text-sm text-muted-foreground mb-3">How each session in this series performed.</p>
                      {data.sessionPerformance.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No completed sessions in this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Session</TableHead>
                                <TableHead className="text-right">Registered</TableHead>
                                <TableHead className="text-right">Attended</TableHead>
                                <TableHead className="text-right">Attendance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.sessionPerformance.map((row) => (
                                <TableRow key={row.sessionId} data-testid={`organiser-reports-session-row-${row.sessionId}`}>
                                  <TableCell className="font-medium">{formatShortDate(row.date)}</TableCell>
                                  <TableCell className="text-right">{row.registered}</TableCell>
                                  <TableCell className="text-right">{row.attended}</TableCell>
                                  <TableCell className="text-right font-medium">{row.attendanceRate}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card data-testid="organiser-reports-series-performance">
                    <CardContent className="p-4 sm:p-5">
                      <h2 className="font-display font-bold text-lg">Series Performance</h2>
                      <p className="text-sm text-muted-foreground mb-3">Compare how your different series are performing.</p>
                      {data.seriesPerformance.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No sessions attached to a series in this period yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Series</TableHead>
                                <TableHead className="text-right">Sessions</TableHead>
                                <TableHead className="text-right hidden sm:table-cell">Avg. Players</TableHead>
                                <TableHead className="text-right">Attendance</TableHead>
                                <TableHead className="text-right hidden sm:table-cell">Returning</TableHead>
                                <TableHead className="w-8" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.seriesPerformance.map((row) => (
                                <TableRow
                                  key={row.seriesId}
                                  className="cursor-pointer"
                                  onClick={() => setSeriesId(row.seriesId)}
                                  data-testid={`organiser-reports-series-row-${row.seriesId}`}
                                >
                                  <TableCell className="font-medium">{row.seriesName}</TableCell>
                                  <TableCell className="text-right">{row.sessions}</TableCell>
                                  <TableCell className="text-right hidden sm:table-cell">{row.avgPlayers}</TableCell>
                                  <TableCell className="text-right">{row.attendanceRate}%</TableCell>
                                  <TableCell className="text-right hidden sm:table-cell">{row.returningPlayers}%</TableCell>
                                  <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card data-testid="organiser-reports-player-activity">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-display font-bold text-lg">Player Activity</h2>
                      <Link href="/organiser/players" className="text-sm font-medium text-primary flex items-center gap-0.5 shrink-0" data-testid="organiser-reports-view-all-players">
                        View all players <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Most active players in this period.</p>
                    {data.playerActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No registrations recorded for this period yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Player</TableHead>
                              <TableHead className="text-right">Sessions</TableHead>
                              <TableHead className="text-right hidden sm:table-cell">Attended</TableHead>
                              <TableHead className="text-right">Attendance</TableHead>
                              <TableHead className="text-right hidden sm:table-cell">Last Played</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.playerActivity.map((row) => (
                              <TableRow
                                key={row.userId}
                                className={cn(row.userSlug && "cursor-pointer")}
                                onClick={() => row.userSlug && setLocation(`/organiser/players/${row.userSlug}`)}
                                data-testid={`organiser-reports-player-row-${row.userId}`}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Avatar className="h-8 w-8 border border-border shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials(row.userName)}</AvatarFallback></Avatar>
                                    <span className="font-medium truncate">{row.userName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{row.sessions}</TableCell>
                                <TableCell className="text-right hidden sm:table-cell">{row.attended}</TableCell>
                                <TableCell className="text-right font-medium">{row.attendanceRate}%</TableCell>
                                <TableCell className="text-right hidden sm:table-cell text-muted-foreground">{row.lastPlayed ? formatShortDate(row.lastPlayed) : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>

      <OrganiserMobileNav />
    </div>
  );
}
