// TC Live Engine — round generation.
//
// Deliberately pure: everything here takes plain data in and returns plain
// data out, no db/ import. server/storage.ts is responsible for loading the
// checked-in roster + past matches, calling into this file, and persisting
// the result. Keeping the pairing logic DB-free means it can be unit tested
// directly and reused if the pairing rules ever need to run somewhere else
// (e.g. a preview before the organizer commits to "Generate Next Round").
//
// v0.1 scope per the TC Live spec: organizer-only score entry, games-count
// scoring, no court queue/overflow (extra checked-in players rest, they
// don't wait for a court to free up mid-round). See shared/constants/sessions.ts
// MATCH_MODE / MATCH_STATUS / SESSION_ROUND_STATUS for the enums used below.

import type { MatchMode } from "@shared/constants/sessions";

export interface LivePlayer {
  id: string;
}

// One row per past match in this session, reduced to just the ids needed
// for history-aware pairing. Bye/rest rounds aren't matches, so they don't
// appear here — rest history comes from `restCounts` instead.
export interface PastMatch {
  teamAIds: string[];
  teamBIds: string[];
}

export interface PlanRoundInput {
  players: LivePlayer[]; // checked-in AND liveStatus is null (see storage.ts)
  courtsCount: number;
  mode: MatchMode;
  pastMatches: PastMatch[]; // every match ever generated for this session, any round
  restCounts: Record<string, number>; // userId -> how many past rounds they rested
}

export interface PlannedMatch {
  courtLabel: string;
  teamAIds: string[];
  teamBIds: string[];
}

export interface PlanRoundResult {
  matches: PlannedMatch[];
  restingPlayerIds: string[];
}

const TEAM_SIZE: Record<MatchMode, number> = { singles: 1, doubles: 2 };

/** Canonical, order-independent key for a pair of player ids. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/** How many times a and b have been on the same team (partners) before. */
function buildPartnerCounts(pastMatches: PastMatch[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (ids: string[]) => {
    if (ids.length < 2) return;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = pairKey(ids[i], ids[j]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  };
  for (const m of pastMatches) {
    bump(m.teamAIds);
    bump(m.teamBIds);
  }
  return counts;
}

/** How many times a and b have faced each other as opponents before. */
function buildOpponentCounts(pastMatches: PastMatch[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of pastMatches) {
    for (const a of m.teamAIds) {
      for (const b of m.teamBIds) {
        const key = pairKey(a, b);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** Fisher-Yates, kept local so this file has no other dependencies. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks who rests this round. Priority (per the TC Live spec): players
 * with the FEWEST rests so far are the ones who rest now — that's what
 * converges everyone's rest count toward equal over the course of a
 * session, rather than concentrating rests on whoever drew the short
 * straw once. Random tie-breaker for players with an equal rest count.
 */
function pickResters(
  players: LivePlayer[],
  restCounts: Record<string, number>,
  numToRest: number
): { resting: LivePlayer[]; playing: LivePlayer[] } {
  if (numToRest <= 0) return { resting: [], playing: players };

  const sorted = shuffle(players).sort(
    (a, b) => (restCounts[a.id] ?? 0) - (restCounts[b.id] ?? 0)
  );
  const resting = sorted.slice(0, numToRest);
  const restingIds = new Set(resting.map((p) => p.id));
  const playing = players.filter((p) => !restingIds.has(p.id));
  return { resting, playing };
}

/**
 * Greedy pairing: repeatedly take the first unpaired entity and match it
 * with whichever remaining entity has the lowest history count against it
 * (never-played-together/against = 0, preferred). Ties broken randomly via
 * the pre-shuffle. Good enough for typical Social Tennis group sizes
 * (dozens of players) — not claiming global-optimum matching, just "avoid
 * obvious repeats" the way an organizer doing this by hand would.
 */
function greedyPairByHistory<T extends { id: string }>(
  entities: T[],
  historyCounts: Map<string, number>
): [T, T][] {
  const pool = shuffle(entities);
  const pairs: [T, T][] = [];

  while (pool.length >= 2) {
    const current = pool.shift()!;
    let bestIdx = 0;
    let bestScore = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const score = historyCounts.get(pairKey(current.id, pool[i].id)) ?? 0;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const [partner] = pool.splice(bestIdx, 1);
    pairs.push([current, partner]);
  }
  // pool.length === 1 here only if entities.length was odd - callers are
  // responsible for making sure the playing group divides evenly for the
  // chosen mode (see planRound below), so this is a defensive no-op path.
  return pairs;
}

/**
 * A synthetic "team" entity so doubles teams can be fed through the same
 * greedyPairByHistory used for singles opponents, keyed by a combined id.
 */
interface Team {
  id: string; // combined key, only used for pairKey lookups below
  playerIds: string[];
}

function buildOpponentCountsForTeams(
  teams: Team[],
  playerOpponentCounts: Map<string, number>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i];
      const teamB = teams[j];
      let total = 0;
      for (const a of teamA.playerIds) {
        for (const b of teamB.playerIds) {
          total += playerOpponentCounts.get(pairKey(a, b)) ?? 0;
        }
      }
      counts.set(pairKey(teamA.id, teamB.id), total);
    }
  }
  return counts;
}

export function planRound(input: PlanRoundInput): PlanRoundResult {
  const { players, courtsCount, mode, pastMatches, restCounts } = input;
  const teamSize = TEAM_SIZE[mode];
  const playersPerCourt = teamSize * 2;
  const maxPlaying = Math.min(
    players.length - (players.length % playersPerCourt),
    courtsCount * playersPerCourt
  );
  const numToRest = players.length - maxPlaying;

  const { resting, playing } = pickResters(players, restCounts, numToRest);
  if (playing.length === 0) {
    return { matches: [], restingPlayerIds: resting.map((p) => p.id) };
  }

  const partnerCounts = buildPartnerCounts(pastMatches);
  const opponentCounts = buildOpponentCounts(pastMatches);

  let teams: Team[];
  if (mode === "singles") {
    teams = playing.map((p) => ({ id: p.id, playerIds: [p.id] }));
  } else {
    const partnerPairs = greedyPairByHistory(playing, partnerCounts);
    teams = partnerPairs.map(([a, b]) => ({
      id: pairKey(a.id, b.id),
      playerIds: [a.id, b.id],
    }));
  }

  const teamOpponentCounts =
    mode === "singles" ? opponentCounts : buildOpponentCountsForTeams(teams, opponentCounts);
  const matchups = greedyPairByHistory(teams, teamOpponentCounts);

  const matches: PlannedMatch[] = matchups.map(([teamA, teamB], i) => ({
    courtLabel: `Court ${i + 1}`,
    teamAIds: teamA.playerIds,
    teamBIds: teamB.playerIds,
  }));

  return { matches, restingPlayerIds: resting.map((p) => p.id) };
}

// ---- Leaderboard -----------------------------------------------------

export interface LeaderboardInput {
  matches: (PastMatch & { teamAGames: number | null; teamBGames: number | null; status: string })[];
  restCounts: Record<string, number>;
  players: LivePlayer[]; // every player who was ever in the session, checked in or not
}

export interface LeaderboardEntry {
  userId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  restRounds: number;
}

/**
 * Aggregates confirmed matches into per-player win/loss/games records,
 * sorted wins desc then games-diff desc. Only `status === "confirmed"`
 * matches count — a match still `pending`/`playing` has no score yet.
 * This returns bare stats keyed by userId; server/storage.ts joins in
 * the user's name/avatar for the API response (see MatchWithPlayers /
 * LeaderboardRow in shared/schema.ts).
 */
export function computeLeaderboard(input: LeaderboardInput): LeaderboardEntry[] {
  const stats = new Map<string, LeaderboardEntry>();
  const ensure = (id: string) => {
    if (!stats.has(id)) {
      stats.set(id, {
        userId: id,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        restRounds: input.restCounts[id] ?? 0,
      });
    }
    return stats.get(id)!;
  };

  for (const p of input.players) ensure(p.id);

  for (const m of input.matches) {
    if (m.status !== "confirmed" || m.teamAGames == null || m.teamBGames == null) continue;
    const aWon = m.teamAGames > m.teamBGames;
    for (const id of m.teamAIds) {
      const row = ensure(id);
      row.matchesPlayed += 1;
      row.gamesWon += m.teamAGames;
      row.gamesLost += m.teamBGames;
      if (aWon) row.wins += 1;
      else row.losses += 1;
    }
    for (const id of m.teamBIds) {
      const row = ensure(id);
      row.matchesPlayed += 1;
      row.gamesWon += m.teamBGames;
      row.gamesLost += m.teamAGames;
      if (!aWon) row.wins += 1;
      else row.losses += 1;
    }
  }

  return Array.from(stats.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.gamesWon - a.gamesLost;
    const diffB = b.gamesWon - b.gamesLost;
    return diffB - diffA;
  });
}
