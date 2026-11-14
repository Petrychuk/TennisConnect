/*
  TC Live v1 rules shared by the server (authoritative) and the Live screen
  (so a control is disabled with the same reason the server would give).
  Social Play Singles and Doubles only - no draws, brackets, leagues or teams.

  Pure - unit-tested in ./liveRules.test.ts.
*/

export type LiveMatchMode = "singles" | "doubles";

/** Players one court needs: 2 for singles, 4 for doubles. */
export const PLAYERS_PER_COURT: Record<LiveMatchMode, number> = { singles: 2, doubles: 4 };

export const MAX_GAMES = 99;

export function liveModeOf(matchMode: string | null | undefined): LiveMatchMode {
  return matchMode === "singles" ? "singles" : "doubles";
}

/** null when the score can be saved; otherwise the reason. */
export function scoreProblem(teamAGames: unknown, teamBGames: unknown): string | null {
  for (const v of [teamAGames, teamBGames]) {
    if (typeof v !== "number" || !Number.isInteger(v)) return "Scores must be whole numbers of games";
    if (v < 0 || v > MAX_GAMES) return `Scores must be between 0 and ${MAX_GAMES} games`;
  }
  if (teamAGames === 0 && teamBGames === 0) return "Enter the games each side won - 0-0 isn't a result";
  return null;
}

/** Why a session can't go live yet, or null. `available` = checked in, registered, not withdrawn/unavailable. */
export function goLiveProblem(session: { status: string; courtsCount: number | null; matchMode: string | null }, available: number): string | null {
  if (session.status === "live") return null; // already live - going live again is a no-op
  if (session.status !== "published") return `Can't go live from status "${session.status}" - session must be published first`;
  if (!session.courtsCount || session.courtsCount < 1) return "Set a court count for this session before going live";
  const mode = liveModeOf(session.matchMode);
  const needed = PLAYERS_PER_COURT[mode];
  if (available < needed) return `${mode === "singles" ? "Singles" : "Doubles"} needs at least ${needed} checked-in players to go live`;
  return null;
}

/** Why the next round can't be generated with this many available players, or null. */
export function roundProblem(matchMode: string | null | undefined, available: number): string | null {
  const mode = liveModeOf(matchMode);
  const needed = PLAYERS_PER_COURT[mode];
  if (available < needed) {
    return `${mode === "singles" ? "Singles" : "Doubles"} needs at least ${needed} available players for a round (${available} now)`;
  }
  return null;
}

/** A match that no longer holds up its round: scored, or marked "not played". */
export function matchClosed(status: string): boolean {
  return status === "confirmed" || status === "abandoned";
}

/** Why a match can't be marked "not played", or null (already not played = no-op). */
export function notPlayedProblem(status: string): string | null {
  if (status === "confirmed") return "This match has a score - correct the score instead";
  return null;
}

/**
 * Why the current round can't be redone (reshuffled with whoever is available
 * now), or null. Only before anything happened on court: once a match is
 * started, scored or marked not played the round stays as it is.
 */
export function redoRoundProblem(round: { status: string } | null | undefined, matches: { status: string }[]): string | null {
  if (!round) return "There is no round to redo yet";
  if (round.status !== "active" || matches.some((m) => m.status !== "pending")) {
    return "A match in this round has started - the round can't be redone";
  }
  return null;
}
