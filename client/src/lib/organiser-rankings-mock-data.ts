// Mock data for the Organiser Rankings page (see PRD: "Organiser Rankings —
// Season, Series & Session Results"). No backend endpoint exists for
// Series/Ranking yet (only `seasons` is a real table today) - this file
// exists purely so the page can be built and reviewed against the mockup
// first, the same way organiser-hub-mock-data.ts and
// organiser-sessions-mock-data.ts seeded earlier hub pages before their
// real APIs landed. Swap this out once Series + session results are real.
//
// Deliberately keeps three independent Series (Tuesday/Wednesday/Thursday
// Competition) inside one Season with different standings each, plus one
// stand-alone Championship - the whole point of the spec is that none of
// these ever mix.

export interface RankingPlayerRow {
  playerId: string;
  name: string;
  avatar: string | null;
  level: string;
  sessionsPlayed: number;
  wins: number;
  points: number;
  change: number; // positive = moved up, negative = moved down, 0 = no movement
}

export interface RankingSessionResultRow {
  playerId: string;
  name: string;
  avatar: string | null;
  matches: number;
  wins: number;
  sessionPoints: number;
}

export interface RankingSession {
  id: string;
  date: string; // ISO, e.g. 2026-04-16
  dayLabel: string; // "16"
  monthLabel: string; // "Apr"
  fullDate: string; // "16 April 2026"
  time: string; // "6:30 PM"
  players: number;
  rounds: number;
  status: "Completed" | "Upcoming";
  results: RankingSessionResultRow[];
}

export interface RankingSeries {
  id: string;
  name: string;
  format: string; // "Social Tennis"
  pointsSystemLabel: string;
  description?: string;
  sessions: RankingSession[]; // newest first
  standings: RankingPlayerRow[]; // accumulated Series Ranking ("All Sessions")
}

export type SeasonStatusLabel = "Active" | "Upcoming" | "Completed";

export interface RankingSeason {
  id: string;
  name: string;
  status: SeasonStatusLabel;
  period: string; // "1 Mar 2026 – 31 May 2026"
  series: RankingSeries[];
}

export interface ChampionshipResult {
  id: string;
  name: string;
  status: "Completed" | "In Progress";
  players: number;
  podium: { playerId: string; name: string; avatar: string | null }[];
}

function fmtSession(iso: string, time: string): Pick<RankingSession, "date" | "dayLabel" | "monthLabel" | "fullDate" | "time"> {
  const d = new Date(`${iso}T00:00:00`);
  return {
    date: iso,
    dayLabel: String(d.getDate()),
    monthLabel: d.toLocaleDateString("en-AU", { month: "short" }),
    fullDate: d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
    time,
  };
}

// Deterministic per-session leaderboard - just rotates through the same
// player pool with position-based points, so different sessions show
// different orders without needing this to reconcile with the aggregate
// Series Ranking (per spec §11, session results are their own thing and
// must NOT be shown as if they were the accumulated season points).
function buildSessionResults(pool: RankingPlayerRow[], seed: number, count: number): RankingSessionResultRow[] {
  const positionPoints = [120, 105, 95, 80, 70, 60, 50, 45];
  const rotated = pool.slice(seed % pool.length).concat(pool.slice(0, seed % pool.length));
  return rotated.slice(0, count).map((p, i) => ({
    playerId: p.playerId,
    name: p.name,
    avatar: p.avatar,
    matches: 5,
    wins: Math.max(1, 4 - i),
    sessionPoints: positionPoints[i] ?? 40,
  }));
}

function buildSessions(seriesLabel: string, dates: [string, string][], pool: RankingPlayerRow[], playerCounts: number[]): RankingSession[] {
  return dates
    .map(([iso, time], i) => {
      const count = playerCounts[i] ?? playerCounts[playerCounts.length - 1];
      return {
        id: `${seriesLabel}-${iso}`,
        ...fmtSession(iso, time),
        players: count,
        rounds: 5,
        status: "Completed" as const,
        results: buildSessionResults(pool, i, Math.min(count, pool.length)),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
}

// --- Wednesday Competition (numbers straight from the spec's own examples) ---
const wednesdayStandings: RankingPlayerRow[] = [
  { playerId: "alex-brown", name: "Alex Brown", avatar: null, level: "Advanced 4.5", sessionsPlayed: 10, wins: 8, points: 1250, change: 2 },
  { playerId: "kate-smith", name: "Kate Smith", avatar: null, level: "Advanced 4.0", sessionsPlayed: 11, wins: 7, points: 1180, change: 0 },
  { playerId: "emma-wilson", name: "Emma Wilson", avatar: null, level: "Intermediate 3.5", sessionsPlayed: 9, wins: 6, points: 1090, change: -1 },
  { playerId: "michael-lee", name: "Michael Lee", avatar: null, level: "Advanced 4.0", sessionsPlayed: 10, wins: 6, points: 980, change: 1 },
  { playerId: "james-davis", name: "James Davis", avatar: null, level: "Intermediate 3.5", sessionsPlayed: 9, wins: 5, points: 870, change: 2 },
  { playerId: "sophie-turner", name: "Sophie Turner", avatar: null, level: "Intermediate 3.0", sessionsPlayed: 8, wins: 5, points: 840, change: -1 },
  { playerId: "daniel-park", name: "Daniel Park", avatar: null, level: "Advanced 4.0", sessionsPlayed: 8, wins: 4, points: 760, change: 0 },
  { playerId: "olivia-martin", name: "Olivia Martin", avatar: null, level: "Intermediate 3.0", sessionsPlayed: 8, wins: 4, points: 730, change: 1 },
];

const wednesdaySessionDates: [string, string][] = [
  ["2026-04-16", "6:30 PM"],
  ["2026-04-09", "6:30 PM"],
  ["2026-04-02", "6:30 PM"],
  ["2026-03-26", "6:30 PM"],
  ["2026-03-19", "6:30 PM"],
];
const wednesdayPlayerCounts = [24, 26, 24, 22, 25];

// --- Tuesday Competition (independent standings, per spec §18) ---
const tuesdayStandings: RankingPlayerRow[] = [
  { playerId: "kate-smith", name: "Kate Smith", avatar: null, level: "Advanced 4.0", sessionsPlayed: 12, wins: 9, points: 1340, change: 1 },
  { playerId: "alex-brown", name: "Alex Brown", avatar: null, level: "Advanced 4.5", sessionsPlayed: 11, wins: 8, points: 1210, change: -1 },
  { playerId: "sophie-turner", name: "Sophie Turner", avatar: null, level: "Intermediate 3.0", sessionsPlayed: 10, wins: 6, points: 1020, change: 0 },
  { playerId: "michael-lee", name: "Michael Lee", avatar: null, level: "Advanced 4.0", sessionsPlayed: 10, wins: 5, points: 940, change: 2 },
  { playerId: "olivia-martin", name: "Olivia Martin", avatar: null, level: "Intermediate 3.0", sessionsPlayed: 9, wins: 5, points: 860, change: 0 },
  { playerId: "james-davis", name: "James Davis", avatar: null, level: "Intermediate 3.5", sessionsPlayed: 9, wins: 4, points: 790, change: -1 },
];
const tuesdaySessionDates: [string, string][] = [
  ["2026-04-14", "6:00 PM"],
  ["2026-04-07", "6:00 PM"],
  ["2026-03-31", "6:00 PM"],
  ["2026-03-24", "6:00 PM"],
];
const tuesdayPlayerCounts = [26, 25, 24, 26];

// --- Thursday Competition (independent standings, per spec §18) ---
const thursdayStandings: RankingPlayerRow[] = [
  { playerId: "alex-brown", name: "Alex Brown", avatar: null, level: "Advanced 4.5", sessionsPlayed: 11, wins: 9, points: 1520, change: 0 },
  { playerId: "emma-wilson", name: "Emma Wilson", avatar: null, level: "Intermediate 3.5", sessionsPlayed: 11, wins: 8, points: 1390, change: 1 },
  { playerId: "daniel-park", name: "Daniel Park", avatar: null, level: "Advanced 4.0", sessionsPlayed: 10, wins: 6, points: 1150, change: -1 },
  { playerId: "james-davis", name: "James Davis", avatar: null, level: "Intermediate 3.5", sessionsPlayed: 9, wins: 5, points: 980, change: 0 },
  { playerId: "kate-smith", name: "Kate Smith", avatar: null, level: "Advanced 4.0", sessionsPlayed: 8, wins: 4, points: 860, change: 2 },
];
const thursdaySessionDates: [string, string][] = [
  ["2026-04-17", "7:00 PM"],
  ["2026-04-10", "7:00 PM"],
  ["2026-04-03", "7:00 PM"],
];
const thursdayPlayerCounts = [22, 24, 23];

export const mockRankingSeasons: RankingSeason[] = [
  {
    id: "spring-2026",
    name: "Spring 2026",
    status: "Active",
    period: "1 Mar 2026 – 31 May 2026",
    series: [
      {
        id: "wednesday-competition",
        name: "Wednesday Competition",
        format: "Social Tennis",
        pointsSystemLabel: "Social Tennis",
        description: "Weekly Wednesday competition.",
        standings: wednesdayStandings,
        sessions: buildSessions("wed", wednesdaySessionDates, wednesdayStandings, wednesdayPlayerCounts),
      },
      {
        id: "tuesday-competition",
        name: "Tuesday Competition",
        format: "Social Tennis",
        pointsSystemLabel: "Social Tennis",
        description: "Weekly Tuesday competition.",
        standings: tuesdayStandings,
        sessions: buildSessions("tue", tuesdaySessionDates, tuesdayStandings, tuesdayPlayerCounts),
      },
      {
        id: "thursday-competition",
        name: "Thursday Competition",
        format: "Social Tennis",
        pointsSystemLabel: "Social Tennis",
        description: "Weekly Thursday competition.",
        standings: thursdayStandings,
        sessions: buildSessions("thu", thursdaySessionDates, thursdayStandings, thursdayPlayerCounts),
      },
    ],
  },
  {
    id: "winter-2025",
    name: "Winter 2025",
    status: "Completed",
    period: "1 Jun 2025 – 31 Aug 2025",
    series: [
      {
        id: "wednesday-competition-w25",
        name: "Wednesday Competition",
        format: "Social Tennis",
        pointsSystemLabel: "Social Tennis",
        standings: wednesdayStandings.map((p) => ({ ...p, points: Math.round(p.points * 0.8), change: 0 })),
        sessions: buildSessions("wed-w25", [["2025-08-27", "6:30 PM"], ["2025-08-20", "6:30 PM"]], wednesdayStandings, [23, 24]),
      },
    ],
  },
];

export const mockChampionships: ChampionshipResult[] = [
  {
    id: "club-championship-2026",
    name: "Club Championship 2026",
    status: "Completed",
    players: 32,
    podium: [
      { playerId: "alex-brown", name: "Alex Brown", avatar: null },
      { playerId: "emma-wilson", name: "Emma Wilson", avatar: null },
      { playerId: "kate-smith", name: "Kate Smith", avatar: null },
    ],
  },
];

// A few of the player's most recent sessions in this series, for the
// Player Ranking Details panel (spec §17). Deliberately framed as
// "recent form", not a reconciled sum of the season total - same as the
// spec's own worked example, which lists 4 sessions whose points don't
// add up to the player's season total either.
export function getRecentFormForPlayer(series: RankingSeries, playerId: string) {
  const positions = ["1st", "2nd", "3rd", "4th", "5th"];
  const relevantSessions = series.sessions.slice(0, 4);
  return relevantSessions.map((session, i) => {
    const row = session.results.find((r) => r.playerId === playerId);
    return {
      date: `${session.dayLabel} ${session.monthLabel}`,
      result: row ? positions[session.results.findIndex((r) => r.playerId === playerId)] ?? "—" : "—",
      points: row?.sessionPoints ?? 0,
    };
  });
}
