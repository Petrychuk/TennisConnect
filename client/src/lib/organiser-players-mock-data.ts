export interface OrgPlayer {
  id: string;
  name: string;
  avatar: string | null;
  level: number;
  levelLabel: "Advanced" | "Intermediate" | "Social" | "Beginner";
  sessionsPlayed: number;
  winRate: number; // percent
  lastPlayed: string; // ISO
  status: "active" | "inactive";
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const mockOrgPlayers: OrgPlayer[] = [
  { id: "op-1", name: "Emma Wilson", avatar: null, level: 4.5, levelLabel: "Advanced", sessionsPlayed: 24, winRate: 67, lastPlayed: daysAgo(3), status: "active" },
  { id: "op-2", name: "Kate Smith", avatar: null, level: 4.0, levelLabel: "Intermediate", sessionsPlayed: 18, winRate: 61, lastPlayed: daysAgo(3), status: "active" },
  { id: "op-3", name: "Michael Lee", avatar: null, level: 4.0, levelLabel: "Intermediate", sessionsPlayed: 20, winRate: 58, lastPlayed: daysAgo(7), status: "active" },
  { id: "op-4", name: "Alex Brown", avatar: null, level: 3.5, levelLabel: "Intermediate", sessionsPlayed: 16, winRate: 55, lastPlayed: daysAgo(3), status: "active" },
  { id: "op-5", name: "James Davis", avatar: null, level: 3.5, levelLabel: "Intermediate", sessionsPlayed: 14, winRate: 53, lastPlayed: daysAgo(5), status: "active" },
  { id: "op-6", name: "Sophie Carter", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 12, winRate: 50, lastPlayed: daysAgo(8), status: "active" },
  { id: "op-7", name: "Olena Boncheva", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 10, winRate: 48, lastPlayed: daysAgo(9), status: "active" },
  { id: "op-8", name: "Katerina Leon", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 9, winRate: 46, lastPlayed: daysAgo(10), status: "active" },
  { id: "op-9", name: "Tom Anderson", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 8, winRate: 45, lastPlayed: daysAgo(11), status: "inactive" },
  { id: "op-10", name: "Liam Johnson", avatar: null, level: 2.5, levelLabel: "Beginner", sessionsPlayed: 6, winRate: 44, lastPlayed: daysAgo(16), status: "inactive" },
];

// The mockup's headline numbers (128 total, 42 active, etc.) describe a
// larger org than the 10 sample rows above represent — kept as its own
// object rather than derived from mockOrgPlayers.length, same pattern as
// the Sessions list page's "Completed (52)" style counts.
export const mockOrgPlayersSummary = {
  totalPlayers: 128,
  totalPlayersDelta: "12 this month",
  activeThisSeason: 42,
  activeThisSeasonDelta: "8 this month",
  newThisMonth: 18,
  newThisMonthDelta: "5 this month",
  returnRate: 76,
  returnRateDelta: "6% vs last season",
  avgRating: 4.3,
  avgRatingDelta: "6% vs last month",
};

export const mockTopPlayersBySessions = mockOrgPlayers
  .slice()
  .sort((a, b) => b.sessionsPlayed - a.sessionsPlayed)
  .slice(0, 5);

export const mockTopPlayersByWinRate = mockOrgPlayers
  .slice()
  .sort((a, b) => b.winRate - a.winRate)
  .slice(0, 5);

export interface RecentNewPlayer {
  id: string;
  name: string;
  avatar: string | null;
  joinedAt: string; // ISO
}

export const mockRecentNewPlayers: RecentNewPlayer[] = [
  { id: "rn-1", name: "Daniel Price", avatar: null, joinedAt: daysAgo(3) },
  { id: "rn-2", name: "Olivia Green", avatar: null, joinedAt: daysAgo(5) },
  { id: "rn-3", name: "Marcus Hill", avatar: null, joinedAt: daysAgo(6) },
  { id: "rn-4", name: "Chloe Martin", avatar: null, joinedAt: daysAgo(8) },
  { id: "rn-5", name: "Jack Thompson", avatar: null, joinedAt: daysAgo(9) },
];
