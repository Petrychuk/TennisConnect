// Pure rules behind the Organiser Hub dashboard's figures and states, kept out
// of the component so each one is unit-tested (organiserDashboard.test.ts).
//
// Three kinds of "no number" used to look alike and are now distinct:
//   loading  -> tile shows a skeleton
//   empty    -> a real zero ("0"), or "—" when a percentage can't be worked out
//   failed   -> "—" plus a compact inline warning with Try again, and ONLY then
// Each data source (sessions, player stats, activity) is judged on its own, so
// one failing request never blanks the figures that did load.

export type SourceStatus = "loading" | "error" | "ready";

export const UNAVAILABLE = "—";

/** What a react-query result tells us, reduced to the three states above. */
export function sourceStatus(q: { isError: boolean; isSuccess?: boolean; data?: unknown }): SourceStatus {
  if (q.isError && q.data === undefined) return "error"; // a failed refetch keeps showing the data it already had
  if (q.data !== undefined) return "ready";
  return "loading";
}

export interface DashboardSession {
  status: string;
  startAt: string | Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function countLive(sessions: readonly DashboardSession[]): number {
  return sessions.filter((s) => s.status === "live").length;
}

/** Published sessions starting from now through the next 7 days. */
export function countUpcoming7Days(sessions: readonly DashboardSession[], now = Date.now()): number {
  return sessions.filter((s) => {
    const start = new Date(s.startAt).getTime();
    return s.status === "published" && start >= now && start <= now + 7 * DAY_MS;
  }).length;
}

/** 0-100, or null when there is nothing to divide (no registrations yet, or the server couldn't work it out). */
export function normaliseAttendance(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function formatAttendance(value: number | null | undefined): string {
  const pct = normaliseAttendance(value);
  return pct === null ? UNAVAILABLE : `${pct}%`;
}

/** A count tile: skeleton (null) while loading, "—" if its request failed, else the number - 0 included. */
export function countTileValue(status: SourceStatus, count: number | null | undefined): string | null {
  if (status === "loading") return null;
  if (status === "error") return UNAVAILABLE;
  return String(typeof count === "number" && Number.isFinite(count) ? count : 0);
}

export function attendanceTileValue(status: SourceStatus, percent: number | null | undefined): string | null {
  if (status === "loading") return null;
  if (status === "error") return UNAVAILABLE;
  return formatAttendance(percent);
}

/** A new organiser: the sessions request succeeded and they have created nothing yet. */
export function isNewOrganiser(status: SourceStatus, sessions: readonly unknown[] | undefined): boolean {
  return status === "ready" && (sessions?.length ?? 0) === 0;
}

export type DashboardSourceKey = "sessions" | "stats" | "activity";

const FAILURE_LABEL: Record<DashboardSourceKey, string> = {
  sessions: "sessions",
  stats: "player statistics",
  activity: "recent activity",
};

/** Sources whose request actually failed, in display order. Loading and empty are never failures. */
export function failedSources(statuses: Record<DashboardSourceKey, SourceStatus>): DashboardSourceKey[] {
  return (["sessions", "stats", "activity"] as const).filter((k) => statuses[k] === "error");
}

/** "We couldn't load your sessions and recent activity." - names only what failed. */
export function failureMessage(failed: readonly DashboardSourceKey[]): string {
  if (failed.length === 0) return "";
  const names = failed.map((k) => FAILURE_LABEL[k]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `We couldn't load your ${list}.`;
}
