import type { TennisSession, SessionWithDetails } from "@shared/schema";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

function isSessionWithDetails(s: TennisSession | SessionWithDetails): s is SessionWithDetails {
  return "registeredCount" in s;
}

function formatTimeUntil(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60000))}m`;
  if (hours < 24) return `${hours}h ${Math.floor((ms % (60 * 60 * 1000)) / 60000)}m`;
  return `${Math.floor(hours / 24)} days`;
}

function computeProgress(session: TennisSession | SessionWithDetails): { progressPercent: number; progressLabel: string } {
  const now = Date.now();
  const startAt = new Date(session.startAt);
  const endAt = session.endAt ? new Date(session.endAt) : null;

  if (session.status === "live" && endAt) {
    return { progressPercent: 50, progressLabel: `Ends in ${formatTimeUntil(endAt)}` };
  }
  if (session.status === "draft") {
    return { progressPercent: 0, progressLabel: "Not published" };
  }
  if (session.status === "pending_review") {
    return { progressPercent: 10, progressLabel: "Awaiting admin approval" };
  }
  if (session.status === "rejected") {
    return { progressPercent: 0, progressLabel: "Rejected" };
  }
  if (session.status === "cancelled") {
    return { progressPercent: 0, progressLabel: "Cancelled" };
  }
  if (session.status === "completed") {
    return { progressPercent: 100, progressLabel: "Completed" };
  }
  if (session.status === "published") {
    const closesAt = session.registrationClosesAt ? new Date(session.registrationClosesAt) : null;
    if (closesAt && closesAt.getTime() > now) {
      return { progressPercent: 60, progressLabel: `Registration closes in ${formatTimeUntil(closesAt)}` };
    }
    if (startAt.getTime() > now) {
      return { progressPercent: 20, progressLabel: `Starts in ${formatTimeUntil(startAt)}` };
    }
    return { progressPercent: 40, progressLabel: "Registration open" };
  }
  return { progressPercent: 0, progressLabel: "" };
}

export function toSessionListItem(session: TennisSession | SessionWithDetails): SessionListItem {
  const details = isSessionWithDetails(session) ? session : null;
  const registeredCount = details?.registeredCount ?? 0;
  const waitingCount = details?.waitlistedCount ?? 0;
  const now = Date.now();
  const registrationOpen =
    session.status === "published" &&
    (!session.registrationClosesAt || new Date(session.registrationClosesAt).getTime() > now) &&
    (!session.registrationOpensAt || new Date(session.registrationOpensAt).getTime() <= now);

  const { progressPercent, progressLabel } = computeProgress(session);

  return {
    id: session.id,
    title: session.title,
    type: (session.type ?? "custom") as SessionListItem["type"],
    status: session.status as SessionListItem["status"],
    location: session.location ?? "",
    startAt: new Date(session.startAt).toISOString(),
    endAt: session.endAt ? new Date(session.endAt).toISOString() : undefined,
    registeredCount,
    checkedInCount: 0,
    waitingCount,
    maxParticipants: session.maxParticipants ?? null,
    progressPercent,
    progressLabel,
    registrationOpen,
    registrationClosesAt: session.registrationClosesAt ? new Date(session.registrationClosesAt).toISOString() : undefined,
    waitingListEnabled: session.waitingListEnabled,
    costPerPlayer: session.price != null ? Number(session.price) : 0,
    organizerName: details?.creatorName ?? undefined,
    createdAt: new Date(session.createdAt).toISOString(),
    reviewNote: session.reviewNote ?? undefined,
  };
}

export function toSessionListItems(sessions: (TennisSession | SessionWithDetails)[]): SessionListItem[] {
  return sessions.map(toSessionListItem);
}
