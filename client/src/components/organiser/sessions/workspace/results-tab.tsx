import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Download, Clock, Send, Lock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getSessionLeaderboard, getSessionRounds, sendSessionResults } from "@/lib/api/organizer-sessions";
import { csvFileName, downloadCsv, resultsCsv } from "@/lib/organiser-export";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { resultsAreFinal } from "@shared/sessionActions";
import type { LeaderboardRow } from "@shared/schema";

interface ResultsTabProps {
  session: SessionListItem;
}

/*
  Final results (TC-189 phase 5). Shown once the session has finished -
  completed, or archived after that (archiving used to hide them). Read-only:
  after End Session the server refuses scores, rounds and roster changes, so
  nothing on this tab can change. The leaderboard is computed on demand from
  confirmed matches (storage.getSessionLeaderboard); "Not played" matches
  never count.
*/
export function ResultsTab({ session }: ResultsTabProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const final = resultsAreFinal(session.status);

  const leaderboardQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "leaderboard"],
    queryFn: () => getSessionLeaderboard(session.id),
    enabled: final,
  });
  // Same key as the Rounds tab, so the two share one request.
  const roundsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "rounds"],
    queryFn: () => getSessionRounds(session.id),
    enabled: final,
  });
  const standings = leaderboardQuery.data ?? [];
  const rounds = roundsQuery.data ?? [];
  const allMatches = rounds.flatMap((r) => r.matches);
  const summary = [
    { key: "players", label: "Players", value: standings.length },
    { key: "rounds", label: "Rounds", value: rounds.length },
    { key: "scored", label: "Matches scored", value: allMatches.filter((m) => m.status === "confirmed").length },
    { key: "not-played", label: "Not played", value: allMatches.filter((m) => m.status === "abandoned").length },
  ];

  const handleSendResults = async () => {
    setSending(true);
    try {
      const { sentTo } = await sendSessionResults(session.id);
      toast({
        title: sentTo > 0 ? "Results sent" : "Nothing to send",
        description: sentTo > 0 ? `Delivered to ${sentTo} player${sentTo === 1 ? "" : "s"}.` : "No one is registered for this session.",
      });
    } catch (error: any) {
      toast({ title: "Couldn't send results", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!final) {
    return (
      <Card className="shadow-sm" data-testid="organiser-session-results-tab">
        <CardContent className="py-16 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Results aren't available yet</p>
          <p className="text-sm mt-1">
            {session.status === "live" ? "They'll appear here once you end the session." : "They'll appear here once the session is complete."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const loading = leaderboardQuery.isLoading;
  return (
    <div className="space-y-4" data-testid="organiser-session-results-tab" data-final="true">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary-text" />
              Final Standings
              <Badge variant="secondary" className="gap-1 font-medium">
                <Lock className="w-3 h-3" aria-hidden /> Final
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1" data-testid="organiser-session-results-final-note">
              Scores can't be changed after the session ends. Only scored matches count - Not played matches don't.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSendResults} disabled={sending || standings.length === 0} data-testid="organiser-session-results-send">
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending..." : "Send to Everyone"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(csvFileName(session.title, "results"), resultsCsv(standings))}
              disabled={standings.length === 0}
              data-testid="organiser-session-results-export"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {summary.map((s) => (
              <div key={s.key} className="rounded-xl bg-muted/50 px-3 py-2" data-testid={`organiser-session-results-summary-${s.key}`}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-xl font-bold tabular-nums">{roundsQuery.isLoading && s.key !== "players" ? "–" : s.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading results...</p>}
      {!loading && standings.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No scored matches in this session.</CardContent>
        </Card>
      )}

      {standings.length > 0 && <Podium rows={standings.slice(0, 3)} />}

      {standings.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="organiser-session-results-table">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2 text-center font-medium">#</th>
                  <th scope="col" className="px-2 py-2 text-left font-medium">Player</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium" title="Matches played">P</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">W</th>
                  <th scope="col" className="hidden sm:table-cell px-2 py-2 text-center font-medium">D</th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">L</th>
                  <th scope="col" className="hidden sm:table-cell px-2 py-2 text-center font-medium">Games</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium" title="Games won minus games lost">+/−</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {standings.map((entry, i) => {
                  const diff = entry.gamesWon - entry.gamesLost;
                  return (
                    <tr key={entry.userId} className={cn(i < 3 && "bg-primary/5")} data-testid={`organiser-session-results-${i + 1}`} data-user-id={entry.userId}>
                      <td className={cn("px-3 py-2 text-center font-bold tabular-nums", i === 0 ? "text-primary-text" : "text-muted-foreground")}>{i + 1}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar row={entry} />
                          <span className="truncate font-medium">{entry.userName}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">{entry.matchesPlayed}</td>
                      <td className="px-2 py-2 text-center tabular-nums font-semibold">{entry.wins}</td>
                      <td className="hidden sm:table-cell px-2 py-2 text-center tabular-nums">{entry.draws}</td>
                      <td className="px-2 py-2 text-center tabular-nums">{entry.losses}</td>
                      <td className="hidden sm:table-cell px-2 py-2 text-center tabular-nums text-muted-foreground">{entry.gamesWon}–{entry.gamesLost}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium", diff > 0 ? "text-primary-text" : diff < 0 ? "text-destructive" : "text-muted-foreground")}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PlayerAvatar({ row, className }: { row: Pick<LeaderboardRow, "userAvatar" | "userName">; className?: string }) {
  return (
    <Avatar className={cn("h-8 w-8 border border-border shrink-0", className)}>
      <AvatarImage src={row.userAvatar || undefined} />
      <AvatarFallback className="bg-primary/10 text-primary-text text-xs font-bold">{row.userName?.[0] ?? "?"}</AvatarFallback>
    </Avatar>
  );
}

const PLACE = ["1st", "2nd", "3rd"];

/** Top three, winner first on a phone and in the middle from sm up. */
function Podium({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="organiser-session-results-podium">
      {rows.map((row, i) => (
        <Card
          key={row.userId}
          className={cn(
            "shadow-sm",
            i === 0 && "border-primary/40 bg-primary/10 sm:order-2",
            i === 1 && "sm:order-1 sm:mt-4",
            i === 2 && "sm:order-3 sm:mt-6",
          )}
          data-testid={`organiser-session-results-podium-${i + 1}`}
        >
          <CardContent className="flex items-center gap-3 p-4 sm:flex-col sm:text-center">
            <span className={cn("text-xs font-bold uppercase tracking-wide", i === 0 ? "text-primary-text" : "text-muted-foreground")}>{PLACE[i]}</span>
            <PlayerAvatar row={row} className={i === 0 ? "h-12 w-12" : "h-10 w-10"} />
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="font-semibold truncate">{row.userName}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {row.wins}W{row.draws > 0 ? `–${row.draws}D` : ""}–{row.losses}L · games {row.gamesWon}–{row.gamesLost}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
