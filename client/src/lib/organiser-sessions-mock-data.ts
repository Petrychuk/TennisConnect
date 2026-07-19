import type { SessionStatus } from "./organiser-hub-mock-data";

export type CourtState = "ready" | "playing" | "pending";

export interface CourtStatus {
  id: string;
  label: string;
  state: CourtState;
}

export interface SessionListItem {
  id: string;
  title: string;
  type: "social" | "round-robin" | "clinic" | "tournament";
  status: SessionStatus;
  location: string;
  startAt: string; // ISO
  endAt?: string; // ISO — for the "6:30 PM - 8:30 PM" range display
  registeredCount: number;
  checkedInCount: number;
  waitingCount: number;
  maxParticipants: number | null;
  progressPercent: number; // for the thin bar under each card
  progressLabel: string; // e.g. "Ends in 1h 13m", "Registration closes in 21h 45m", "Starts in 3 days"
  roundCurrent?: number;
  roundTotal?: number;
  roundEndsAt?: string; // ISO - only meaningful while status is "live"
  courts?: CourtStatus[]; // only meaningful while status is "live"
  resultsPublished?: boolean;
  // Explicit flag rather than inferring from status/text - a "published"
  // session might be full or registration might be closed even though
  // it's still upcoming, so this needs to be its own signal.
  registrationOpen?: boolean;
  checkInOpen?: boolean;
  format?: string; // "Fun doubles · Random partners · Balance skill"
  roundsDescription?: string; // "5 rounds · Best of 4 games (no-ad)"
  waitingListEnabled?: boolean;
  costPerPlayer?: number | null;
  organizerName?: string;
  createdAt?: string; // ISO
  notes?: string | null;
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const mockSessionsList: SessionListItem[] = [
  // Live
  {
    id: "live-1",
    title: "Wednesday Social Tennis",
    type: "social",
    status: "live",
    location: "Lyne Park Tennis Centre",
    startAt: hoursFromNow(-1.5),
    endAt: hoursFromNow(0.72),
    registeredCount: 24,
    checkedInCount: 21,
    waitingCount: 3,
    maxParticipants: 24,
    progressPercent: 40,
    progressLabel: "Ends in 1h 13m",
    roundCurrent: 2,
    roundTotal: 5,
    roundEndsAt: hoursFromNow(1.22),
    registrationOpen: true,
    checkInOpen: true,
    format: "Fun doubles · Random partners · Balance skill",
    roundsDescription: "5 rounds · Best of 4 games (no-ad)",
    waitingListEnabled: true,
    costPerPlayer: 15,
    organizerName: "Henry Coach",
    createdAt: daysAgo(12),
    notes: null,
    courts: [
      { id: "court-1", label: "Court 1", state: "ready" },
      { id: "court-2", label: "Court 2", state: "playing" },
      { id: "court-3", label: "Court 3", state: "playing" },
      { id: "court-4", label: "Court 4", state: "pending" },
      { id: "court-5", label: "Court 5", state: "ready" },
      { id: "court-6", label: "Court 6", state: "playing" },
    ],
  },

  // Registration open
  {
    id: "reg-1",
    title: "Friday Ladies Social",
    type: "social",
    status: "published",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(6),
    registeredCount: 18,
    checkedInCount: 0,
    waitingCount: 2,
    maxParticipants: 24,
    progressPercent: 75,
    progressLabel: "Registration closes in 21h 45m",
    registrationOpen: true,
  },
  {
    id: "reg-2",
    title: "Thursday Cardio Tennis",
    type: "clinic",
    status: "published",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(5),
    registeredCount: 8,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 12,
    progressPercent: 55,
    progressLabel: "Registration closes in 2 days",
    registrationOpen: true,
  },

  // Upcoming
  {
    id: "up-1",
    title: "Sunday Americano",
    type: "round-robin",
    status: "published",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(8),
    registeredCount: 24,
    checkedInCount: 0,
    waitingCount: 6,
    maxParticipants: 32,
    progressPercent: 20,
    progressLabel: "Starts in 3 days",
  },
  {
    id: "up-2",
    title: "Tuesday Morning Social",
    type: "social",
    status: "pending_review",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(10),
    registeredCount: 12,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 16,
    progressPercent: 10,
    progressLabel: "Awaiting admin approval",
  },
  {
    id: "up-3",
    title: "Saturday Junior Clinic",
    type: "clinic",
    status: "published",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(12),
    registeredCount: 6,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 10,
    progressPercent: 10,
    progressLabel: "Starts in 12 days",
  },
  {
    id: "up-4",
    title: "Monthly Mixed Doubles",
    type: "round-robin",
    status: "published",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(15),
    registeredCount: 14,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 24,
    progressPercent: 5,
    progressLabel: "Starts in 15 days",
  },

  // Draft
  {
    id: "draft-1",
    title: "Winter Club Championship",
    type: "tournament",
    status: "draft",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(20),
    registeredCount: 0,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 64,
    progressPercent: 0,
    progressLabel: "Not published",
  },
  {
    id: "draft-2",
    title: "Spring Round Robin",
    type: "round-robin",
    status: "draft",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(25),
    registeredCount: 0,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 24,
    progressPercent: 0,
    progressLabel: "Not published",
  },
  {
    id: "draft-3",
    title: "Kids Holiday Camp",
    type: "clinic",
    status: "draft",
    location: "Lyne Park Tennis Centre",
    startAt: daysFromNow(30),
    registeredCount: 0,
    checkedInCount: 0,
    waitingCount: 0,
    maxParticipants: 20,
    progressPercent: 0,
    progressLabel: "Not published",
  },

  // Completed
  {
    id: "done-1",
    title: "Monday Social Tennis",
    type: "social",
    status: "completed",
    location: "Lyne Park Tennis Centre",
    startAt: daysAgo(2),
    registeredCount: 26,
    checkedInCount: 25,
    waitingCount: 0,
    maxParticipants: 26,
    progressPercent: 100,
    progressLabel: "Completed",
    resultsPublished: true,
  },
  {
    id: "done-2",
    title: "Weekend Americano",
    type: "round-robin",
    status: "completed",
    location: "Lyne Park Tennis Centre",
    startAt: daysAgo(6),
    registeredCount: 32,
    checkedInCount: 30,
    waitingCount: 0,
    maxParticipants: 32,
    progressPercent: 100,
    progressLabel: "Completed",
    resultsPublished: true,
  },
  {
    id: "done-3",
    title: "Beginner Clinic",
    type: "clinic",
    status: "completed",
    location: "Lyne Park Tennis Centre",
    startAt: daysAgo(9),
    registeredCount: 10,
    checkedInCount: 9,
    waitingCount: 0,
    maxParticipants: 10,
    progressPercent: 100,
    progressLabel: "Completed",
    resultsPublished: false,
  },
  {
    id: "done-4",
    title: "Ladies Social",
    type: "social",
    status: "completed",
    location: "Lyne Park Tennis Centre",
    startAt: daysAgo(13),
    registeredCount: 20,
    checkedInCount: 18,
    waitingCount: 0,
    maxParticipants: 24,
    progressPercent: 100,
    progressLabel: "Completed",
    resultsPublished: true,
  },

  // Archived
  {
    id: "arch-1",
    title: "Autumn Club Championship 2026",
    type: "tournament",
    status: "archived",
    location: "Lyne Park Tennis Centre",
    startAt: daysAgo(120),
    registeredCount: 48,
    checkedInCount: 46,
    waitingCount: 0,
    maxParticipants: 48,
    progressPercent: 100,
    progressLabel: "Archived",
    resultsPublished: true,
  },
  {
    id: "arch-2",
    title: "Summer Social Series — Week 8",
    type: "social",
    status: "archived",
    location: "Lyne Park Tennis Centre",
    startAt: daysAgo(150),
    registeredCount: 22,
    checkedInCount: 20,
    waitingCount: 0,
    maxParticipants: 24,
    progressPercent: 100,
    progressLabel: "Archived",
    resultsPublished: true,
  },
  {
    id: "arch-3",
    title: "Winter Americano 2025",
    type: "round-robin",
    status: "archived",
    location: "Lyne Park Tennis Centre",
    startAt: daysAgo(210),
    registeredCount: 30,
    checkedInCount: 28,
    waitingCount: 0,
    maxParticipants: 32,
    progressPercent: 100,
    progressLabel: "Archived",
    resultsPublished: true,
  },
];

// Not every mock session has the full workspace-detail fields filled in
// (only the flagship "live-1" example matches the approved mockup
// exactly) — this fills in sensible defaults for the rest so every
// session in the list still has a working Workspace page.
export function getSessionDetail(session: SessionListItem): Required<
  Pick<
    SessionListItem,
    | "endAt"
    | "checkInOpen"
    | "format"
    | "roundsDescription"
    | "waitingListEnabled"
    | "costPerPlayer"
    | "organizerName"
    | "createdAt"
    | "notes"
  >
> {
  const start = new Date(session.startAt);
  return {
    endAt: session.endAt ?? new Date(start.getTime() + 90 * 60 * 1000).toISOString(),
    checkInOpen: session.checkInOpen ?? (session.status === "live" || session.status === "completed"),
    format: session.format ?? "Fun doubles · Random partners · Balance skill",
    roundsDescription:
      session.roundsDescription ??
      (session.roundTotal ? `${session.roundTotal} rounds · Best of 4 games (no-ad)` : "Not set yet"),
    waitingListEnabled: session.waitingListEnabled ?? true,
    costPerPlayer: session.costPerPlayer ?? 15,
    organizerName: session.organizerName ?? "Henry Coach",
    createdAt: session.createdAt ?? daysAgo(14),
    notes: session.notes ?? null,
  };
}

export interface SessionActivityItem {
  id: string;
  message: string;
  timestamp: string; // ISO
}

export const mockSessionActivity: SessionActivityItem[] = [
  { id: "sa-1", message: "Emma Wilson checked in", timestamp: hoursFromNow(-0.2) },
  { id: "sa-2", message: "Michael Lee checked in", timestamp: hoursFromNow(-0.25) },
  { id: "sa-3", message: "Kate Smith joined the session", timestamp: hoursFromNow(-2.5) },
  { id: "sa-4", message: "Alex Brown moved to waiting list", timestamp: hoursFromNow(-6) },
  { id: "sa-5", message: "You opened registration", timestamp: daysAgo(1) },
];

export interface SessionQuickStat {
  key: string;
  label: string;
  value: string;
  deltaLabel: string;
  deltaDirection: "up" | "down";
}

export const mockSessionQuickStats: SessionQuickStat[] = [
  { key: "avg-players", label: "Avg. Players", value: "22.4", deltaLabel: "8% vs last week", deltaDirection: "up" },
  { key: "attendance-rate", label: "Attendance Rate", value: "91%", deltaLabel: "5% vs last week", deltaDirection: "up" },
  { key: "avg-length", label: "Avg. Session Length", value: "2h 18m", deltaLabel: "6% vs last week", deltaDirection: "up" },
  { key: "satisfaction", label: "Player Satisfaction", value: "4.7", deltaLabel: "0.3 vs last week", deltaDirection: "up" },
];

export interface SessionTopPlayer {
  id: string;
  name: string;
  avatar: string | null;
}

export const mockSessionTopPlayers: SessionTopPlayer[] = [
  { id: "p-1", name: "Alex Brown", avatar: null },
  { id: "p-2", name: "Kate Smith", avatar: null },
  { id: "p-3", name: "Emma Wilson", avatar: null },
  { id: "p-4", name: "Michael Lee", avatar: null },
];
export const mockSessionTopPlayersExtra = 5; // "+5" beyond the avatars shown

export interface SessionPlayer {
  id: string;
  name: string;
  avatar: string | null;
  status: "registered" | "waiting" | "cancelled" | "invited" | "checked-in";
}

export const mockSessionPlayers: SessionPlayer[] = [
  { id: "p-1", name: "Emma Wilson", avatar: null, status: "checked-in" },
  { id: "p-2", name: "Michael Lee", avatar: null, status: "checked-in" },
  { id: "p-3", name: "Kate Smith", avatar: null, status: "registered" },
  { id: "p-4", name: "Alex Brown", avatar: null, status: "waiting" },
  { id: "p-5", name: "Priya Nair", avatar: null, status: "registered" },
  { id: "p-6", name: "Liam Chen", avatar: null, status: "invited" },
  { id: "p-7", name: "Sophie Turner", avatar: null, status: "cancelled" },
];
