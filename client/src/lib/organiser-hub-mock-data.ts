// Organiser Hub dashboard types. The mock VALUES that used to live here
// (mockOrganiser "Henry / Lyne Park Tennis", mockStatStrip "1 / 3 / 87 /
// 91%", sample sessions, leaderboard, activity) were removed in Phase 2:
// the dashboard showed them while loading or after an error. Only the
// shapes remain; the file name is kept so existing type imports work.

export type { OrganiserUser } from "./organiser-types";

export type SessionStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "cancelled"
  | "live"
  | "completed"
  | "archived";

export interface MockSession {
  id: string;
  title: string;
  type: "social" | "round-robin" | "clinic" | "tournament";
  status: SessionStatus;
  location: string;
  // IANA zone the venue is in - see client/src/lib/timezone.ts
  // formatInTimeZone. startAt should always be shown in this zone, not
  // the viewer's own browser timezone.
  timeZone: string;
  coverImage?: string | null;
  startAt: string; // ISO
  registeredCount: number;
  checkedInCount: number;
  waitingCount: number;
  maxParticipants: number | null;
  round?: string; // e.g. "Round 2" - only meaningful once TC Live exists
}

export interface StatStripItem {
  key: string;
  label: string;
  sublabel: string;
  /** null = still loading (skeleton); "—" = the request failed. */
  value: string | null;
  // Where this card navigates on click - omitted when there's genuinely
  // nowhere real to send the organiser yet (e.g. Attendance, until a
  // Reports page exists) rather than linking to a page that doesn't
  // exist.
  href?: string;
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
  // Both optional - a real week-over-week comparison needs two periods
  // of data, and it's better to show a plain, honest current-period
  // number with no trend than to fabricate a delta that isn't backed
  // by anything.
  deltaLabel?: string;
  deltaDirection?: "up" | "down";
}
