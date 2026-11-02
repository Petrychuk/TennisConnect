import { ConnectWord } from "@/components/ui/brandBall";
import { OrganiserAccessGate } from "@/components/organiser/ui/organiser-layout";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Hourglass,
  Trophy,
  LayoutDashboard,
  Users,
  Repeat,
  ClipboardList,
  MessageSquare,
  Settings,
  Square,
  Percent,
  WifiOff,
} from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import {
  getSessionById,
  getSessionRegistrations,
  checkInRegistration,
  setRegistrationLiveStatus,
  goLiveSession,
  generateNextRound,
  getCurrentRound,
  startMatch,
  reportMatchScore,
  finishSession,
  getSessionLeaderboard,
} from "@/lib/api/organizer-sessions";
import { apiErrorInfo } from "@/lib/api-error";
import { liveAvailableFor, useLiveMode, type LiveMode } from "@/lib/use-live-available";
import { MessagesTab } from "@/components/organiser/sessions/workspace/messages-tab";
import { RoundsTab } from "@/components/organiser/sessions/workspace/rounds-tab";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import type { MatchWithPlayers, RegistrationWithUser } from "@shared/schema";
import { goLiveProblem, liveModeOf, MAX_GAMES, roundProblem, scoreProblem } from "@shared/liveRules";
import { cn } from "@/lib/utils";

/*
  TC Live v1 control centre (Social Play singles & doubles).

    published  check-in list + Go Live
    live       courts and score entry, players (late arrivals, unavailable,
               withdrawn), round history, leaderboard, messages, End Session
    completed  final leaderboard and every round (read-only)

  Everything is server state: a reload, a second device or a dropped
  connection shows the same session (queries refetch every 10 s while live,
  on focus and on reconnect). The server enforces every rule
  (server/routes/organizer.ts, shared/liveRules.ts); this screen disables a
  control with the same reason the server would give.

  Availability: TC_LIVE_ENABLED (server/lib/liveFeature.ts) via
  useLiveMode(). Switched off, a session that is still live can only be
  ended, and finished sessions stay readable - the kill switch never hides
  history.
*/

type LiveTab = "overview" | "players" | "rounds" | "leaderboard" | "messages" | "settings";

const NAV_ITEMS: { key: LiveTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Courts", icon: LayoutDashboard },
  { key: "players", label: "Players", icon: Users },
  { key: "rounds", label: "Rounds", icon: Repeat },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "settings", label: "Settings", icon: Settings },
];

const LIVE_REFRESH_MS = 10_000;

/** Registered, checked in, not marked unavailable/withdrawn - who a round draws from. */
const isAvailable = (r: RegistrationWithUser) => r.status === "registered" && !!r.checkedInAt && !r.liveStatus;

function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function OrganiserSessionLivePageContent() {
  const [, params] = useRoute("/organiser/sessions/:id/live");
  const sessionId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LiveTab>("overview");
  const [busy, setBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [unscored, setUnscored] = useState<number | null>(null);
  const online = useOnline();
  const mode = useLiveMode();

  const sessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId],
    queryFn: () => getSessionById(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => ((query.state.data as any)?.status === "live" ? LIVE_REFRESH_MS : false),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const session = sessionQuery.data;
  const status = session?.status;
  const allowed = !!session && liveAvailableFor(mode, session);
  const isLive = status === "live";

  const registrationsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId, "registrations"],
    queryFn: () => getSessionRegistrations(sessionId!),
    enabled: !!sessionId && allowed && (status === "published" || isLive),
    refetchInterval: isLive ? LIVE_REFRESH_MS : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const roundQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId, "rounds", "current"],
    queryFn: () => getCurrentRound(sessionId!),
    enabled: !!sessionId && allowed && isLive,
    refetchInterval: isLive ? LIVE_REFRESH_MS : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId, "leaderboard"],
    queryFn: () => getSessionLeaderboard(sessionId!),
    enabled: !!sessionId && (isLive || status === "completed"),
    refetchInterval: isLive ? LIVE_REFRESH_MS : false,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", sessionId] });
  };

  const runAction = async (label: string, action: () => Promise<unknown>, onError?: (info: ReturnType<typeof apiErrorInfo>) => boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      const info = apiErrorInfo(error);
      if (!onError?.(info)) {
        toast({ title: `Couldn't ${label}`, description: info.message, variant: "destructive" });
      }
    } finally {
      refreshAll();
      setBusy(false);
    }
  };

  const endSession = (force: boolean) =>
    runAction(
      "end the session",
      async () => {
        await finishSession(session!.id, force);
        setFinishOpen(false);
        setUnscored(null);
        toast({ title: "Session ended", description: "The final leaderboard is saved." });
      },
      (info) => {
        if (info.code === "UNSCORED_MATCHES") {
          setUnscored(Number(info.body?.unscored ?? 0));
          return true;
        }
        return false;
      },
    );

  if (!sessionId || mode === undefined || sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <TennisBallSpinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4" data-testid="organiser-session-live-not-found">
        <p className="text-muted-foreground">Session not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/sessions">Back to Sessions</Link>
        </Button>
      </div>
    );
  }

  // Live not available here for this session, and nothing to close or read.
  if (!allowed && !isLive && status !== "completed") {
    return <LiveUnavailable sessionId={session.id} mode={mode} />;
  }

  const registrations = registrationsQuery.data ?? [];
  const available = registrations.filter(isAvailable).length;
  const checkedInCount = registrationsQuery.data ? registrations.filter((r) => r.status === "registered" && !!r.checkedInAt).length : session.checkedInCount;
  const round = roundQuery.data;
  const roundReadyForNext = !round || round.round.status === "completed";
  const nextRoundBlocker = roundReadyForNext ? roundProblem(session.matchMode, available) : "Every match this round needs a score first";
  const matchesThisRound = round?.matches.length ?? 0;
  const scoresSubmitted = round?.matches.filter((m) => m.status === "confirmed").length ?? 0;
  const completionPercent = matchesThisRound > 0 ? Math.round((scoresSubmitted / matchesThisRound) * 100) : 0;
  const modeLabel = liveModeOf(session.matchMode) === "singles" ? "Singles" : "Doubles";
  const roundsTabSession = { id: session.id, status: session.status, isInternalTest: session.isInternalTest } as unknown as SessionListItem;

  const controls = allowed && isLive; // round / score / player controls
  const generate = () => runAction("generate the next round", () => generateNextRound(session.id));

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-session-live" data-live-allowed={allowed ? "true" : "false"}>
      <SEO title={`Live — ${session.title} | TennisConnect`} description={`Live control centre for ${session.title}.`} noIndex />

      {controls && (
        <aside className="hidden lg:flex lg:w-60 shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto">
          <div className="dark flex flex-col h-full w-full bg-background text-foreground">
            <div className="px-5 pt-6 pb-4">
              <Link href="/" className="text-lg font-display font-bold flex items-center gap-1">
                Tennis<span className="text-[hsl(var(--logo-connect))]"><ConnectWord /></span>
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--logo-connect))] mt-1" />
              </Link>
              <p className="text-[11px] font-semibold tracking-widest text-muted-foreground mt-3">LIVE SESSION</p>
            </div>
            <nav className="px-3 space-y-1 flex-1" aria-label="Live session sections">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    aria-current={activeTab === item.key ? "page" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left",
                      activeTab === item.key ? "bg-primary/10 text-primary-text" : "text-foreground/80 hover:bg-accent/10 hover:text-foreground",
                    )}
                    data-testid={`organiser-live-nav-${item.key}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <Link
              href={`/organiser/sessions/${session.id}`}
              className="mx-3 mb-4 flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
              data-testid="organiser-session-live-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Exit Live Session
            </Link>
          </div>
        </aside>
      )}

      <div className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {!online && (
            <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="organiser-session-live-offline">
              <WifiOff className="w-4 h-4 shrink-0" />
              You're offline. Nothing is saved until the connection is back - the screen updates by itself when it is.
            </div>
          )}

          {(!controls) && (
            <Link
              href={`/organiser/sessions/${session.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-11"
              data-testid="organiser-session-live-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Session Workspace
            </Link>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="font-display text-xl sm:text-2xl font-bold break-words">{session.title}</h1>
                <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="organiser-session-live-badge">
                  {isLive && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                    </span>
                  )}
                  {isLive ? "LIVE" : status === "completed" ? "COMPLETED" : "CHECK-IN"}
                </Badge>
                <Badge variant="outline" data-testid="organiser-session-live-mode">{modeLabel}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {isLive && round ? `Round ${round.round.roundNumber} · ` : ""}
                {checkedInCount} / {session.registeredCount} checked in
                {session.courtsCount ? ` · ${session.courtsCount} court${session.courtsCount === 1 ? "" : "s"}` : ""}
              </p>
            </div>
            {isLive && (
              <Button
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 min-h-11 shrink-0"
                disabled={busy}
                onClick={() => {
                  setUnscored(null);
                  setFinishOpen(true);
                }}
                data-testid="organiser-session-live-finish"
              >
                End Session
              </Button>
            )}
          </div>

          {/* Section tabs on phones and tablets (the rail is desktop-only). */}
          {controls && (
            <nav className="lg:hidden -mx-4 px-4 overflow-x-auto" aria-label="Live session sections">
              <div className="flex gap-2 w-max">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    aria-current={activeTab === item.key ? "page" : undefined}
                    className={cn(
                      "min-h-11 px-4 rounded-full border text-sm font-medium whitespace-nowrap",
                      activeTab === item.key ? "border-primary bg-primary/10 text-primary-text" : "border-border text-muted-foreground",
                    )}
                    data-testid={`organiser-live-tab-${item.key}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>
          )}

          {isLive && !allowed && (
            <Card className="shadow-sm" data-testid="organiser-session-live-switched-off">
              <CardContent className="p-4 text-sm space-y-1">
                <p className="font-medium">Live is switched off on this site.</p>
                <p className="text-muted-foreground">
                  Rounds and scores can't be changed right now. Everything recorded so far is kept, and you can still end the session.
                </p>
              </CardContent>
            </Card>
          )}

          {controls && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="organiser-session-live-stats">
              <StatCard icon={Users} label="Available" value={`${available}/${checkedInCount}`} />
              <StatCard icon={Square} label="Matches this round" value={String(matchesThisRound)} />
              <StatCard icon={Repeat} label="Current round" value={round ? String(round.round.roundNumber) : "—"} />
              <StatCard icon={ClipboardList} label="Scores in" value={`${scoresSubmitted}/${matchesThisRound}`} />
              <StatCard icon={Percent} label="Round done" value={`${completionPercent}%`} />
            </div>
          )}

          {status === "published" && allowed && (
            <CheckInPanel
              registrations={registrations}
              loading={registrationsQuery.isLoading}
              busy={busy}
              goLiveBlocker={goLiveProblem(session, available)}
              waitlisted={session.waitlistedCount}
              onCheckIn={(id) => runAction("check that player in", () => checkInRegistration(session.id, id))}
              onGoLive={() => runAction("go live", () => goLiveSession(session.id))}
            />
          )}

          {controls && activeTab === "overview" && (
            <LiveRoundPanel
              round={round}
              loading={roundQuery.isLoading}
              busy={busy}
              roundReadyForNext={roundReadyForNext}
              nextRoundBlocker={nextRoundBlocker}
              onGenerateRound={generate}
              onStart={(matchId) => runAction("start the match", () => startMatch(session.id, matchId))}
              onScore={(matchId, a, b) => runAction("save the score", () => reportMatchScore(session.id, matchId, a, b))}
            />
          )}

          {controls && activeTab === "players" && (
            <LivePlayersPanel
              registrations={registrations}
              loading={registrationsQuery.isLoading}
              busy={busy}
              onCheckIn={(id) => runAction("check that player in", () => checkInRegistration(session.id, id))}
              onSetStatus={(id, liveStatus) => runAction("update that player", () => setRegistrationLiveStatus(session.id, id, liveStatus))}
            />
          )}

          {(controls && activeTab === "rounds") || status === "completed" || (isLive && !allowed) ? (
            <section className="space-y-3" aria-label="Rounds">
              {status === "completed" && <h2 className="font-display text-lg font-bold">Rounds</h2>}
              <RoundsTab session={roundsTabSession} hideOpenLive />
            </section>
          ) : null}

          {((controls && activeTab === "leaderboard") || status === "completed" || (isLive && !allowed)) && (
            <LeaderboardPanel rows={leaderboardQuery.data ?? []} loading={leaderboardQuery.isLoading} final={status === "completed"} />
          )}

          {controls && activeTab === "messages" && (
            <MessagesTab session={{ id: session.id, timeZone: session.timeZone ?? "Australia/Sydney" }} />
          )}

          {controls && activeTab === "settings" && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {modeLabel} · {session.courtsCount ?? "?"} court{session.courtsCount === 1 ? "" : "s"}. Court count and format are set in Edit Session.
                  Ending the session moves it to Completed and keeps the final leaderboard.
                </p>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 min-h-11"
                  disabled={busy}
                  onClick={() => {
                    setUnscored(null);
                    setFinishOpen(true);
                  }}
                  data-testid="organiser-session-live-finish-settings"
                >
                  End Session
                </Button>
              </CardContent>
            </Card>
          )}

          {status !== "published" && status !== "live" && status !== "completed" && (
            <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground" data-testid="organiser-session-live-not-ready">
              This session isn't ready for live control (status: {status}). Publish it first.
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={finishOpen} onOpenChange={(open) => !busy && setFinishOpen(open)}>
        <AlertDialogContent data-testid="organiser-session-live-finish-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{unscored ? "Some matches have no score" : "End this session?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {unscored
                ? `${unscored} match${unscored === 1 ? " has" : "es have"} no score. If you end now ${unscored === 1 ? "it won't" : "they won't"} count towards the leaderboard. Everything else is kept.`
                : "The session moves to Completed and the leaderboard becomes final. No more rounds or scores can be added."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} data-testid="organiser-session-live-finish-cancel">Keep playing</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault(); // stays open until the server answers
                endSession(!!unscored);
              }}
              data-testid="organiser-session-live-finish-confirm"
            >
              {unscored ? "End anyway" : "End Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <Icon className="w-4 h-4 text-primary-text mb-1" />
        <p className="text-lg font-bold">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function PlayerAvatar({ r }: { r: Pick<RegistrationWithUser, "userAvatar" | "userName"> }) {
  return (
    <Avatar className="w-8 h-8 shrink-0">
      <AvatarImage src={r.userAvatar ?? undefined} />
      <AvatarFallback>{r.userName?.[0] ?? "?"}</AvatarFallback>
    </Avatar>
  );
}

function CheckInPanel({
  registrations,
  loading,
  busy,
  goLiveBlocker,
  waitlisted,
  onCheckIn,
  onGoLive,
}: {
  registrations: RegistrationWithUser[];
  loading: boolean;
  busy: boolean;
  goLiveBlocker: string | null;
  waitlisted: number;
  onCheckIn: (registrationId: string) => void;
  onGoLive: () => void;
}) {
  const registered = registrations.filter((r) => r.status === "registered");
  return (
    <Card className="shadow-sm" data-testid="organiser-session-live-checkin">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Check-In</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Only registered players can be checked in{waitlisted > 0 ? ` (${waitlisted} on the waiting list)` : ""}.
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1">
          <Button disabled={!!goLiveBlocker || busy} onClick={onGoLive} className="min-h-11" data-testid="organiser-session-live-go-live">
            <Play className="w-4 h-4 mr-2" />
            Go Live
          </Button>
          {goLiveBlocker && (
            <p className="text-xs text-muted-foreground" data-testid="organiser-session-live-go-live-blocker">{goLiveBlocker}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading && <TennisBallSpinner />}
        {!loading && registered.length === 0 && <p className="text-muted-foreground text-sm">No registered players yet.</p>}
        {registered.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0" data-testid={`organiser-session-live-checkin-row-${r.id}`}>
            <PlayerAvatar r={r} />
            <span className="text-sm flex-1 min-w-0 truncate">{r.userName}</span>
            {r.checkedInAt ? (
              <span className="flex items-center gap-1 text-sm text-primary-text font-medium" data-testid={`organiser-session-live-checkin-row-${r.id}-done`}>
                <CheckCircle2 className="w-4 h-4" /> Checked in
              </span>
            ) : (
              <Button size="sm" variant="outline" className="min-h-11 px-4" disabled={busy} onClick={() => onCheckIn(r.id)} data-testid={`organiser-session-live-checkin-row-${r.id}-button`}>
                Check In
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Live Players tab: late arrivals, unavailable (sits out, can come back) and withdrawn. */
function LivePlayersPanel({
  registrations,
  loading,
  busy,
  onCheckIn,
  onSetStatus,
}: {
  registrations: RegistrationWithUser[];
  loading: boolean;
  busy: boolean;
  onCheckIn: (registrationId: string) => void;
  onSetStatus: (registrationId: string, liveStatus: "unavailable" | "withdrawn" | null) => void;
}) {
  const registered = registrations.filter((r) => r.status === "registered");
  return (
    <Card className="shadow-sm" data-testid="organiser-session-live-players">
      <CardHeader>
        <CardTitle className="text-base">Players</CardTitle>
        <p className="text-xs text-muted-foreground">
          Changes apply from the next round. A player already on court finishes their match.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading && <TennisBallSpinner />}
        {registered.map((r) => {
          const state = !r.checkedInAt ? "not-arrived" : r.liveStatus ?? "available";
          const id = `organiser-session-live-player-${r.id}`;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-border last:border-0" data-testid={id} data-state={state}>
              <PlayerAvatar r={r} />
              <span className="text-sm flex-1 min-w-[8rem] truncate">{r.userName}</span>
              <Badge variant="outline" className="shrink-0" data-testid={`${id}-state`}>
                {state === "not-arrived" ? "Not checked in" : state === "available" ? "Available" : state === "unavailable" ? "Sitting out" : "Withdrawn"}
              </Badge>
              <div className="flex gap-2 w-full sm:w-auto">
                {state === "not-arrived" && (
                  <Button size="sm" variant="outline" className="min-h-11 flex-1" disabled={busy} onClick={() => onCheckIn(r.id)} data-testid={`${id}-checkin`}>
                    Check In
                  </Button>
                )}
                {state === "available" && (
                  <>
                    <Button size="sm" variant="outline" className="min-h-11 flex-1" disabled={busy} onClick={() => onSetStatus(r.id, "unavailable")} data-testid={`${id}-unavailable`}>
                      Sit out
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11 flex-1 text-destructive" disabled={busy} onClick={() => onSetStatus(r.id, "withdrawn")} data-testid={`${id}-withdraw`}>
                      Withdraw
                    </Button>
                  </>
                )}
                {(state === "unavailable" || state === "withdrawn") && (
                  <Button size="sm" variant="outline" className="min-h-11 flex-1" disabled={busy} onClick={() => onSetStatus(r.id, null)} data-testid={`${id}-return`}>
                    Back in
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LiveRoundPanel({
  round,
  loading,
  busy,
  roundReadyForNext,
  nextRoundBlocker,
  onGenerateRound,
  onStart,
  onScore,
}: {
  round: { round: { id: string; roundNumber: number; status: string; restingPlayerIds?: string[] | null }; matches: MatchWithPlayers[] } | null | undefined;
  loading: boolean;
  busy: boolean;
  roundReadyForNext: boolean;
  nextRoundBlocker: string | null;
  onGenerateRound: () => void;
  onStart: (matchId: string) => void;
  onScore: (matchId: string, teamAGames: number, teamBGames: number) => void;
}) {
  if (loading) return <TennisBallSpinner />;

  const generateButton = (testId: string, label: string) => (
    <div className="flex flex-col items-stretch sm:items-start gap-1">
      <Button disabled={busy || !!nextRoundBlocker} onClick={onGenerateRound} className="min-h-11" data-testid={testId}>
        {label}
      </Button>
      {nextRoundBlocker && roundReadyForNext && (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-blocker`}>{nextRoundBlocker}</p>
      )}
    </div>
  );

  if (!round) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-muted-foreground">No round yet. Round 1 puts available players on courts.</p>
          <div className="flex justify-center">{generateButton("organiser-session-live-generate-round", "Start Round 1")}</div>
        </CardContent>
      </Card>
    );
  }

  const resting = round.round.restingPlayerIds?.length ?? 0;
  return (
    <div className="space-y-3" data-testid="organiser-session-live-courts">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" data-testid="organiser-session-live-round-status">
          Round {round.round.roundNumber} · {round.round.status === "completed" ? "all scores in" : "in progress"}
          {resting > 0 ? ` · ${resting} resting` : ""}
        </p>
        {generateButton("organiser-session-live-generate-round-inline", "Generate Next Round")}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {round.matches.map((match) => (
          <MatchCard key={match.id} match={match} busy={busy} onStart={onStart} onScore={onScore} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  busy,
  onStart,
  onScore,
}: {
  match: MatchWithPlayers;
  busy: boolean;
  onStart: (matchId: string) => void;
  onScore: (matchId: string, teamAGames: number, teamBGames: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [teamAGames, setTeamAGames] = useState("");
  const [teamBGames, setTeamBGames] = useState("");
  const names = (players: MatchWithPlayers["teamA"]) => players.map((p) => p.name).join(" & ");
  const confirmed = match.status === "confirmed";
  const showInputs = (match.status === "pending" || match.status === "playing" || (confirmed && editing));
  const a = teamAGames === "" ? NaN : Number(teamAGames);
  const b = teamBGames === "" ? NaN : Number(teamBGames);
  const filled = teamAGames !== "" && teamBGames !== "";
  const problem = filled ? scoreProblem(a, b) : null;
  const id = `organiser-session-live-match-${match.id}`;

  return (
    <Card className="shadow-sm" data-testid={id} data-status={match.status}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <p className="font-semibold text-sm">{match.courtLabel}</p>
          {confirmed ? (
            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Score in</Badge>
          ) : match.status === "playing" ? (
            <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100"><Hourglass className="w-3.5 h-3.5" /> Playing</Badge>
          ) : match.status === "abandoned" ? (
            <Badge variant="outline" className="text-muted-foreground">Not played</Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">Not started</Badge>
          )}
        </div>

        <p className="text-sm mb-1 break-words">{names(match.teamA)}</p>
        <p className="text-xs text-muted-foreground mb-1">vs</p>
        <p className="text-sm mb-3 break-words">{names(match.teamB)}</p>

        {confirmed && !editing && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-lg font-bold" data-testid={`${id}-score`}>
              <span>{match.teamAGames}</span>
              <span className="text-muted-foreground">–</span>
              <span>{match.teamBGames}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                setTeamAGames(String(match.teamAGames ?? ""));
                setTeamBGames(String(match.teamBGames ?? ""));
                setEditing(true);
              }}
              data-testid={`${id}-correct`}
            >
              Correct score
            </Button>
          </div>
        )}

        {showInputs && (
          <div className="space-y-2">
            {match.status === "pending" && (
              <Button size="sm" variant="secondary" className="w-full min-h-11" disabled={busy} onClick={() => onStart(match.id)} data-testid={`${id}-start`}>
                Mark as started
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_GAMES}
                aria-label={`Games won by ${names(match.teamA)}`}
                className="w-16 h-11 text-center text-base"
                value={teamAGames}
                onChange={(e) => setTeamAGames(e.target.value)}
                data-testid={`${id}-score-a`}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_GAMES}
                aria-label={`Games won by ${names(match.teamB)}`}
                className="w-16 h-11 text-center text-base"
                value={teamBGames}
                onChange={(e) => setTeamBGames(e.target.value)}
                data-testid={`${id}-score-b`}
              />
              <Button
                size="sm"
                className="flex-1 min-h-11"
                disabled={!filled || !!problem || busy}
                onClick={() => {
                  onScore(match.id, a, b);
                  setEditing(false);
                }}
                data-testid={`${id}-save-score`}
              >
                {confirmed ? "Save" : "Enter Score"}
              </Button>
            </div>
            {problem && <p className="text-xs text-destructive" data-testid={`${id}-score-error`}>{problem}</p>}
            {confirmed && editing && (
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setEditing(false)} data-testid={`${id}-correct-cancel`}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaderboardPanel({
  rows,
  loading,
  final,
}: {
  rows: { userId: string; userName: string; userAvatar: string | null; matchesPlayed: number; wins: number; losses: number; draws: number; gamesWon: number; gamesLost: number; restRounds: number }[];
  loading: boolean;
  final: boolean;
}) {
  return (
    <Card className="shadow-sm" data-testid="organiser-session-live-leaderboard">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary-text" /> {final ? "Final leaderboard" : "Leaderboard"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Wins, then draws, then games difference. Only scored matches count.</p>
      </CardHeader>
      <CardContent>
        {loading && <TennisBallSpinner />}
        {!loading && rows.length === 0 && <p className="text-muted-foreground text-sm">No scores yet.</p>}
        {rows.map((row, i) => (
          <div key={row.userId} className="flex items-center gap-3 py-2 border-b border-border last:border-0" data-testid={`organiser-session-live-leaderboard-row-${row.userId}`} data-position={i + 1}>
            <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
            <PlayerAvatar r={row} />
            <span className="text-sm flex-1 min-w-0 truncate">{row.userName}</span>
            <span className="text-xs text-muted-foreground">
              {row.wins}W{row.draws > 0 ? `–${row.draws}D` : ""}–{row.losses}L
            </span>
            <span className="text-xs text-muted-foreground w-14 text-right">{row.gamesWon}–{row.gamesLost}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** TC_LIVE_ENABLED is off here, or "internal" and this isn't an internal test session. */
function LiveUnavailable({ sessionId, mode }: { sessionId: string; mode: LiveMode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background" data-testid="organiser-session-live-unavailable">
      <Card className="max-w-md w-full shadow-sm text-center">
        <CardHeader>
          <CardTitle asChild><h1>Live isn't available for this session</h1></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {mode === "internal"
              ? "Live is only switched on for internal test sessions on this site at the moment."
              : "Live isn't switched on on this site yet."}{" "}
            You can still check players in from the Players tab of the session.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/organiser/sessions/${sessionId}`}>Back to Session Workspace</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Access (signed in, organiser or admin) is checked once, for every Hub
// page, by OrganiserAccessGate (components/organiser/ui/organiser-layout.tsx).
export default function OrganiserSessionLivePage() {
  return (
    <OrganiserAccessGate>
      <OrganiserSessionLivePageContent />
    </OrganiserAccessGate>
  );
}
