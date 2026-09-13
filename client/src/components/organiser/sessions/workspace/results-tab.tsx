import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Download, Clock, Send } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getSessionLeaderboard, sendSessionResults } from "@/lib/api/organizer-sessions";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface ResultsTabProps {
  session: SessionListItem;
}

// "Results are available" is just session.status === "completed" now -
// there was never a real resultsPublished field on an actual session
// (only in the mock data used for local dev/demo), so this gate was
// always false for every real session and results could never show at
// all. The leaderboard itself is computed on demand from confirmed
// matches (see storage.getSessionLeaderboard) - nothing to
// "publish" separately once the session has actually finished.
export function ResultsTab({ session }: ResultsTabProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const leaderboardQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "leaderboard"],
    queryFn: () => getSessionLeaderboard(session.id),
    enabled: session.status === "completed",
  });
  const standings = leaderboardQuery.data ?? [];

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

  if (session.status !== "completed") {
    return (
      <Card className="shadow-sm" data-testid="organiser-session-results-tab">
        <CardContent className="py-16 text-center text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Results aren't available yet</p>
          <p className="text-sm mt-1">
            {session.status === "live" ? "They'll appear here once the session finishes." : "They'll appear here once the session is complete."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm" data-testid="organiser-session-results-tab">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Final Standings
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendResults}
            disabled={sending || standings.length === 0}
            data-testid="organiser-session-results-send"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Sending..." : "Send to Everyone"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast({ title: "Export isn't wired up yet" })} data-testid="organiser-session-results-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {leaderboardQuery.isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading results...</p>
        )}
        {!leaderboardQuery.isLoading && standings.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No confirmed matches for this session yet.
          </p>
        )}
        {standings.map((entry, i) => (
          <div key={entry.userId} className="flex items-center gap-3" data-testid={`organiser-session-results-${i + 1}`}>
            <span className="w-5 text-sm font-bold text-muted-foreground text-center shrink-0">{i + 1}</span>
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={entry.userAvatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{entry.userName[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm flex-1">{entry.userName}</span>
            <span className="text-sm font-semibold">
              {entry.wins}W{entry.draws > 0 ? `-${entry.draws}D` : ""}-{entry.losses}L
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
