import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Hourglass,
  Trophy,
  LayoutDashboard,
  Users,
  Grid3x3,
  Repeat,
  ClipboardList,
  MessageSquare,
  Settings,
  Share2,
  Square,
  Percent,
} from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import {
  getSessionById,
  getSessionRegistrations,
  checkInRegistration,
  goLiveSession,
  generateNextRound,
  getCurrentRound,
  startMatch,
  reportMatchScore,
  finishSession,
  getSessionLeaderboard,
} from "@/lib/api/organizer-sessions";
import { MessagesTab } from "@/components/organiser/sessions/workspace/messages-tab";
import type { MatchWithPlayers, RegistrationWithUser } from "@shared/schema";
import { cn } from "@/lib/utils";

type LiveTab = "overview" | "players" | "courts" | "rounds" | "leaderboard" | "messages" | "settings";

const NAV_ITEMS: { key: LiveTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "players", label: "Players", icon: Users },
  { key: "courts", label: "Courts", icon: Grid3x3 },
  { key: "rounds", label: "Rounds", icon: Repeat },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "settings", label: "Settings", icon: Settings },
];

// TC Live Engine v0.1 control centre. Three states share this one screen,
// matching the diagram's Registration -> Check-in -> Live -> Results flow:
//   "published"  -> check-in list + Go Live
//   "live"       -> courts/rounds + organizer-only score entry
//   "completed"  -> final leaderboard
// Everything here calls the real API (server/routes/organizer.ts TC Live
// block) - no more mock court data.
//
// Layout redesigned to match the reference mockup: a dark left rail with
// section nav (Overview/Players/Courts/Rounds/Leaderboard/Messages/
// Settings) - same dark-sidebar-plus-light-content pattern already used
// for the rest of the Organiser Hub - rather than the single dark column
// this page used before.
export default function OrganiserSessionLivePage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id/live");
  const sessionId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LiveTab>("overview");

  // TC Live is staging-only for now (see server/routes/organizer.ts
  // requireStagingEnv) - production shows the stub below instead of
  // hitting APIs that would just 404 there. env.DB_ENV, not NODE_ENV,
  // is what actually distinguishes staging from production (both run
  // NODE_ENV=production) - see server/env.ts.
  const healthQuery = useQuery({
    queryKey: ["/api/health"],
    queryFn: async () => (await fetch("/api/health")).json() as Promise<{ dbEnv: string }>,
    staleTime: Infinity,
  });
  const isStaging = healthQuery.data?.dbEnv === "staging";

  const sessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId],
    queryFn: () => getSessionById(sessionId!),
    enabled: !!sessionId && isStaging,
  });

  const session = sessionQuery.data;
  const status = session?.status;

  const registrationsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId, "registrations"],
    queryFn: () => getSessionRegistrations(sessionId!),
    enabled: !!sessionId && (status === "published" || status === "live"),
  });

  const roundQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId, "rounds", "current"],
    queryFn: () => getCurrentRound(sessionId!),
    enabled: !!sessionId && status === "live",
  });

  const leaderboardQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionId, "leaderboard"],
    queryFn: () => getSessionLeaderboard(sessionId!),
    enabled: !!sessionId && (status === "live" || status === "completed"),
  });

  const [busy, setBusy] = useState(false);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", sessionId, "registrations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", sessionId, "rounds", "current"] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", sessionId, "leaderboard"] });
  };

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      refreshAll();
    } catch (error: any) {
      toast({ title: `Couldn't ${label}`, description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleShareLiveBoard = async () => {
    // No separate public spectator page exists yet - copies this same
    // organiser URL as an honest placeholder rather than faking a
    // dedicated share link that doesn't actually exist. A real public
    // live-board view (no organiser controls, just scores/leaderboard)
    // is a genuinely separate feature to scope, not something to invent
    // silently here.
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: "Note: this is the organiser view - a public spectator board isn't built yet." });
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
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
          <CardHeader>
            <CardTitle asChild><h1>Organiser access required</h1></CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            You need to be an approved organiser to view this page. Head to your profile to
            request organiser access.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (healthQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground">
        <TennisBallSpinner />
      </div>
    );
  }

  if (!isStaging) {
    return <TcLiveComingSoonStub sessionId={sessionId} />;
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground">
        <TennisBallSpinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Session not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/sessions">Back to Sessions</Link>
        </Button>
      </div>
    );
  }

  const round = roundQuery.data;
  const checkedInCount = registrationsQuery.data?.filter((r) => !!r.checkedInAt).length ?? session.checkedInCount;
  const canGoLive = checkedInCount >= 2 && !!session.courtsCount;
  const roundReadyForNext = !round || round.round.status === "completed";

  const activeCourts = round?.matches.length ?? session.courtsCount ?? 0;
  const scoresSubmitted = round?.matches.filter((m) => m.status === "confirmed").length ?? 0;
  const completionPercent = activeCourts > 0 ? Math.round((scoresSubmitted / activeCourts) * 100) : 0;

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-session-live">
      <SEO
        title={`Live — ${session.title} | TennisConnect`}
        description={`Live control centre for ${session.title}.`}
        noIndex
      />

      {status === "live" && (
        <aside className="hidden lg:flex lg:w-60 shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto">
          <div className="dark flex flex-col h-full w-full bg-background text-foreground">
            <div className="px-5 pt-6 pb-4">
              <Link href="/" className="text-lg font-display font-bold flex items-center gap-1">
                Tennis<span className="text-primary">Connect</span>
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
              </Link>
              <p className="text-[11px] font-semibold tracking-widest text-muted-foreground mt-3">LIVE SESSION</p>
            </div>
            <nav className="px-3 space-y-1 flex-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left",
                      isActive ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent/10 hover:text-foreground"
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
          {status !== "live" && (
            <Link
              href={`/organiser/sessions/${session.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="organiser-session-live-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Session Workspace
            </Link>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-display text-xl sm:text-2xl font-bold">{session.title}</h1>
                <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="organiser-session-live-badge">
                  {status === "live" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                    </span>
                  )}
                  {status === "live" ? "LIVE" : status === "completed" ? "COMPLETED" : "CHECK-IN"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {status === "live" && round ? `Round ${round.round.roundNumber}${session.plannedRoundsCount ? ` of ${session.plannedRoundsCount}` : ""} · ` : ""}
                {checkedInCount} / {session.registeredCount} players
                {session.courtsCount ? ` · ${session.courtsCount} courts` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={handleShareLiveBoard} data-testid="organiser-session-live-share">
                <Share2 className="w-4 h-4 mr-2" />
                Share Live Board
              </Button>
              {status === "live" && (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => runAction("finish the session", () => finishSession(session.id))}
                  data-testid="organiser-session-live-finish"
                >
                  End Session
                </Button>
              )}
            </div>
          </div>

          {status === "live" && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="organiser-session-live-stats">
              <StatCard icon={Users} label="Players Checked In" value={`${checkedInCount}/${session.registeredCount}`} />
              <StatCard icon={Square} label="Active Courts" value={String(activeCourts)} />
              <StatCard
                icon={Repeat}
                label="Current Round"
                value={round ? `${round.round.roundNumber}${session.plannedRoundsCount ? `/${session.plannedRoundsCount}` : ""}` : "—"}
              />
              <StatCard icon={ClipboardList} label="Scores Submitted" value={String(scoresSubmitted)} />
              <StatCard icon={Percent} label="Completion" value={`${completionPercent}%`} />
            </div>
          )}

          {status !== "live" && (
            <div className="grid grid-cols-3 gap-3 max-w-md" data-testid="organiser-session-live-stats">
              <div>
                <p className="text-2xl font-bold" data-testid="organiser-session-live-registered">{session.registeredCount}</p>
                <p className="text-xs text-muted-foreground">Registered</p>
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="organiser-session-live-checkedin">{checkedInCount}</p>
                <p className="text-xs text-muted-foreground">Checked In</p>
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="organiser-session-live-waiting">{session.waitlistedCount}</p>
                <p className="text-xs text-muted-foreground">Waiting List</p>
              </div>
            </div>
          )}

          {status === "published" && (
            <CheckInPanel
              registrations={registrationsQuery.data ?? []}
              loading={registrationsQuery.isLoading}
              busy={busy}
              canGoLive={canGoLive}
              missingCourts={!session.courtsCount}
              onCheckIn={(registrationId) =>
                runAction("check that player in", () => checkInRegistration(session.id, registrationId))
              }
              onGoLive={() => runAction("go live", () => goLiveSession(session.id))}
            />
          )}

          {status === "live" && activeTab === "overview" && (
            <LiveRoundPanel
              round={round}
              loading={roundQuery.isLoading}
              busy={busy}
              roundReadyForNext={roundReadyForNext}
              onGenerateRound={() => runAction("generate the next round", () => generateNextRound(session.id))}
              onStart={(matchId) => runAction("start the match", () => startMatch(session.id, matchId))}
              onScore={(matchId, a, b) => runAction("save the score", () => reportMatchScore(session.id, matchId, a, b))}
            />
          )}

          {status === "live" && activeTab === "courts" && (
            <LiveRoundPanel
              round={round}
              loading={roundQuery.isLoading}
              busy={busy}
              roundReadyForNext={roundReadyForNext}
              onGenerateRound={() => runAction("generate the next round", () => generateNextRound(session.id))}
              onStart={(matchId) => runAction("start the match", () => startMatch(session.id, matchId))}
              onScore={(matchId, a, b) => runAction("save the score", () => reportMatchScore(session.id, matchId, a, b))}
            />
          )}

          {status === "live" && activeTab === "rounds" && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Rounds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {round ? (
                  <p className="text-sm text-muted-foreground">
                    Round {round.round.roundNumber}{session.plannedRoundsCount ? ` of ${session.plannedRoundsCount}` : ""} ·{" "}
                    {round.round.status === "completed" ? "all matches confirmed" : "in progress"}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No round started yet.</p>
                )}
                <Button
                  disabled={busy || !roundReadyForNext}
                  onClick={() => runAction("generate the next round", () => generateNextRound(session.id))}
                  data-testid="organiser-session-live-generate-round"
                  title={roundReadyForNext ? undefined : "Every match this round needs a confirmed score first"}
                >
                  {round ? "Generate Next Round" : "Start Round 1"}
                </Button>
                {/* Only the current round's matches are available from the
                    API today (GET /sessions/:id/rounds/current) - a full
                    round-by-round history view would need a new endpoint,
                    a separate feature to scope rather than fake here. */}
              </CardContent>
            </Card>
          )}

          {status === "live" && activeTab === "players" && (
            <CheckInPanel
              registrations={registrationsQuery.data ?? []}
              loading={registrationsQuery.isLoading}
              busy={busy}
              canGoLive={false}
              hideGoLive
              missingCourts={false}
              onCheckIn={(registrationId) =>
                runAction("check that player in", () => checkInRegistration(session.id, registrationId))
              }
              onGoLive={() => {}}
            />
          )}

          {(activeTab === "leaderboard" || status === "completed") && (status === "live" || status === "completed") && (
            <LeaderboardPanel rows={leaderboardQuery.data ?? []} loading={leaderboardQuery.isLoading} />
          )}

          {status === "live" && activeTab === "messages" && (
            <MessagesTab session={{ id: session.id, timeZone: session.timeZone ?? "Australia/Sydney" }} />
          )}

          {status === "live" && activeTab === "settings" && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ending the session moves it to Completed and locks in the final leaderboard.
                </p>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => runAction("finish the session", () => finishSession(session.id))}
                  data-testid="organiser-session-live-finish-settings"
                >
                  End Session
                </Button>
              </CardContent>
            </Card>
          )}

          {status !== "published" && status !== "live" && status !== "completed" && (
            <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
              This session isn't ready for live control yet (status: {status}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckInPanel({
  registrations,
  loading,
  busy,
  canGoLive,
  missingCourts,
  hideGoLive = false,
  onCheckIn,
  onGoLive,
}: {
  registrations: RegistrationWithUser[];
  loading: boolean;
  busy: boolean;
  canGoLive: boolean;
  missingCourts: boolean;
  hideGoLive?: boolean;
  onCheckIn: (registrationId: string) => void;
  onGoLive: () => void;
}) {
  const registered = registrations.filter((r) => r.status === "registered");

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Check-In</CardTitle>
        {!hideGoLive && (
          <Button
            disabled={!canGoLive || busy}
            onClick={onGoLive}
            data-testid="organiser-session-live-go-live"
            title={
              missingCourts
                ? "Set a court count for this session first"
                : !canGoLive
                ? "Need at least 2 checked-in players"
                : undefined
            }
          >
            <Play className="w-4 h-4 mr-2" />
            Go Live
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <TennisBallSpinner />}
        {!loading && registered.length === 0 && (
          <p className="text-muted-foreground text-sm">No registered players yet.</p>
        )}
        {registered.map((r) => (
          <label
            key={r.id}
            className="flex items-center gap-3 py-2 border-b border-border last:border-0 cursor-pointer"
            data-testid={`organiser-session-live-checkin-row-${r.id}`}
          >
            <Checkbox
              checked={!!r.checkedInAt}
              disabled={!!r.checkedInAt}
              onCheckedChange={() => onCheckIn(r.id)}
            />
            <Avatar className="w-7 h-7">
              <AvatarImage src={r.userAvatar ?? undefined} />
              <AvatarFallback>{r.userName?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{r.userName}</span>
            {r.checkedInAt && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function LiveRoundPanel({
  round,
  loading,
  busy,
  roundReadyForNext,
  onGenerateRound,
  onStart,
  onScore,
}: {
  round: { round: { id: string; roundNumber: number; status: string }; matches: MatchWithPlayers[] } | null | undefined;
  loading: boolean;
  busy: boolean;
  roundReadyForNext: boolean;
  onGenerateRound: () => void;
  onStart: (matchId: string) => void;
  onScore: (matchId: string, teamAGames: number, teamBGames: number) => void;
}) {
  if (loading) {
    return <TennisBallSpinner />;
  }

  if (!round || round.matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground space-y-3">
        <p>No round yet — start one to pair up checked-in players.</p>
        <Button disabled={busy} onClick={onGenerateRound} data-testid="organiser-session-live-generate-round">
          Start Round 1
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="organiser-session-live-courts">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Round {round.round.roundNumber} · {round.round.status === "completed" ? "All matches confirmed" : "In progress"}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !roundReadyForNext}
          onClick={onGenerateRound}
          data-testid="organiser-session-live-generate-round-inline"
          title={roundReadyForNext ? undefined : "Every match this round needs a confirmed score first"}
        >
          Generate Next Round
        </Button>
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
  const [teamAGames, setTeamAGames] = useState("");
  const [teamBGames, setTeamBGames] = useState("");
  const names = (players: MatchWithPlayers["teamA"]) => players.map((p) => p.name).join(" & ");

  const canSubmit =
    teamAGames !== "" &&
    teamBGames !== "" &&
    Number(teamAGames) >= 0 &&
    Number(teamBGames) >= 0;

  return (
    <Card className="shadow-sm" data-testid={`organiser-session-live-match-${match.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">{match.courtLabel}</p>
          {match.status === "confirmed" ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Score submitted
            </Badge>
          ) : match.status === "playing" ? (
            <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
              <Hourglass className="w-3.5 h-3.5" /> Waiting for score
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              Pending
            </Badge>
          )}
        </div>

        <p className="text-sm mb-1">{names(match.teamA)}</p>
        <p className="text-xs text-muted-foreground mb-2">vs</p>
        <p className="text-sm mb-3">{names(match.teamB)}</p>

        {match.status === "confirmed" ? (
          <div className="flex items-center justify-center gap-3 py-1 text-lg font-bold">
            <span>{match.teamAGames}</span>
            <span className="text-muted-foreground">–</span>
            <span>{match.teamBGames}</span>
          </div>
        ) : match.status === "pending" ? (
          <Button size="sm" variant="secondary" className="w-full" disabled={busy} onClick={() => onStart(match.id)}>
            Start Match
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="w-16 h-8"
              value={teamAGames}
              onChange={(e) => setTeamAGames(e.target.value)}
              data-testid={`organiser-session-live-match-${match.id}-score-a`}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              className="w-16 h-8"
              value={teamBGames}
              onChange={(e) => setTeamBGames(e.target.value)}
              data-testid={`organiser-session-live-match-${match.id}-score-b`}
            />
            <Button
              size="sm"
              className="flex-1"
              disabled={!canSubmit || busy}
              onClick={() => onScore(match.id, Number(teamAGames), Number(teamBGames))}
              data-testid={`organiser-session-live-match-${match.id}-save-score`}
            >
              Enter Score
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaderboardPanel({
  rows,
  loading,
}: {
  rows: { userId: string; userName: string; userAvatar: string | null; matchesPlayed: number; wins: number; losses: number; draws: number; gamesWon: number; gamesLost: number; restRounds: number }[];
  loading: boolean;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <TennisBallSpinner />}
        {!loading && rows.length === 0 && (
          <p className="text-muted-foreground text-sm">No confirmed matches yet.</p>
        )}
        {rows.map((row, i) => (
          <div
            key={row.userId}
            className="flex items-center gap-3 py-2 border-b border-border last:border-0"
            data-testid={`organiser-session-live-leaderboard-row-${row.userId}`}
          >
            <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
            <Avatar className="w-7 h-7">
              <AvatarImage src={row.userAvatar ?? undefined} />
              <AvatarFallback>{row.userName?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <span className="text-sm flex-1">{row.userName}</span>
            <span className="text-xs text-muted-foreground">
              {row.wins}W{row.draws > 0 ? `–${row.draws}D` : ""}–{row.losses}L
            </span>
            <span className="text-xs text-muted-foreground w-14 text-right">
              {row.gamesWon}–{row.gamesLost}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Shown on production while TC Live is staging-only (see the isStaging
// check above and server/routes/organizer.ts requireStagingEnv). Not an
// error state - the session and its registrations are perfectly real,
// this specific screen just isn't turned on for real sessions yet.
function TcLiveComingSoonStub({ sessionId }: { sessionId?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="max-w-md w-full shadow-sm text-center">
        <CardHeader>
          <CardTitle asChild><h1>Live sessions are coming soon</h1></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We're still finishing the live check-in, court, and scoring experience. It'll show up
            here as soon as it's ready.
          </p>
          {sessionId && (
            <Button asChild variant="outline">
              <Link href={`/organiser/sessions/${sessionId}`}>Back to Session Workspace</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
