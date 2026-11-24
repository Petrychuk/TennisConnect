/* What one player sees in TC Live (TC-189) - pure, used by server/routes/livePlayer.ts. */
import { playerScoreAction, sideOf } from "@shared/liveRules";
import type { LeaderboardRow, MatchWithPlayers, SessionRound, TennisSession } from "@shared/schema";

export interface PlayerLiveView {
  session: { id: string; title: string; status: string; matchMode: string | null; startAt: Date | string };
  checkedIn: boolean;
  round: { number: number; status: string } | null;
  resting: boolean;
  match: (MatchWithPlayers & { mySide: "A" | "B"; action: ReturnType<typeof playerScoreAction> }) | null;
  leaderboard: LeaderboardRow[];
}

/** Unit-tested in ./playerLiveView.test.ts. */
export function buildPlayerLiveView(
  session: Pick<TennisSession, "id" | "title" | "status" | "matchMode" | "startAt">,
  userId: string,
  checkedIn: boolean,
  current: { round: SessionRound; matches: MatchWithPlayers[] } | undefined | null,
  leaderboard: LeaderboardRow[],
): PlayerLiveView {
  const match = current?.matches.find((m) => sideOf(m, userId) !== null) ?? null;
  return {
    session: { id: session.id, title: session.title, status: session.status, matchMode: session.matchMode ?? null, startAt: session.startAt },
    checkedIn,
    round: current ? { number: current.round.roundNumber, status: current.round.status } : null,
    resting: !!current && !match && (current.round.restingPlayerIds ?? []).includes(userId),
    match: match ? { ...match, mySide: sideOf(match, userId)!, action: playerScoreAction(match, userId) } : null,
    leaderboard,
  };
}
