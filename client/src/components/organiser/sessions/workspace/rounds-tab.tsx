import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, Play, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import type { MatchWithPlayers } from "@shared/schema";
import { getSessionRounds } from "@/lib/api/organizer-sessions";
import { useLiveAvailable } from "@/lib/use-live-available";

interface RoundsTabProps {
  session: SessionListItem;
  /** On the Live screen itself the "Open Live" button would point at the same page. */
  hideOpenLive?: boolean;
}

/*
  The rounds this session really played (GET /api/organizer/sessions/:id/rounds):
  every stored round, its courts, teams and confirmed scores. It used to
  draw `plannedRoundsCount ?? 5` placeholder rounds - the "5" was invented
  (Phase 1 audit 5.3). Rounds are created in TC Live; this tab only reads.
*/
export function RoundsTab({ session, hideOpenLive = false }: RoundsTabProps) {
  const liveAvailable = useLiveAvailable(session);
  const roundsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "rounds"],
    queryFn: () => getSessionRounds(session.id),
  });

  if (roundsQuery.isLoading) {
    return (
      <div className="space-y-3" data-testid="organiser-session-rounds-loading">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  if (roundsQuery.isError) {
    return (
      <Card className="shadow-sm" data-testid="organiser-session-rounds-tab">
        <CardContent className="py-10 text-center space-y-3" role="alert">
          <p className="font-medium">Couldn't load the rounds.</p>
          <Button variant="outline" size="sm" onClick={() => roundsQuery.refetch()} data-testid="organiser-session-rounds-retry">
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const rounds = roundsQuery.data ?? [];
  if (rounds.length === 0) {
    const canOpenLive = !hideOpenLive && liveAvailable && ["published", "live"].includes(session.status);
    return (
      <Card className="shadow-sm" data-testid="organiser-session-rounds-tab">
        <CardContent className="py-10 text-center text-muted-foreground space-y-3" data-testid="organiser-session-rounds-empty">
          <p className="font-medium text-foreground">No rounds yet</p>
          <p className="text-sm max-w-md mx-auto">
            {liveAvailable
              ? "Rounds are created in Live: check players in, then generate a round to put them on courts. Every round and score shows up here."
              : "Rounds and scores are created in Live, which isn't available on this site yet."}
          </p>
          {canOpenLive && (
            <Button asChild data-testid="organiser-session-rounds-open-live">
              <Link href={`/organiser/sessions/${session.id}/live`}>
                <Play className="w-4 h-4 mr-2" />
                Open Live
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="organiser-session-rounds-tab">
      {rounds.map(({ round, matches }) => {
        const active = round.status === "active";
        const resting = round.restingPlayerIds?.length ?? 0;
        return (
          <Card key={round.id} className={cn("shadow-sm", active && "border-primary/40")} data-testid={`organiser-session-round-${round.roundNumber}`}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle asChild className="text-base">
                <h2 className="flex items-center gap-2">
                  {active ? <Play className="w-4 h-4 text-primary-text" /> : <CheckCircle2 className="w-4 h-4 text-primary-text" />}
                  Round {round.roundNumber}
                </h2>
              </CardTitle>
              <div className="flex items-center gap-2">
                {resting > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid={`organiser-session-round-${round.roundNumber}-resting`}>
                    <Users className="w-3.5 h-3.5" />
                    {resting} resting
                  </span>
                )}
                <Badge className={active ? "bg-primary text-foreground" : "bg-accent text-accent-foreground"}>
                  {active ? "In progress" : "Completed"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {matches.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const names = (team: MatchWithPlayers["teamA"]) => team.map((p) => p.name).join(" & ") || "—";

function MatchRow({ match }: { match: MatchWithPlayers }) {
  const confirmed = match.status === "confirmed" && match.teamAGames != null && match.teamBGames != null;
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm min-w-0" data-testid={`organiser-session-match-${match.id}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
        <span className="font-semibold text-foreground">{match.courtLabel}</span>
        <span data-testid={`organiser-session-match-${match.id}-status`}>
          {confirmed ? "Final" : match.status === "playing" ? "Playing" : match.status === "abandoned" ? "Not played" : "Not started"}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        <span className="truncate" title={names(match.teamA)}>{names(match.teamA)}</span>
        <span className="font-semibold tabular-nums">{confirmed ? match.teamAGames : ""}</span>
        <span className="truncate" title={names(match.teamB)}>{names(match.teamB)}</span>
        <span className="font-semibold tabular-nums">{confirmed ? match.teamBGames : ""}</span>
      </div>
    </div>
  );
}
