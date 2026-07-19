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
    registeredCount: 24,
    checkedInCount: 21,
    waitingCount: 5,
    maxParticipants: 24,
    progressPercent: 40,
    progressLabel: "Ends in 1h 13m",
    roundCurrent: 2,
    roundTotal: 5,
    roundEndsAt: hoursFromNow(1.22),
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
