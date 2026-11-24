import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Coffee, Hourglass, Trophy, WifiOff } from "lucide-react";
import { Navbar } from "@/components/navbar";
import SEO from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MAX_GAMES, scoreProblem } from "@shared/liveRules";
import { getPlayerLive, playerLiveKey, reportPlayerScore, type PlayerLiveView } from "@/lib/api/live-player";

/*
  TC Live for players (TC-189, PO decision 10 Nov 2026): a registered player's
  phone screen during a live session - their court, partner and opponents,
  this round, entering / confirming their match's score, and the leaderboard.
  Mobile-first; the organiser keeps control (confirms, decides disputes,
  corrects). Polls every 10 s like the organiser screen.
*/

const REFRESH_MS = 10_000;

export default function PlaySessionLivePage() {
  const [, params] = useRoute("/play/:id/live");
  const sessionId = params?.id ?? "";
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: playerLiveKey(sessionId),
    queryFn: () => getPlayerLive(sessionId),
    enabled: !!sessionId && isAuthenticated,
    refetchInterval: (q) => ((q.state.data as PlayerLiveView | null)?.session.status === "live" ? REFRESH_MS : false),
  });
  const view = query.data;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="TC Live" description="Your court, your match and the live leaderboard." />
      <Navbar />
      <main className="mx-auto w-full max-w-lg px-4 pb-10 pt-4 space-y-4" data-testid="player-live">
        <Link href={`/play/${sessionId}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground" data-testid="player-live-back">
          <ArrowLeft className="w-4 h-4" /> Session details
        </Link>

        {!isAuthenticated ? (
          <Notice testId="player-live-signin">Sign in to see your court and enter scores.</Notice>
        ) : query.isLoading ? (
          <div className="py-10"><TennisBallSpinner /></div>
        ) : query.isError ? (
          <Notice testId="player-live-error" icon={<WifiOff className="w-5 h-5" />}>
            Couldn't load the live session. <button className="underline" onClick={() => query.refetch()}>Try again</button>
          </Notice>
        ) : !view ? (
          <Notice testId="player-live-unavailable">TC Live isn't available for you in this session.</Notice>
        ) : (
          <LiveContent view={view} />
        )}
      </main>
    </div>
  );
}

function Notice({ children, testId, icon }: { children: React.ReactNode; testId: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground" data-testid={testId}>
      {icon}
      <p>{children}</p>
    </div>
  );
}

function LiveContent({ view }: { view: PlayerLiveView }) {
  const { session, round, match, resting } = view;
  const isLive = session.status === "live";
  const finished = session.status === "completed" || session.status === "archived";
  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight break-words" data-testid="player-live-title">{session.title}</h1>
          <p className="text-sm text-muted-foreground" data-testid="player-live-meta">
            {session.matchMode === "singles" ? "Singles" : "Doubles"}
            {round ? ` · Round ${round.number}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold tracking-wide",
            isLive ? "bg-primary text-foreground" : "bg-muted text-muted-foreground",
          )}
          data-testid="player-live-badge"
        >
          {isLive ? "LIVE" : finished ? "FINAL" : "SOON"}
        </span>
      </header>

      {!isLive && !finished && (
        <Notice testId="player-live-not-started">
          Live starts at {new Date(session.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Your court appears here once the organiser draws the round.
        </Notice>
      )}
      {isLive && !view.checkedIn && (
        <Notice testId="player-live-not-checked-in">You aren't checked in yet - tell the organiser you've arrived.</Notice>
      )}
      {isLive && view.checkedIn && !round && (
        <Notice testId="player-live-no-round" icon={<Hourglass className="w-5 h-5" />}>Waiting for the organiser to draw the first round.</Notice>
      )}
      {isLive && round && resting && (
        <Notice testId="player-live-resting" icon={<Coffee className="w-5 h-5" />}>You're resting this round. You'll play in the next one.</Notice>
      )}
      {isLive && round && !match && !resting && view.checkedIn && (
        <Notice testId="player-live-next-round">You join from the next round.</Notice>
      )}
      {match && <MyMatchCard sessionId={session.id} match={match} canReport={isLive} />}

      <Leaderboard rows={view.leaderboard} final={finished} />
    </>
  );
}

function MyMatchCard({ sessionId, match, canReport }: { sessionId: string; match: NonNullable<PlayerLiveView["match"]>; canReport: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [mine, setMine] = useState("");
  const [theirs, setTheirs] = useState("");
  const mySide = match.mySide;
  const us = mySide === "A" ? match.teamA : match.teamB;
  const them = mySide === "A" ? match.teamB : match.teamA;
  const ourScore = mySide === "A" ? match.teamAGames : match.teamBGames;
  const theirScore = mySide === "A" ? match.teamBGames : match.teamAGames;
  const names = (players: { name: string }[]) => players.map((p) => p.name).join(" & ");

  const a = mySide === "A" ? Number(mine) : Number(theirs);
  const b = mySide === "A" ? Number(theirs) : Number(mine);
  const filled = mine !== "" && theirs !== "";
  const problem = filled ? scoreProblem(a, b) : null;

  const report = useMutation({
    mutationFn: (s: { a: number; b: number }) => reportPlayerScore(sessionId, match.id, s.a, s.b),
    onSuccess: ({ outcome }) => {
      setEditing(false);
      toast({
        title: outcome === "confirmed" ? "Score confirmed" : outcome === "disputed" ? "Scores differ" : "Score sent",
        description:
          outcome === "confirmed" ? "It counts on the leaderboard." : outcome === "disputed" ? "The organiser will decide the score." : "The other side confirms it.",
      });
    },
    onError: (error: Error) => toast({ title: "Score not saved", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: playerLiveKey(sessionId) }),
  });

  const action = match.action;
  const showInputs = canReport && (action === "enter" || editing);
  const id = "player-live-match";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3" data-testid={id} data-action={action}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-xl font-bold" data-testid={`${id}-court`}>{match.courtLabel}</p>
        <StatusPill action={action} />
      </div>

      <TeamRow label="You" players={names(us)} score={showInputs ? undefined : ourScore} highlight testId={`${id}-us`}>
        {showInputs && <ScoreInput value={mine} onChange={setMine} label="Your games" testId={`${id}-score-mine`} />}
      </TeamRow>
      <TeamRow label="Opponents" players={names(them)} score={showInputs ? undefined : theirScore} testId={`${id}-them`}>
        {showInputs && <ScoreInput value={theirs} onChange={setTheirs} label="Their games" testId={`${id}-score-theirs`} />}
      </TeamRow>

      {problem && <p className="text-xs text-destructive" data-testid={`${id}-score-error`}>{problem}</p>}
      {action === "waiting" && !editing && <p className="text-sm text-muted-foreground" data-testid={`${id}-waiting`}>Sent. Waiting for the other side to confirm.</p>}
      {action === "disputed" && <p className="text-sm text-destructive" data-testid={`${id}-disputed`}>The two sides entered different scores. The organiser will decide.</p>}
      {action === "final" && match.status === "abandoned" && <p className="text-sm text-muted-foreground">Not played - doesn't count.</p>}

      {canReport && (
        <div className="flex flex-col gap-2">
          {showInputs && (
            <Button size="lg" className="min-h-12 w-full" disabled={!filled || !!problem || report.isPending} onClick={() => report.mutate({ a, b })} data-testid={`${id}-submit`}>
              {report.isPending ? "Sending..." : "Submit score"}
            </Button>
          )}
          {action === "confirm" && !editing && match.teamAGames != null && match.teamBGames != null && (
            <>
              <Button size="lg" className="min-h-12 w-full" disabled={report.isPending} onClick={() => report.mutate({ a: match.teamAGames!, b: match.teamBGames! })} data-testid={`${id}-confirm`}>
                Confirm {ourScore}–{theirScore}
              </Button>
              <Button variant="outline" className="min-h-11 w-full" onClick={() => setEditing(true)} data-testid={`${id}-dispute`}>
                That's not right
              </Button>
            </>
          )}
          {action === "waiting" && !editing && (
            <Button variant="ghost" className="min-h-11 w-full" onClick={() => setEditing(true)} data-testid={`${id}-change`}>
              Change my score
            </Button>
          )}
          {editing && (
            <Button variant="ghost" className="min-h-11 w-full" onClick={() => setEditing(false)} data-testid={`${id}-cancel`}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function StatusPill({ action }: { action: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    enter: { text: "Playing", cls: "bg-primary/20 text-primary-text" },
    confirm: { text: "Confirm score", cls: "bg-sky-100 text-sky-800" },
    waiting: { text: "Sent", cls: "bg-muted text-muted-foreground" },
    disputed: { text: "Scores differ", cls: "bg-destructive/10 text-destructive" },
    final: { text: "Final", cls: "bg-muted text-foreground" },
  };
  const s = map[action] ?? map.enter;
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)} data-testid="player-live-match-status">{s.text}</span>;
}

function TeamRow({ label, players, score, highlight, children, testId }: { label: string; players: string; score?: number | null; highlight?: boolean; children?: React.ReactNode; testId: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", highlight ? "bg-primary/10" : "bg-muted/50")} data-testid={testId}>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold break-words">{players}</p>
      </div>
      {children ?? (score != null ? <span className="w-12 text-center text-2xl font-bold tabular-nums">{score}</span> : null)}
    </div>
  );
}

function ScoreInput({ value, onChange, label, testId }: { value: string; onChange: (v: string) => void; label: string; testId: string }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_GAMES}
      aria-label={label}
      className="h-12 w-16 shrink-0 text-center text-xl font-bold tabular-nums"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    />
  );
}

/** Dark leaderboard card - the phone view of the TC Live design. */
function Leaderboard({ rows, final }: { rows: PlayerLiveView["leaderboard"]; final: boolean }) {
  return (
    <section className="rounded-2xl bg-foreground text-background p-4 shadow-sm" data-testid="player-live-leaderboard">
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
        <Trophy className="w-5 h-5 text-primary" aria-hidden /> {final ? "Final leaderboard" : "Live leaderboard"}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm opacity-70">No scores yet.</p>
      ) : (
        <ol className="space-y-1">
          <li className="grid grid-cols-[1.5rem_1fr_3.5rem_1.75rem_1.75rem_1.75rem] gap-2 px-2 text-xs opacity-60">
            <span>#</span><span>Player</span><span className="text-right">Points</span><span className="text-right">W</span><span className="text-right">D</span><span className="text-right">L</span>
          </li>
          {rows.map((row, i) => (
            <li
              key={row.userId}
              className={cn("grid grid-cols-[1.5rem_1fr_3.5rem_1.75rem_1.75rem_1.75rem] items-center gap-2 rounded-lg px-2 py-1.5 text-sm", i === 0 && "bg-primary text-foreground font-semibold")}
              data-testid={`player-live-leaderboard-row-${row.userId}`}
            >
              <span className="tabular-nums">{i + 1}</span>
              <span className="truncate">{row.userName}</span>
              <span className="text-right tabular-nums">{row.points}</span>
              <span className="text-right tabular-nums">{row.wins}</span>
              <span className="text-right tabular-nums" data-testid={`player-live-leaderboard-row-${row.userId}-draws`}>{row.draws}</span>
              <span className="text-right tabular-nums">{row.losses}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
