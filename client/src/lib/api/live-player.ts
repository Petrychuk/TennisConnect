import { apiRequest } from "@/lib/queryClient";
import type { LeaderboardRow, MatchWithPlayers } from "@shared/schema";

/*
  TC Live for players (TC-189): their current match, score reports and the
  leaderboard. Server: server/routes/livePlayer.ts.
*/

export type PlayerMatchAction = "enter" | "confirm" | "waiting" | "disputed" | "final" | "none";

export interface PlayerLiveView {
  session: { id: string; title: string; status: string; matchMode: string | null; startAt: string };
  checkedIn: boolean;
  round: { number: number; status: string } | null;
  resting: boolean;
  match: (MatchWithPlayers & { mySide: "A" | "B"; action: PlayerMatchAction }) | null;
  leaderboard: LeaderboardRow[];
}

export const playerLiveKey = (sessionId: string) => ["/api/live/sessions", sessionId, "me"] as const;

/** null when Live isn't available for this player here (404 / 403) - the entry point stays hidden. */
export async function getPlayerLive(sessionId: string): Promise<PlayerLiveView | null> {
  const res = await fetch(`/api/live/sessions/${sessionId}/me`, { credentials: "include" });
  if (res.status === 404 || res.status === 403 || res.status === 401) return null;
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Couldn't load the live session");
  return res.json();
}

export async function reportPlayerScore(sessionId: string, matchId: string, teamAGames: number, teamBGames: number) {
  const res = await apiRequest("POST", `/api/live/sessions/${sessionId}/matches/${matchId}/report`, { teamAGames, teamBGames });
  return (await res.json()) as { outcome: "reported" | "confirmed" | "disputed" };
}
