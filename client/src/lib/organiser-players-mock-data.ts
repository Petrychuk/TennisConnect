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
