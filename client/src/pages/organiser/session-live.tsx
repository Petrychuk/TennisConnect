import { OrganiserAccessGate } from "@/components/organiser/ui/organiser-layout";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  LayoutGrid,
  Users,
  Repeat,
  MessageSquare,
  Coffee,
  WifiOff,
  Flag,
  Shuffle,
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
  markMatchNotPlayed,
  redoCurrentRound,
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
import { goLiveProblem, liveModeOf, MAX_GAMES, redoRoundProblem, roundProblem, scoreProblem } from "@shared/liveRules";
import { cn } from "@/lib/utils";

/*
  TC Live v1 - one screen to run a Social Play singles / doubles session
  (TC-189 phase 3). Mobile first: it is used on court.

    published  check-in list, one action: Go Live
    live       sticky header (name, LIVE, round, End Session), one section
               switcher (Courts / Players / Leaderboard / Rounds / Messages).
               Courts: the round card with the one next action (Start
               Round 1 / Generate Next Round) and progress, then a large
               card per court with its score entry; on a wide screen the
               leaderboard sits beside the courts.
    completed  final leaderboard, then every round (read-only)

  Before this there were a desktop rail AND phone tabs for the same six
  sections, five stat tiles and End Session in two places; the Settings
  section only repeated the format. One switcher, one End Session.

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

type LiveTab = "courts" | "players" | "leaderboard" | "rounds" | "messages";

const SECTIONS: { key: LiveTab; label: string; icon: typeof LayoutGrid }[] = [
  { key: "courts", label: "Courts", icon: LayoutGrid },
  { key: "players", label: "Players", icon: Users },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "rounds", label: "Rounds", icon: Repeat },
  { key: "messages", label: "Messages", icon: MessageSquare },
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
  const [activeTab, setActiveTab] = useState<LiveTab>("courts");
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
  const nextRoundBlocker = roundReadyForNext ? roundProblem(session.matchMode, available) : "Every court needs a score (or Not played) first";
  const modeLabel = liveModeOf(session.matchMode) === "singles" ? "Singles" : "Doubles";
  const nameOf = new Map(registrations.map((r) => [r.userId, r.userName ?? "Player"]));
  // Phase 4: who left during the round (still on a court card), and who
  // arrived or came back after the draw (plays from the next round, or now
  // if the round is redone).
  const awayIds = new Set(registrations.filter((r) => r.status === "registered" && !!r.liveStatus).map((r) => r.userId));
  const inRound = new Set(round ? [...round.matches.flatMap((m) => [...(m.teamAIds ?? []), ...(m.teamBIds ?? [])]), ...(round.round.restingPlayerIds ?? [])] : []);
  const joiners = round ? registrations.filter((r) => isAvailable(r) && !inRound.has(r.userId)).map((r) => r.userName ?? "Player") : [];
  const canRedo = !!round && !redoRoundProblem(round.round, round.matches) && !roundProblem(session.matchMode, available);
  const roundsTabSession = { id: session.id, status: session.status, isInternalTest: session.isInternalTest } as unknown as SessionListItem;

  const controls = allowed && isLive; // round / score / player controls
  const generate = () => runAction("generate the next round", () => generateNextRound(session.id));

  const openFinish = () => {
    setUnscored(null);
    setFinishOpen(true);
  };
  const badge = isLive ? "LIVE" : status === "completed" ? "COMPLETED" : "CHECK-IN";
  const meta = [
    modeLabel,
    isLive && round ? `Round ${round.round.roundNumber}` : null,
    `${checkedInCount}/${session.registeredCount} checked in`,
    session.courtsCount ? `${session.courtsCount} court${session.courtsCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-muted/30" data-testid="organiser-session-live" data-live-allowed={allowed ? "true" : "false"}>
      <SEO title={`Live — ${session.title} | TennisConnect`} description={`Live control centre for ${session.title}.`} noIndex />

      {/* ---------- Sticky header: who / state / the one destructive action ---------- */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto max-w-6xl px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 py-2.5">
            <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Back to Session Workspace">
              <Link href={`/organiser/sessions/${session.id}`} data-testid="organiser-session-live-back">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-display text-base sm:text-xl font-bold truncate">{session.title}</h1>
                {/* High-contrast state: dark pill, red pulse while live. */}
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide",
                    isLive ? "bg-foreground text-background" : status === "completed" ? "bg-muted text-foreground" : "bg-primary text-foreground",
                  )}
                  data-testid="organiser-session-live-badge"
                >
                  {isLive && (
                    <span className="relative flex h-2 w-2" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                  )}
                  {badge}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate" data-testid="organiser-session-live-meta">
                <span data-testid="organiser-session-live-mode">{meta[0]}</span>
                {meta.slice(1).map((m) => ` · ${m}`).join("")}
              </p>
            </div>
            {isLive && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 min-h-11 text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={busy}
                onClick={openFinish}
                data-testid="organiser-session-live-finish"
              >
                <Flag className="w-4 h-4 sm:mr-1.5" aria-hidden />
                <span className="sr-only sm:not-sr-only">End Session</span>
              </Button>
            )}
          </div>

          {/* One section switcher for every screen size. */}
          {controls && (
            <nav className="-mx-3 sm:mx-0 overflow-x-auto pb-2" aria-label="Live session sections">
              <div className="flex w-max gap-1 px-3 sm:px-0">
                {SECTIONS.map((item) => {
                  const Icon = item.icon;
                  const selected = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      aria-current={selected ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      data-testid={`organiser-live-tab-${item.key}`}
                    >
                      <Icon className="w-4 h-4" aria-hidden />
                      {item.label}
                      {item.key === "players" && (
                        <span className={cn("rounded-full px-1.5 text-xs", selected ? "bg-background/20" : "bg-muted")}>{available}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-6 py-4 space-y-4">
        {!online && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="organiser-session-live-offline">
            <WifiOff className="w-4 h-4 shrink-0" />
            You're offline. Nothing is saved until the connection is back - the screen updates by itself when it is.
          </div>
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

        {status === "completed" && (
          // After End Session everything here is read-only; the Workspace keeps the full results.
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4" data-testid="organiser-session-live-completed">
            <CheckCircle2 className="w-6 h-6 text-primary-text shrink-0" aria-hidden />
            <div className="flex-1 min-w-[12rem]">
              <p className="font-semibold">Session complete</p>
              <p className="text-sm text-muted-foreground">The results are final. Send them to players or export them from Results.</p>
            </div>
            <Button asChild className="min-h-11 w-full sm:w-auto">
              <Link href={`/organiser/sessions/${session.id}?tab=results`} data-testid="organiser-session-live-open-results">
                <Trophy className="w-4 h-4 mr-2" /> Open Results
              </Link>
            </Button>
          </section>
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

        {controls && activeTab === "courts" && (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <LiveRoundPanel
              round={round}
              loading={roundQuery.isLoading}
              busy={busy}
              roundReadyForNext={roundReadyForNext}
              nextRoundBlocker={nextRoundBlocker}
              nameOf={nameOf}
              onGenerateRound={generate}
              joiners={joiners}
              awayIds={awayIds}
              canRedo={canRedo}
              onRedo={() => runAction("redo the round", () => redoCurrentRound(session.id))}
              onNotPlayed={(matchId) => runAction("mark the match as not played", () => markMatchNotPlayed(session.id, matchId))}
              onStart={(matchId) => runAction("start the match", () => startMatch(session.id, matchId))}
              onScore={(matchId, a, b) => runAction("save the score", () => reportMatchScore(session.id, matchId, a, b))}
            />
            {/* Wide screens: the standings beside the courts, updating as scores come in. */}
            <aside className="hidden lg:block lg:sticky lg:top-32">
              <LeaderboardPanel rows={leaderboardQuery.data ?? []} loading={leaderboardQuery.isLoading} final={false} compact />
            </aside>
          </div>
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

        {((controls && activeTab === "leaderboard") || status === "completed" || (isLive && !allowed)) && (
          <LeaderboardPanel rows={leaderboardQuery.data ?? []} loading={leaderboardQuery.isLoading} final={status === "completed"} />
        )}

        {(controls && activeTab === "rounds") || status === "completed" || (isLive && !allowed) ? (
          <section className="space-y-3" aria-label="Rounds">
            {status === "completed" && <h2 className="font-display text-lg font-bold">Rounds</h2>}
            <RoundsTab session={roundsTabSession} hideOpenLive />
          </section>
        ) : null}

        {controls && activeTab === "messages" && (
          <MessagesTab session={{ id: session.id, timeZone: session.timeZone ?? "Australia/Sydney" }} />
        )}

        {status !== "published" && status !== "live" && status !== "completed" && (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground" data-testid="organiser-session-live-not-ready">
            This session isn't ready for live control (status: {status}). Publish it first.
          </div>
        )}
      </main>

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

function PlayerAvatar({ r, className }: { r: Pick<RegistrationWithUser, "userAvatar" | "userName">; className?: string }) {
  return (
    <Avatar className={cn("w-9 h-9 shrink-0", className)}>
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
  const done = registered.filter((r) => !!r.checkedInAt).length;
  return (
    <section className="space-y-3" data-testid="organiser-session-live-checkin">
      {/* The one action before Live: Go Live, with what still blocks it. */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Check-in</h2>
            <p className="text-sm text-muted-foreground">
              {done} of {registered.length} checked in{waitlisted > 0 ? ` · ${waitlisted} on the waiting list` : ""}
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums">{registered.length ? Math.round((done / registered.length) * 100) : 0}%</p>
        </div>
        <Progress value={registered.length ? (done / registered.length) * 100 : 0} className="h-2" aria-label="Checked in" />
        <Button size="lg" disabled={!!goLiveBlocker || busy} onClick={onGoLive} className="w-full min-h-12 text-base" data-testid="organiser-session-live-go-live">
          <Play className="w-5 h-5 mr-2" />
          Go Live
        </Button>
        {goLiveBlocker && (
          <p className="text-sm text-muted-foreground text-center" data-testid="organiser-session-live-go-live-blocker">{goLiveBlocker}</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <p className="px-4 pt-3 text-xs text-muted-foreground">Only registered players can be checked in.</p>
        {loading && <div className="p-4"><TennisBallSpinner /></div>}
        {!loading && registered.length === 0 && <p className="p-4 text-muted-foreground text-sm">No registered players yet.</p>}
        <ul className="divide-y divide-border">
          {registered.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2" data-testid={`organiser-session-live-checkin-row-${r.id}`}>
              <PlayerAvatar r={r} />
              <span className="text-sm font-medium flex-1 min-w-0 truncate">{r.userName}</span>
              {r.checkedInAt ? (
                <span className="flex min-h-11 items-center gap-1 text-sm text-primary-text font-medium" data-testid={`organiser-session-live-checkin-row-${r.id}-done`}>
                  <CheckCircle2 className="w-4 h-4" /> Checked in
                </span>
              ) : (
                <Button size="sm" variant="outline" className="min-h-11 px-5" disabled={busy} onClick={() => onCheckIn(r.id)} data-testid={`organiser-session-live-checkin-row-${r.id}-button`}>
                  Check In
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Live Players: late arrivals, unavailable (sits out, can come back) and withdrawn. */
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
  const STATE_LABEL: Record<string, string> = { "not-arrived": "Not checked in", available: "Available", unavailable: "Sitting out", withdrawn: "Withdrawn" };
  const STATE_STYLE: Record<string, string> = {
    "not-arrived": "bg-muted text-muted-foreground",
    available: "bg-primary/15 text-primary-text",
    unavailable: "bg-amber-100 text-amber-800",
    withdrawn: "bg-destructive/10 text-destructive",
  };
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" data-testid="organiser-session-live-players">
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display text-lg font-bold">Players</h2>
        <p className="text-sm text-muted-foreground">Changes apply from the next round. A player already on court finishes their match.</p>
      </div>
      {loading && <div className="p-4"><TennisBallSpinner /></div>}
      <ul className="divide-y divide-border">
        {registered.map((r) => {
          const state = !r.checkedInAt ? "not-arrived" : r.liveStatus ?? "available";
          const id = `organiser-session-live-player-${r.id}`;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5" data-testid={id} data-state={state}>
              <PlayerAvatar r={r} />
              <span className="text-sm font-medium flex-1 min-w-[8rem] truncate">{r.userName}</span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STATE_STYLE[state])} data-testid={`${id}-state`}>
                {STATE_LABEL[state]}
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                {state === "not-arrived" && (
                  <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:flex-none" disabled={busy} onClick={() => onCheckIn(r.id)} data-testid={`${id}-checkin`}>
                    Check In
                  </Button>
                )}
                {state === "available" && (
                  <>
                    <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:flex-none" disabled={busy} onClick={() => onSetStatus(r.id, "unavailable")} data-testid={`${id}-unavailable`}>
                      Sit out
                    </Button>
                    <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:flex-none text-destructive" disabled={busy} onClick={() => onSetStatus(r.id, "withdrawn")} data-testid={`${id}-withdraw`}>
                      Withdraw
                    </Button>
                  </>
                )}
                {(state === "unavailable" || state === "withdrawn") && (
                  <Button size="sm" variant="outline" className="min-h-11 flex-1 sm:flex-none" disabled={busy} onClick={() => onSetStatus(r.id, null)} data-testid={`${id}-return`}>
                    Back in
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LiveRoundPanel({
  round,
  loading,
  busy,
  roundReadyForNext,
  nextRoundBlocker,
  nameOf,
  onGenerateRound,
  joiners,
  awayIds,
  canRedo,
  onRedo,
  onNotPlayed,
  onStart,
  onScore,
}: {
  round: { round: { id: string; roundNumber: number; status: string; restingPlayerIds?: string[] | null }; matches: MatchWithPlayers[] } | null | undefined;
  loading: boolean;
  busy: boolean;
  roundReadyForNext: boolean;
  nextRoundBlocker: string | null;
  nameOf: Map<string, string>;
  onGenerateRound: () => void;
  /** Available players not in this round: arrived or came back after the draw. */
  joiners: string[];
  /** Players marked Sit out / Withdrawn - flagged on the court they're still on. */
  awayIds: Set<string>;
  /** Nothing in the round has started, and enough players to draw again. */
  canRedo: boolean;
  onRedo: () => void;
  onNotPlayed: (matchId: string) => void;
  onStart: (matchId: string) => void;
  onScore: (matchId: string, teamAGames: number, teamBGames: number) => void;
}) {
  if (loading) return <div className="py-10 flex justify-center"><TennisBallSpinner /></div>;

  if (!round) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center space-y-3">
        <LayoutGrid className="mx-auto w-8 h-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold">No round yet</p>
          <p className="text-sm text-muted-foreground">Round 1 puts the available players on courts.</p>
        </div>
        <Button size="lg" disabled={busy || !!nextRoundBlocker} onClick={onGenerateRound} className="min-h-12 px-8 text-base" data-testid="organiser-session-live-generate-round">
          <Play className="w-5 h-5 mr-2" /> Start Round 1
        </Button>
        {nextRoundBlocker && <p className="text-sm text-muted-foreground" data-testid="organiser-session-live-generate-round-blocker">{nextRoundBlocker}</p>}
      </section>
    );
  }

  const total = round.matches.length;
  const scored = round.matches.filter((m) => m.status === "confirmed" || m.status === "abandoned").length;
  const resting = round.round.restingPlayerIds ?? [];
  const allIn = round.round.status === "completed";
  return (
    <div className="space-y-3 min-w-0" data-testid="organiser-session-live-courts">
      {/* Round card: where the round is, and the one next action. */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-2xl font-bold leading-none">Round {round.round.roundNumber}</p>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="organiser-session-live-round-status">
              Round {round.round.roundNumber} · {allIn ? "all scores in" : "in progress"}
              {resting.length > 0 ? ` · ${resting.length} resting` : ""}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-1 w-full sm:w-auto">
            <Button
              size="lg"
              variant={allIn ? "default" : "outline"}
              disabled={busy || !!nextRoundBlocker}
              onClick={onGenerateRound}
              className="min-h-12"
              data-testid="organiser-session-live-generate-round-inline"
            >
              <Repeat className="w-4 h-4 mr-2" /> Generate Next Round
            </Button>
            {nextRoundBlocker && roundReadyForNext && (
              <p className="text-xs text-muted-foreground" data-testid="organiser-session-live-generate-round-inline-blocker">{nextRoundBlocker}</p>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Scores in</span>
            <span className="tabular-nums" data-testid="organiser-session-live-scores-in">{scored}/{total}</span>
          </div>
          <Progress value={total ? (scored / total) * 100 : 0} className="h-2" aria-label="Scores entered this round" />
        </div>
        {resting.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground" data-testid="organiser-session-live-resting">
            <Coffee className="w-4 h-4" aria-hidden /> Resting:
            <span className="text-foreground">{resting.map((id) => nameOf.get(id) ?? "Player").join(", ")}</span>
          </p>
        )}
        {joiners.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-muted/60 px-3 py-2 text-sm" data-testid="organiser-session-live-joiners">
            <p className="flex-1 min-w-[12rem]">
              <span className="font-medium">Joins next round:</span> {joiners.join(", ")}
            </p>
            {canRedo && (
              <Button size="sm" variant="outline" className="min-h-11" disabled={busy} onClick={onRedo} data-testid="organiser-session-live-redo-round">
                <Shuffle className="w-4 h-4 mr-1.5" /> Redo round with them
              </Button>
            )}
          </div>
        )}
        {joiners.length === 0 && canRedo && (
          // Someone left right after the draw: draw again before anyone starts.
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" className="min-h-11 text-muted-foreground" disabled={busy} onClick={onRedo} data-testid="organiser-session-live-redo-round">
              <Shuffle className="w-4 h-4 mr-1.5" /> Redo round
            </Button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {round.matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            busy={busy}
            awayNames={[...match.teamA, ...match.teamB].filter((p) => awayIds.has(p.id)).map((p) => p.name)}
            onStart={onStart}
            onNotPlayed={onNotPlayed}
            onScore={onScore}
          />
        ))}
      </div>
    </div>
  );
}

/** One court: the two sides as scoreboard rows, the score entered right beside them. */
function MatchCard({
  match,
  busy,
  awayNames,
  onStart,
  onNotPlayed,
  onScore,
}: {
  match: MatchWithPlayers;
  busy: boolean;
  /** Players on this court marked Sit out / Withdrawn after the draw. */
  awayNames: string[];
  onStart: (matchId: string) => void;
  onNotPlayed: (matchId: string) => void;
  onScore: (matchId: string, teamAGames: number, teamBGames: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [teamAGames, setTeamAGames] = useState("");
  const [teamBGames, setTeamBGames] = useState("");
  const names = (players: MatchWithPlayers["teamA"]) => players.map((p) => p.name).join(" & ");
  const confirmed = match.status === "confirmed";
  const notPlayed = match.status === "abandoned";
  const open = match.status === "pending" || match.status === "playing";
  const showInputs = open || ((confirmed || notPlayed) && editing);
  const a = teamAGames === "" ? NaN : Number(teamAGames);
  const b = teamBGames === "" ? NaN : Number(teamBGames);
  const filled = teamAGames !== "" && teamBGames !== "";
  const problem = filled ? scoreProblem(a, b) : null;
  const id = `organiser-session-live-match-${match.id}`;
  const winner = confirmed && !editing && match.teamAGames != null && match.teamBGames != null
    ? match.teamAGames > match.teamBGames ? "a" : match.teamBGames > match.teamAGames ? "b" : null
    : null;

  const side = (key: "a" | "b") => {
    const team = key === "a" ? match.teamA : match.teamB;
    const value = key === "a" ? teamAGames : teamBGames;
    const setValue = key === "a" ? setTeamAGames : setTeamBGames;
    const final = key === "a" ? match.teamAGames : match.teamBGames;
    return (
      <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", winner === key ? "bg-primary/15" : "bg-muted/50")}>
        <p className={cn("flex-1 min-w-0 text-sm sm:text-base break-words", winner === key ? "font-bold" : "font-medium")}>{names(team)}</p>
        {showInputs ? (
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_GAMES}
            aria-label={`Games won by ${names(team)}`}
            className="w-16 h-12 shrink-0 text-center text-xl font-bold tabular-nums"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid={`${id}-score-${key}`}
          />
        ) : confirmed ? (
          <span className="w-12 shrink-0 text-center text-2xl font-bold tabular-nums">{final}</span>
        ) : null}
      </div>
    );
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm space-y-2" data-testid={id} data-status={match.status}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-lg font-bold">{match.courtLabel}</p>
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

      {side("a")}
      {side("b")}
      {confirmed && !editing && (
        // Kept for tests and screen readers: the score as text.
        <p className="sr-only" data-testid={`${id}-score`}>{match.teamAGames} – {match.teamBGames}</p>
      )}

      {open && awayNames.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900" data-testid={`${id}-player-away`}>
          {awayNames.join(" & ")} {awayNames.length === 1 ? "is" : "are"} out now. Enter the score so far, or mark the match Not played.
        </p>
      )}
      {notPlayed && !editing && (
        <p className="text-xs text-muted-foreground" data-testid={`${id}-not-played-note`}>Not played - doesn't count on the leaderboard.</p>
      )}

      {problem && <p className="text-xs text-destructive" data-testid={`${id}-score-error`}>{problem}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {match.status === "pending" && (
          <Button size="sm" variant="outline" className="min-h-11 flex-1" disabled={busy} onClick={() => onStart(match.id)} data-testid={`${id}-start`}>
            Mark as started
          </Button>
        )}
        {showInputs && (
          <Button
            size="sm"
            className="min-h-11 flex-1"
            disabled={!filled || !!problem || busy}
            onClick={() => {
              onScore(match.id, a, b);
              setEditing(false);
            }}
            data-testid={`${id}-save-score`}
          >
            {confirmed || notPlayed ? "Save" : "Enter Score"}
          </Button>
        )}
        {open && (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11 text-muted-foreground"
            disabled={busy}
            onClick={() => onNotPlayed(match.id)}
            data-testid={`${id}-not-played`}
          >
            Not played
          </Button>
        )}
        {notPlayed && !editing && (
          <Button size="sm" variant="ghost" className="min-h-11 ml-auto" disabled={busy} onClick={() => setEditing(true)} data-testid={`${id}-enter-score`}>
            Enter score
          </Button>
        )}
        {(confirmed || notPlayed) && editing && (
          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setEditing(false)} data-testid={`${id}-correct-cancel`}>
            Cancel
          </Button>
        )}
        {confirmed && !editing && (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11 ml-auto"
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
        )}
      </div>
    </article>
  );
}

function LeaderboardPanel({
  rows,
  loading,
  final,
  compact = false,
}: {
  rows: { userId: string; userName: string; userAvatar: string | null; matchesPlayed: number; wins: number; losses: number; draws: number; gamesWon: number; gamesLost: number; restRounds: number }[];
  loading: boolean;
  final: boolean;
  /** Beside the courts on wide screens: top 8, no row ids (the Leaderboard section has the full list). */
  compact?: boolean;
}) {
  const shown = compact ? rows.slice(0, 8) : rows;
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm" data-testid={compact ? "organiser-session-live-leaderboard-mini" : "organiser-session-live-leaderboard"}>
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary-text" aria-hidden /> {final ? "Final leaderboard" : "Leaderboard"}
        </h2>
        {!compact && <p className="text-xs text-muted-foreground">Wins, then draws, then games difference. Only scored matches count.</p>}
      </div>
      {loading && <div className="p-4"><TennisBallSpinner /></div>}
      {!loading && rows.length === 0 && <p className="px-4 pb-4 text-muted-foreground text-sm">No scores yet.</p>}
      <ol className="divide-y divide-border">
        {shown.map((row, i) => (
          <li
            key={row.userId}
            className={cn("flex items-center gap-3 px-4 py-2", i < 3 && rows.length > 0 && "bg-primary/5")}
            data-testid={compact ? undefined : `organiser-session-live-leaderboard-row-${row.userId}`}
            data-position={i + 1}
          >
            <span className={cn("w-6 text-center text-sm font-bold tabular-nums", i === 0 ? "text-primary-text" : "text-muted-foreground")}>{i + 1}</span>
            <PlayerAvatar r={row} className="w-8 h-8" />
            <span className="text-sm font-medium flex-1 min-w-0 truncate">{row.userName}</span>
            <span className="text-sm font-semibold tabular-nums">
              {row.wins}W{row.draws > 0 ? `–${row.draws}D` : ""}–{row.losses}L
            </span>
            {!compact && (
              <span className="hidden sm:inline text-xs text-muted-foreground w-14 text-right tabular-nums">{row.gamesWon}–{row.gamesLost}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
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
