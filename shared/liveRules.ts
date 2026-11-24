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

/*
  Player score entry (TC-189, PO decision 10 Nov 2026 - phase 1).

  A player on court reports their match's score from their phone; the other
  side confirms it by reporting the same score. Statuses (matches.status is
  text, so no migration): pending / playing -> "reported" (one side said it)
  -> "confirmed" (the other side agreed) or "disputed" (the other side said
  something else; the organiser decides). Only confirmed counts, and only
  confirmed or not-played closes a round (matchClosed). The organiser can
  enter or correct any score at any time (the existing organiser route),
  which confirms it.
*/

export type PlayerScoreOutcome =
  | { kind: "reported" } // first report, or the same side updating its own report
  | { kind: "confirmed" } // the other side reported the same score
  | { kind: "disputed" }; // the other side reported a different score

export interface PlayerScoreMatch {
  status: string;
  teamAIds: string[];
  teamBIds: string[];
  teamAGames: number | null;
  teamBGames: number | null;
  reportedBy: string | null;
}

export function sideOf(match: Pick<PlayerScoreMatch, "teamAIds" | "teamBIds">, userId: string | null | undefined): "A" | "B" | null {
  if (!userId) return null;
  if (match.teamAIds.includes(userId)) return "A";
  if (match.teamBIds.includes(userId)) return "B";
  return null;
}

/**
 * What a player's score report does, or why it can't be taken (with the HTTP
 * status the server answers). Score validity itself is scoreProblem.
 */
export function playerScoreDecision(
  sessionStatus: string,
  match: PlayerScoreMatch,
  userId: string,
  teamAGames: number,
  teamBGames: number,
): { ok: true; outcome: PlayerScoreOutcome } | { ok: false; status: number; message: string } {
  if (sessionStatus !== "live") return { ok: false, status: 409, message: "Scores can only be entered while the session is live" };
  const side = sideOf(match, userId);
  if (!side) return { ok: false, status: 403, message: "Only players in this match can enter its score" };
  if (match.status === "confirmed") return { ok: false, status: 409, message: "This score is already confirmed - ask the organiser to correct it" };
  if (match.status === "abandoned") return { ok: false, status: 409, message: "This match was marked not played - ask the organiser" };
  if (match.status === "disputed") return { ok: false, status: 409, message: "The two sides entered different scores - the organiser will decide" };
  if (match.status !== "reported") return { ok: true, outcome: { kind: "reported" } };

  const reporterSide = sideOf(match, match.reportedBy);
  // Same side again (or the reporter left the match): their report is replaced.
  if (reporterSide === null || reporterSide === side) return { ok: true, outcome: { kind: "reported" } };
  const same = match.teamAGames === teamAGames && match.teamBGames === teamBGames;
  return { ok: true, outcome: { kind: same ? "confirmed" : "disputed" } };
}

/** The player's own next step on their match, for the player screen. */
export function playerScoreAction(match: PlayerScoreMatch, userId: string): "enter" | "confirm" | "waiting" | "disputed" | "final" | "none" {
  const side = sideOf(match, userId);
  if (!side) return "none";
  if (match.status === "confirmed" || match.status === "abandoned") return "final";
  if (match.status === "disputed") return "disputed";
  if (match.status === "reported") return sideOf(match, match.reportedBy) === side ? "waiting" : "confirm";
  return "enter";
}