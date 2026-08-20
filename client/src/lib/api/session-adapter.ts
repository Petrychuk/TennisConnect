import type { TennisSession, SessionWithDetails, RegistrationWithUser, OrgPlayerRow } from "@shared/schema";
import type { SessionListItem, SessionPlayer } from "@/lib/organiser-sessions-mock-data";
import type { OrgPlayer } from "@/lib/organiser-players-mock-data";

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
    coverImage: session.coverImage ?? undefined,
    type: (session.type ?? "custom") as SessionListItem["type"],
    status: session.status as SessionListItem["status"],
    location: session.location ?? "",
    startAt: new Date(session.startAt).toISOString(),
    endAt: session.endAt ? new Date(session.endAt).toISOString() : undefined,
    registeredCount,
    checkedInCount: details?.checkedInCount ?? 0,
    waitingCount,
    maxParticipants: session.maxParticipants ?? null,
    progressPercent,
    progressLabel,
    registrationOpen,
    registrationClosesAt: session.registrationClosesAt ? new Date(session.registrationClosesAt).toISOString() : undefined,
    waitingListEnabled: session.waitingListEnabled,
    parentSessionId: session.parentSessionId ?? null,
    costPerPlayer: session.price != null ? Number(session.price) : 0,
    organizerName: details?.creatorName ?? undefined,
    organizationSlug: details?.organizationSlug ?? undefined,
    createdAt: new Date(session.createdAt).toISOString(),
    reviewNote: session.reviewNote ?? undefined,
  };
}

export function toSessionListItems(sessions: (TennisSession | SessionWithDetails)[]): SessionListItem[] {
  return sessions.map(toSessionListItem);
}

const REGISTRATION_STATUS_TO_PLAYER_STATUS: Record<string, SessionPlayer["status"]> = {
  registered: "registered",
  waitlisted: "waiting",
  cancelled: "cancelled",
  invited: "invited",
};

/**
 * Maps a real registration (from GET /sessions/:id/registrations) to
 * the SessionPlayer shape the Players/Registration tab UI already
 * expects, so a real registration can be merged straight into the
 * existing mock "crowd" list without that UI needing to change.
 * Level/group/rating aren't modelled on a real registration yet, so
 * those get a neutral default rather than fabricated data.
 */
export function toSessionPlayer(registration: RegistrationWithUser): SessionPlayer {
  return {
    id: registration.id,
    name: registration.userName,
    avatar: registration.userAvatar,
    level: 0,
    levelLabel: "Social",
    group: null,
    status: REGISTRATION_STATUS_TO_PLAYER_STATUS[registration.status] ?? "registered",
    checkedIn: !!registration.checkedInAt,
    checkInTime: registration.checkedInAt ? new Date(registration.checkedInAt).toISOString() : null,
    joinedAt: new Date(registration.createdAt).toISOString(),
    isReal: true,
    slug: registration.userSlug,
  };
}

export function toSessionPlayers(registrationsList: RegistrationWithUser[]): SessionPlayer[] {
  return registrationsList.map(toSessionPlayer);
}

/**
 * Maps a real org-wide player row (from GET /players/mine) to the
 * OrgPlayer shape the Players page's UI already expects. Level/win-rate
 * aren't derivable from registration data alone - no skill ratings or
 * match results exist yet - so those get neutral defaults rather than
 * fabricated numbers, same reasoning as toSessionPlayer's level/group.
 */
import { skillLevelToUtr } from "@/lib/skillLevel";

function toLevelLabel(skillLevel: string | null): OrgPlayer["levelLabel"] {
  if (skillLevel === "Beginner" || skillLevel === "Intermediate" || skillLevel === "Advanced") {
    return skillLevel;
  }
  // No profile / skill level on file, or they picked "Social" - both
  // mean "unrated" for this table's purposes (Social isn't a skill
  // tier, it's the no-numeric-rating tier - see skillLevel.ts).
  return "Social";
}

export function toOrgPlayer(row: OrgPlayerRow): OrgPlayer {
  const lastPlayed = new Date(row.lastPlayedAt);
  const daysSinceLastPlayed = (Date.now() - lastPlayed.getTime()) / (24 * 60 * 60 * 1000);
  return {
    id: row.userId,
    name: row.userName,
    avatar: row.userAvatar,
    level: skillLevelToUtr(row.userSkillLevel) ?? 0,
    levelLabel: toLevelLabel(row.userSkillLevel),
    sessionsPlayed: row.sessionsPlayed,
    winRate: 0,
    lastPlayed: lastPlayed.toISOString(),
    // Active if they've registered for something in the last ~90 days.
    status: daysSinceLastPlayed <= 90 ? "active" : "inactive",
  };
}

export function toOrgPlayers(rows: OrgPlayerRow[]): OrgPlayer[] {
  return rows.map(toOrgPlayer);
}
