export interface OrgPlayer {
  id: string;
  slug: string;
  name: string;
  avatar: string | null;
  level: number;
  levelLabel: "Advanced" | "Intermediate" | "Social" | "Beginner";
  sessionsPlayed: number;
  lastPlayed: string; // ISO
  status: "active" | "inactive";
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const mockOrgPlayers: OrgPlayer[] = [
  { id: "op-1", slug: "emma-wilson", name: "Emma Wilson", avatar: null, level: 4.5, levelLabel: "Advanced", sessionsPlayed: 24, lastPlayed: daysAgo(3), status: "active" },
  { id: "op-2", slug: "kate-smith", name: "Kate Smith", avatar: null, level: 4.0, levelLabel: "Intermediate", sessionsPlayed: 18, lastPlayed: daysAgo(3), status: "active" },
  { id: "op-3", slug: "michael-lee", name: "Michael Lee", avatar: null, level: 4.0, levelLabel: "Intermediate", sessionsPlayed: 20, lastPlayed: daysAgo(7), status: "active" },
  { id: "op-4", slug: "alex-brown", name: "Alex Brown", avatar: null, level: 3.5, levelLabel: "Intermediate", sessionsPlayed: 16, lastPlayed: daysAgo(3), status: "active" },
  { id: "op-5", slug: "james-davis", name: "James Davis", avatar: null, level: 3.5, levelLabel: "Intermediate", sessionsPlayed: 14, lastPlayed: daysAgo(5), status: "active" },
  { id: "op-6", slug: "sophie-carter", name: "Sophie Carter", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 12, lastPlayed: daysAgo(8), status: "active" },
  { id: "op-7", slug: "olena-boncheva", name: "Olena Boncheva", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 10, lastPlayed: daysAgo(9), status: "active" },
  { id: "op-8", slug: "katerina-leon", name: "Katerina Leon", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 9, lastPlayed: daysAgo(10), status: "active" },
  { id: "op-9", slug: "tom-anderson", name: "Tom Anderson", avatar: null, level: 3.0, levelLabel: "Social", sessionsPlayed: 8, lastPlayed: daysAgo(11), status: "inactive" },
  { id: "op-10", slug: "liam-johnson", name: "Liam Johnson", avatar: null, level: 2.5, levelLabel: "Beginner", sessionsPlayed: 6, lastPlayed: daysAgo(16), status: "inactive" },
];

// This whole file is unused by the real Players page now (players.tsx
// computes its own real summary/filters directly from real data) -
// kept only in case some other still-mock-driven surface imports it;
// not deleted outright without confirming nothing else does.
export const mockOrgPlayersSummary = {
  totalPlayers: 128,
  activeThisSeason: 42,
  returningPlayers: 97,
};

export const mockTopPlayersBySessions = mockOrgPlayers
  .slice()
  .sort((a, b) => b.sessionsPlayed - a.sessionsPlayed)
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
