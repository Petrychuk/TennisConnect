import type { SessionStatus } from "./organiser-hub-mock-data";
import type { SessionTypeKey } from "./organiser-session-wizard-types";

export type CourtState = "ready" | "playing" | "pending";

export interface CourtStatus {
  id: string;
  label: string;
  state: CourtState;
}

export interface ReadinessItem {
  id: string;
  label: string;
  status: "ready" | "warning" | "issue";
}

export interface SessionReadiness {
  percent: number;
  items: ReadinessItem[];
}

export interface SessionListItem {
  id: string;
  title: string;
  type: SessionTypeKey | "clinic";
  status: SessionStatus;
  location: string;
  // IANA zone the venue is in (e.g. "Australia/Sydney") - startAt/endAt
  // below should always be displayed in THIS zone, not the viewer's own
  // browser timezone (a session's advertised time belongs to the venue -
  // see client/src/lib/timezone.ts formatInTimeZone).
  timeZone: string;
  startAt: string; // ISO
  endAt?: string; // ISO — for the "6:30 PM - 8:30 PM" range display
  registeredCount: number;
  checkedInCount: number;
  waitingCount: number;
  maxParticipants: number | null;
  // Real value from sessions.courts_count - unlike `courts` below (only
  // meaningful while status is "live"), this is set whenever the
  // organizer configures it and never goes away once the session ends.
  courtsCount: number | null;
  // Real match-format fields (sessions.match_mode/category/games_to/
  // no_ad/tiebreak/planned_rounds_count) - set by the wizard's Step 3,
  // null for sessions created before these columns existed.
  matchMode: "singles" | "doubles" | null;
  category: "open" | "mens" | "womens" | "mixed" | null;
  gamesTo: number | null;
  noAd: boolean | null;
  tiebreak: boolean | null;
  plannedRoundsCount: number | null;
  /** TC Live v1: an internal test session (server-set) - Live may run for it in TC_LIVE_ENABLED=internal. */
  isInternalTest?: boolean;
  /** sessions.visibility ("public" | "members" | "invite") - set by toSessionListItem. */
  visibility?: string | null;
  /** Rules & policies (shared/sessionPolicies.ts) - set by toSessionListItem. */
  policies?: import("@shared/sessionPolicies").SessionPolicies;
  progressPercent: number; // for the thin bar under each card
  progressLabel: string; // e.g. "Ends in 1h 13m", "Registration closes in 21h 45m", "Starts in 3 days"
  roundCurrent?: number;
  roundTotal?: number;
  roundEndsAt?: string; // ISO - only meaningful while status is "live"
  courts?: CourtStatus[]; // only meaningful while status is "live"
  coverImage?: string; // data URL - user-uploaded cover photo, falls back to the stock court photo when absent
  resultsPublished?: boolean;
  // Explicit flag rather than inferring from status/text - a "published"
  // session might be full or registration might be closed even though
  // it's still upcoming, so this needs to be its own signal.
  registrationOpen?: boolean;
  registrationClosesAt?: string; // ISO
  checkInOpen?: boolean;
  reviewNote?: string; // set by an admin on rejection
  cancellationPolicy?: string;
  format?: string; // "Fun doubles · Random partners · Balance skill"
  roundsDescription?: string; // "5 rounds · Best of 4 games (no-ad)"
  waitingListEnabled?: boolean;
  // Real value (sessions.waiting_list_capacity) - null/undefined means
  // unlimited, previously session-details-card.tsx always showed the
  // same hardcoded "(10 spots)" regardless of what was actually set
  // (there was nowhere real to store it).
  waitingListCapacity?: number | null;
  parentSessionId?: string | null; // set when this session is a division of a container session
  costPerPlayer?: number | null;
  organizerName?: string;
  organizationSlug?: string;
  organizerSlug?: string;
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

// Not every mock session has the full workspace-detail fields filled in
// (only the flagship "live-1" example matches the approved mockup
// exactly) — this fills in sensible defaults for the rest so every
// session in the list still has a working Workspace page.
/**
 * Display values for the Session Workspace, from the real session only
 * (Phase 2). It used to fill gaps with mock values - $15, "Henry Coach",
 * "created 14 days ago", a made-up format and cancellation policy, an end
 * time of start + 90 min - so a session showed details nobody entered.
 * Unknown now stays unknown (null / "—").
 */
export function getSessionDetail(session: SessionListItem) {
  return {
    endAt: session.endAt ?? null,
    // Not a stored setting: check-in is open while the session is running.
    checkInOpen: session.checkInOpen ?? (session.status === "live" || session.status === "completed"),
    waitingListEnabled: !!session.waitingListEnabled,
    costPerPlayer: session.costPerPlayer ?? 0,
    organizerName: session.organizerName ?? "—",
    createdAt: session.createdAt ?? null,
    notes: session.notes ?? null,
  };
}

export interface SessionActivityItem {
  id: string;
  kind: "players" | "system" | "live";
  message: string;
  timestamp: string; // ISO
}

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
  level: number;
  levelLabel: "Advanced" | "Intermediate" | "Beginner" | "Social";
  group: "A" | "B" | "C" | null;
  status: "registered" | "waiting" | "cancelled" | "invited" | "no-response";
  checkedIn: boolean;
  checkInTime: string | null; // ISO
  joinedAt: string; // ISO
  paymentStatus?: "paid" | "pending" | "guest";
  rating?: number;
  // True for a real registration pulled from the database, as opposed
  // to the mock "crowd" data used to preview what a fuller session
  // looks like without needing dozens of real test accounts to join.
  isReal?: boolean;
  slug?: string; // real player's profile slug, when isReal
  userId?: string; // the registrant's user id - for messaging them
  role?: string; // real user's role ("player"/"coach"), when isReal - needed to build the right /player/ vs /coach/ profile link
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export interface WaitingPlayer {
  id: string;
  name: string;
  avatar: string | null;
  level: number;
  levelLabel: SessionPlayer["levelLabel"];
  joinedAt: string;
}

export interface GroupOverviewItem {
  key: "A" | "B" | "C";
  filled: number;
  capacity: number;
}
