// Mock data for the Organiser Hub dashboard. Every shape here mirrors what
// the real backend already returns (see server/routes/organizer.ts) or is
// clearly marked as a placeholder metric with no backend equivalent yet.

export interface OrganiserUser {
  name: string;
  role: string; // e.g. "Organiser"
  avatar: string | null;
  organizationName: string;
  organizationSlug: string;
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
  checkedInCount: number;
  waitingCount: number;
  maxParticipants: number | null;
  round?: string; // e.g. "Round 2" - only meaningful once TC Live exists
}

export type CourtState = "ready" | "playing" | "pending";

export interface CourtStatus {
  id: string;
  label: string; // "Court 1"
  state: CourtState;
}

// The live-session state that makes the dashboard feel like it's actually
// watching something happen, not just showing a static record. This is the
// shape TC Live will eventually replace/extend — kept as its own type so
// swapping the mock for a real subscription later doesn't touch the rest
// of LiveTodayCard.
export interface LiveSessionState {
  roundCurrent: number;
  roundTotal: number;
  roundEndsAt: string; // ISO — drives the "round ends in" countdown
  courts: CourtStatus[];
  // Placeholder for the eventual TC Live upgrade (connected player count
  // over a live socket). Undefined today; once it's real, LiveTodayCard
  // can switch its headline straight from "LIVE NOW" to "TC LIVE".
  connectedPlayers?: number;
}

export interface TodaysFocus {
  title: string;
  startAt: string; // ISO
  registeredCount: number;
  checkedInCount: number;
  weatherEmoji: string;
  weatherLabel: string;
  courtsReady: number;
  courtsTotal: number;
}

export interface AlertItem {
  id: string;
  message: string;
}

export interface AiRecommendation {
  id: string;
  message: string;
}

export interface StatStripItem {
  key: string;
  label: string;
  sublabel: string;
  value: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string | null;
  points: number;
}

export interface ActivityItem {
  id: string;
  kind: "registration" | "checkin" | "cancellation" | "join" | "message";
  message: string;
  timestamp: string; // ISO
}

export interface QuickStat {
  key: string;
  label: string;
  value: string;
  deltaLabel: string;
  deltaDirection: "up" | "down";
}

export const mockOrganiser: OrganiserUser = {
  name: "Henry",
  role: "Organiser",
  avatar: null,
  organizationName: "Lyne Park Tennis",
  organizationSlug: "lyne-park-tennis",
};

export const mockStatStrip: StatStripItem[] = [
  { key: "live", label: "Live Session", sublabel: "Today", value: "1" },
  { key: "upcoming", label: "Upcoming Sessions", sublabel: "Next 7 days", value: "3" },
  { key: "players", label: "Active Players", sublabel: "In your sessions", value: "87" },
  { key: "attendance", label: "Attendance", sublabel: "This season", value: "91%" },
  { key: "revenue", label: "Revenue", sublabel: "This week", value: "$540" },
];

export const mockLiveSession: MockSession = {
  id: "live-1",
  title: "Wednesday Social Tennis",
  type: "social",
  status: "live",
  location: "Lyne Park Tennis Centre",
  startAt: new Date(new Date().setHours(18, 30, 0, 0)).toISOString(),
  registeredCount: 24,
  checkedInCount: 21,
  waitingCount: 5,
  maxParticipants: 24,
  round: "Round Not Started",
};

export const mockLiveSessionState: LiveSessionState = {
  roundCurrent: 2,
  roundTotal: 5,
  roundEndsAt: new Date(Date.now() + 18 * 60 * 1000 + 24 * 1000).toISOString(),
  courts: [
    { id: "court-1", label: "Court 1", state: "ready" },
    { id: "court-2", label: "Court 2", state: "playing" },
    { id: "court-3", label: "Court 3", state: "playing" },
    { id: "court-4", label: "Court 4", state: "pending" },
    { id: "court-5", label: "Court 5", state: "ready" },
    { id: "court-6", label: "Court 6", state: "playing" },
  ],
};

export const mockTodaysFocus: TodaysFocus = {
  title: "Wednesday Social Tennis",
  startAt: mockLiveSession.startAt,
  registeredCount: 24,
  checkedInCount: 17,
  weatherEmoji: "☀️",
  weatherLabel: "23°C",
  courtsReady: 6,
  courtsTotal: 6,
};

export const mockAlerts: AlertItem[] = [
  { id: "alert-1", message: "4 players still haven't checked in." },
  { id: "alert-2", message: "Registration for Friday Ladies Social closes in 45 min." },
  { id: "alert-3", message: "Court 3 has no score logged for Round 1." },
  { id: "alert-4", message: "Waiting list for Sunday Americano has 5 players." },
];

export const mockAiRecommendations: AiRecommendation[] = [
  { id: "ai-1", message: "Registration for Sunday Americano is almost full — consider opening Court 7." },
  { id: "ai-2", message: "Emma Wilson hasn't attended in 3 weeks — worth a check-in message." },
  { id: "ai-3", message: "Kate Smith just reached Finals qualification for the season." },
  { id: "ai-4", message: "Attendance this week is 12% above your season average." },
];

function daysFromNowAt(days: number, hour: number, minute: number) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const mockSessions: MockSession[] = [
  {
    id: "upcoming-1",
    title: "Friday Ladies Social",
    type: "social",
    status: "published",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNowAt(2, 9, 30),
    registeredCount: 18,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 24,
  },
  {
    id: "upcoming-2",
    title: "Sunday Americano",
    type: "round-robin",
    status: "published",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNowAt(4, 16, 0),
    registeredCount: 24,
    checkedInCount: 0,
    waitingCount: 4,
    maxParticipants: 32,
  },
  {
    id: "upcoming-3",
    title: "Tuesday Morning Social",
    type: "social",
    status: "pending_review",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNowAt(6, 10, 0),
    registeredCount: 12,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 16,
  },
  {
    id: "draft-1",
    title: "Autumn Club Championship",
    type: "tournament",
    status: "draft",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNowAt(14, 9, 0),
    registeredCount: 0,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 32,
  },
  {
    id: "completed-1",
    title: "Monday Beginner Clinic",
    type: "clinic",
    status: "completed",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNowAt(-3, 18, 0),
    registeredCount: 10,
    checkedInCount: 9,
    waitingCount: 0,
    maxParticipants: 10,
  },
];

export const mockSeason = {
  label: "Winter 2027",
  weekLabel: "Week 4 of 12",
  progressPercent: Math.round((4 / 12) * 100),
};

export const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: "Alex Brown", avatar: null, points: 1250 },
  { rank: 2, name: "Kate Smith", avatar: null, points: 1180 },
  { rank: 3, name: "Emma Wilson", avatar: null, points: 1090 },
];

export const mockActivity: ActivityItem[] = [
  {
    id: "act-1",
    kind: "join",
    message: "Emma Wilson joined",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: "act-2",
    kind: "checkin",
    message: "Kate Smith checked in",
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: "act-3",
    kind: "cancellation",
    message: "Alex Brown cancelled Friday Social",
    timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: "act-4",
    kind: "join",
    message: "Michael Lee joined",
    timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  },
  {
    id: "act-5",
    kind: "message",
    message: "New message from Lyne Park Tennis",
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

// "Quick Analytics" — session-quality metrics with no backend field yet.
// Kept clearly separate from the real stats above so it's obvious which
// numbers need a schema decision before they can go live.
export const mockQuickAnalytics: QuickStat[] = [
  { key: "avg-players", label: "Avg. Players", value: "22.4", deltaLabel: "8% vs last week", deltaDirection: "up" },
  { key: "avg-length", label: "Avg. Session Length", value: "2h 18m", deltaLabel: "6% vs last week", deltaDirection: "up" },
  { key: "satisfaction", label: "Player Satisfaction", value: "4.7", deltaLabel: "0.3 vs last week", deltaDirection: "up" },
  { key: "attendance-rate", label: "Attendance Rate", value: "91%", deltaLabel: "5% vs last week", deltaDirection: "up" },
];

export const mockHighlight = {
  message: "Great job! Your attendance rate is one of the highest in your area.",
};
