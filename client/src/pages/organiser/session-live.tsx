import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Play, CheckCircle2, Hourglass, Loader2, Trophy } from "lucide-react";
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
import type { MatchWithPlayers, RegistrationWithUser } from "@shared/schema";
import { cn } from "@/lib/utils";

// TC Live Engine v0.1 control centre. Three states share this one screen,
// matching the diagram's Registration -> Check-in -> Live -> Results flow:
//   "published"  -> check-in list + Go Live
//   "live"       -> courts/rounds + organizer-only score entry
//   "completed"  -> final leaderboard
// Everything here calls the real API (server/routes/organizer.ts TC Live
// block) - no more mock court data.
export default function OrganiserSessionLivePage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id/live");
  const sessionId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
            <CardTitle>Organiser access required</CardTitle>
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
        <Loader2 className="w-6 h-6 animate-spin text-primary-foreground/60" />
      </div>
    );
  }

  if (!isStaging) {
    return <TcLiveComingSoonStub sessionId={sessionId} />;
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary-foreground/60" />
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

  return (
    <div className="min-h-screen bg-foreground text-primary-foreground" data-testid="organiser-session-live">
      <SEO
        title={`Live — ${session.title} | TennisConnect`}
        description={`Live control centre for ${session.title}.`}
        noIndex
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href={`/organiser/sessions/${session.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
          data-testid="organiser-session-live-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Session Workspace
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Badge className="bg-primary text-primary-foreground gap-1.5 mb-2" data-testid="organiser-session-live-badge">
              {status === "live" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                </span>
              )}
              {status === "live" ? "LIVE" : status === "completed" ? "COMPLETED" : "CHECK-IN"}
            </Badge>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">{session.title}</h1>
            <p className="text-primary-foreground/70 text-sm mt-1">{session.location}</p>
          </div>

          {status === "live" && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                disabled={busy || !roundReadyForNext}
                onClick={() => runAction("generate the next round", () => generateNextRound(session.id))}
                data-testid="organiser-session-live-generate-round"
                title={roundReadyForNext ? undefined : "Every match this round needs a confirmed score first"}
              >
                {round ? "Generate Next Round" : "Start Round 1"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => runAction("finish the session", () => finishSession(session.id))}
                data-testid="organiser-session-live-finish"
              >
                Finish Session
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-md" data-testid="organiser-session-live-stats">
          <div>
            <p className="text-2xl font-bold" data-testid="organiser-session-live-registered">{session.registeredCount}</p>
            <p className="text-xs text-primary-foreground/70">Registered</p>
          </div>
          <div>
            <p className="text-2xl font-bold" data-testid="organiser-session-live-checkedin">{checkedInCount}</p>
            <p className="text-xs text-primary-foreground/70">Checked In</p>
          </div>
          <div>
            <p className="text-2xl font-bold" data-testid="organiser-session-live-waiting">{session.waitlistedCount}</p>
            <p className="text-xs text-primary-foreground/70">Waiting List</p>
          </div>
        </div>

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

        {status === "live" && (
          <LiveRoundPanel
            round={round}
            loading={roundQuery.isLoading}
            busy={busy}
            onStart={(matchId) => runAction("start the match", () => startMatch(session.id, matchId))}
            onScore={(matchId, a, b) => runAction("save the score", () => reportMatchScore(session.id, matchId, a, b))}
          />
        )}

        {(status === "live" || status === "completed") && (
          <LeaderboardPanel rows={leaderboardQuery.data ?? []} loading={leaderboardQuery.isLoading} />
        )}

        {status !== "published" && status !== "live" && status !== "completed" && (
          <div className="rounded-2xl border border-dashed border-primary-foreground/20 py-12 text-center text-primary-foreground/60">
            This session isn't ready for live control yet (status: {status}).
          </div>
        )}
      </div>
    </div>
  );
}

function CheckInPanel({
  registrations,
  loading,
  busy,
  canGoLive,
  missingCourts,
  onCheckIn,
  onGoLive,
}: {
  registrations: RegistrationWithUser[];
  loading: boolean;
  busy: boolean;
  canGoLive: boolean;
  missingCourts: boolean;
  onCheckIn: (registrationId: string) => void;
  onGoLive: () => void;
}) {
  const registered = registrations.filter((r) => r.status === "registered");

  return (
    <Card className="bg-primary-foreground/5 border-primary-foreground/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-primary-foreground">Check-In</CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <Loader2 className="w-5 h-5 animate-spin text-primary-foreground/60" />}
        {!loading && registered.length === 0 && (
          <p className="text-primary-foreground/60 text-sm">No registered players yet.</p>
        )}
        {registered.map((r) => (
          <label
            key={r.id}
            className="flex items-center gap-3 py-2 border-b border-primary-foreground/10 last:border-0 cursor-pointer"
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
  onStart,
  onScore,
}: {
  round: { round: { id: string; roundNumber: number; status: string }; matches: MatchWithPlayers[] } | null | undefined;
  loading: boolean;
  busy: boolean;
  onStart: (matchId: string) => void;
  onScore: (matchId: string, teamAGames: number, teamBGames: number) => void;
}) {
  if (loading) {
    return <Loader2 className="w-6 h-6 animate-spin text-primary-foreground/60" />;
  }

  if (!round || round.matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary-foreground/20 py-12 text-center text-primary-foreground/60">
        No round yet — hit "Start Round 1" above to pair up checked-in players.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="organiser-session-live-courts">
      <p className="text-sm text-primary-foreground/70">
        Round {round.round.roundNumber} · {round.round.status === "completed" ? "All matches confirmed" : "In progress"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
  const names = (players: MatchWithPlayers["teamA"]) => players.map((p) => p.name).join(" / ");

  const canSubmit =
    teamAGames !== "" &&
    teamBGames !== "" &&
    Number(teamAGames) !== Number(teamBGames) &&
    Number(teamAGames) >= 0 &&
    Number(teamBGames) >= 0;

  return (
    <div
      className={cn(
        "rounded-2xl p-4 border border-primary-foreground/10",
        match.status === "playing" ? "bg-primary/20" : "bg-primary-foreground/5"
      )}
      data-testid={`organiser-session-live-match-${match.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold">{match.courtLabel}</p>
        {match.status === "confirmed" ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {match.teamAGames}–{match.teamBGames}
          </Badge>
        ) : match.status === "playing" ? (
          <Badge className="gap-1"><Play className="w-3.5 h-3.5" /> Playing</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-primary-foreground/70">
            <Hourglass className="w-3.5 h-3.5" /> Pending
          </Badge>
        )}
      </div>

      <p className="text-sm mb-1">{names(match.teamA)}</p>
      <p className="text-xs text-primary-foreground/60 mb-3">vs</p>
      <p className="text-sm mb-3">{names(match.teamB)}</p>

      {match.status === "confirmed" ? null : match.status === "pending" ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onStart(match.id)}>
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
          <span className="text-primary-foreground/60">–</span>
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
            disabled={!canSubmit || busy}
            onClick={() => onScore(match.id, Number(teamAGames), Number(teamBGames))}
            data-testid={`organiser-session-live-match-${match.id}-save-score`}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function LeaderboardPanel({
  rows,
  loading,
}: {
  rows: { userId: string; userName: string; userAvatar: string | null; matchesPlayed: number; wins: number; losses: number; gamesWon: number; gamesLost: number; restRounds: number }[];
  loading: boolean;
}) {
  return (
    <Card className="bg-primary-foreground/5 border-primary-foreground/10">
      <CardHeader>
        <CardTitle className="text-primary-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5" /> Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-primary-foreground/60" />}
        {!loading && rows.length === 0 && (
          <p className="text-primary-foreground/60 text-sm">No confirmed matches yet.</p>
        )}
        {rows.map((row, i) => (
          <div
            key={row.userId}
            className="flex items-center gap-3 py-2 border-b border-primary-foreground/10 last:border-0"
            data-testid={`organiser-session-live-leaderboard-row-${row.userId}`}
          >
            <span className="w-5 text-sm text-primary-foreground/60">{i + 1}</span>
            <Avatar className="w-7 h-7">
              <AvatarImage src={row.userAvatar ?? undefined} />
              <AvatarFallback>{row.userName?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <span className="text-sm flex-1">{row.userName}</span>
            <span className="text-xs text-primary-foreground/60">{row.wins}W–{row.losses}L</span>
            <span className="text-xs text-primary-foreground/60 w-14 text-right">
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
          <CardTitle>Live sessions are coming soon</CardTitle>
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
