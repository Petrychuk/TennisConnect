// Mock data for the Organiser Hub dashboard (feature/organiser-hub-dashboard).
// Every type here is written to match what the real API will eventually
// return (see server/routes/organizer.ts), so swapping mock-data.ts for a
// fetch later is a data-source change, not a component rewrite.

export interface OrganiserProfile {
  name: string;
  organizationName: string;
  organizationSlug: string;
  avatar: string | null;
  memberSince: string; // e.g. "May 2026"
}

export type SessionStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "cancelled"
  | "live"
  | "completed";

export interface MockSession {
  id: string;
  title: string;
  type: "social" | "round-robin" | "clinic" | "tournament";
  status: SessionStatus;
  location: string;
  startAt: string; // ISO
  registeredCount: number;
  maxParticipants: number | null;
}

export interface ActivityItem {
  id: string;
  kind: "registration" | "approval" | "rejection" | "cancellation" | "waitlist";
  message: string;
  timestamp: string; // ISO
}

export const mockOrganiser: OrganiserProfile = {
  name: "Nataliia Organizator",
  organizationName: "Bondi Social Tennis",
  organizationSlug: "bondi-social-tennis",
  avatar: null,
  memberSince: "May 2026",
};

export const mockLiveToday: MockSession[] = [
  {
    id: "live-1",
    title: "Thursday Night Social Hit",
    type: "social",
    status: "live",
    location: "Rushcutters Bay Tennis Courts",
    startAt: new Date(new Date().setHours(18, 30, 0, 0)).toISOString(),
    registeredCount: 14,
    maxParticipants: 16,
  },
];

export const mockUpcomingSessions: MockSession[] = [
  {
    id: "upcoming-1",
    title: "Weekend Round Robin",
    type: "round-robin",
    status: "published",
    location: "Bondi Beach Courts",
    startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    registeredCount: 10,
    maxParticipants: 12,
  },
  {
    id: "upcoming-2",
    title: "Beginner Clinic — Serves & Volleys",
    type: "clinic",
    status: "pending_review",
    location: "Centennial Park Courts",
    startAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    registeredCount: 6,
    maxParticipants: 10,
  },
  {
    id: "upcoming-3",
    title: "Autumn Club Championship — Round 1",
    type: "tournament",
    status: "draft",
    location: "Waverley Park",
    startAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    registeredCount: 0,
    maxParticipants: 32,
  },
  {
    id: "upcoming-4",
    title: "Sunday Social Doubles",
    type: "social",
    status: "published",
    location: "Rushcutters Bay Tennis Courts",
    startAt: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
    registeredCount: 8,
    maxParticipants: 16,
  },
];

// "This season" is a placeholder cadence (e.g. a calendar quarter) — the
// real backend concept this maps to hasn't been decided yet.
export const mockSeasonProgress = {
  seasonLabel: "Winter Season 2026",
  sessionsRun: 18,
  sessionsGoal: 25,
  playersEngaged: 96,
  daysRemaining: 34,
};

export const mockStatistics = {
  totalSessions: 42,
  totalParticipants: 318,
  averageAttendanceRate: 87, // percent
  averageRating: 4.8,
};

export const mockActivity: ActivityItem[] = [
  {
    id: "act-1",
    kind: "registration",
    message: "Marcus Webb joined Weekend Round Robin",
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: "act-2",
    kind: "waitlist",
    message: "Priya Nair was added to the waiting list for Thursday Night Social Hit",
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    id: "act-3",
    kind: "approval",
    message: "Sunday Social Doubles was approved by an admin",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "act-4",
    kind: "cancellation",
    message: "Liam Chen cancelled their spot in Beginner Clinic",
    timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "act-5",
    kind: "rejection",
    message: "Autumn Club Championship — Round 1 needs changes before it can go live",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
