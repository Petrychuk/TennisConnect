import { apiRequest } from "@/lib/queryClient";
import type {
  TennisSession,
  SessionWithDetails,
  InsertSession,
  Organization,
  RegistrationWithUser,
  OrgPlayerRow,
  ActivityFeedItem,
  Registration,
  SessionRound,
  MatchWithPlayers,
  Match,
  LeaderboardRow,
} from "@shared/schema";

const BASE = "/api/organizer";

// ===== Organizations =====
// A session belongs to an Organization; every organiser needs one before
// they can create their first session. getMyOrganization / createOrganization
// exist so the wizard can transparently create a default one on first use
// instead of making the organiser deal with a separate "create an
// organization" step up front.

export async function getMyOrganization(): Promise<Organization | null> {
  const res = await apiRequest("GET", `${BASE}/organizations/me`);
  return res.json();
}

export async function createOrganization(name: string): Promise<Organization> {
  const res = await apiRequest("POST", `${BASE}/organizations`, { name });
  return res.json();
}

export async function getOrganizationByUserSlug(userSlug: string): Promise<(Organization & { upcomingSessions: SessionWithDetails[] }) | null> {
  const res = await apiRequest("GET", `${BASE}/organizations/by-user/${userSlug}`);
  return res.json();
}

/** Returns the organiser's own organization, creating a default one first if they don't have one yet. */
export async function ensureMyOrganization(fallbackName: string): Promise<Organization> {
  const existing = await getMyOrganization();
  if (existing) return existing;
  return createOrganization(fallbackName);
}

// ===== Sessions (organiser's own) =====

export async function getMySessions(): Promise<TennisSession[]> {
  const res = await apiRequest("GET", `${BASE}/sessions/mine`);
  return res.json();
}

export interface DashboardStats {
  activePlayers: number;
  attendancePercent: number;
  revenueThisWeek: number;
  revenueCurrency: string;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await apiRequest("GET", `${BASE}/dashboard/stats`);
  return res.json();
}

export async function getDashboardActivity(limit = 8): Promise<ActivityFeedItem[]> {
  const res = await apiRequest("GET", `${BASE}/dashboard/activity?limit=${limit}`);
  return res.json();
}

/** Org-wide player roster - every distinct player who's registered for any of the organiser's sessions. */
export async function getMyPlayers(): Promise<OrgPlayerRow[]> {
  const res = await apiRequest("GET", `${BASE}/players/mine`);
  return res.json();
}

export type SearchablePlayer = { id: string; name: string; slug: string; avatar: string | null; role: string; alreadyConnected: boolean };

/** Search real platform users by name, for either invite dialog. Pass a sessionId or community context so already-connected players are flagged instead of being re-invitable. */
export async function searchPlayers(query: string, context?: { sessionId?: string; community?: boolean }): Promise<SearchablePlayer[]> {
  const params = new URLSearchParams({ q: query });
  if (context?.sessionId) params.set("sessionId", context.sessionId);
  if (context?.community) params.set("community", "1");
  const res = await apiRequest("GET", `${BASE}/players/search?${params.toString()}`);
  return res.json();
}

/** General "come play with us" invite - no specific session. */
export async function inviteToOrganization(userId: string): Promise<{ invited: boolean }> {
  const res = await apiRequest("POST", `${BASE}/players/invite`, { userId });
  return res.json();
}

/** Invites a specific player to a specific session - creates a real "invited" registration. */
export async function inviteToSession(sessionId: string, userId: string): Promise<Registration> {
  const res = await apiRequest("POST", `${BASE}/sessions/${sessionId}/invite`, { userId });
  return res.json();
}

export async function getSessionById(id: string): Promise<SessionWithDetails> {
  const res = await apiRequest("GET", `${BASE}/sessions/${id}`);
  return res.json();
}

/** Every division (Men's Singles A, Mixed Doubles, etc.) of a Tournament/Club Championship container session. */
export async function getSessionDivisions(id: string): Promise<SessionWithDetails[]> {
  const res = await apiRequest("GET", `${BASE}/sessions/${id}/divisions`);
  return res.json();
}

export interface CreateDivisionInput {
  title: string;
  startAt?: Date;
  endAt?: Date;
  maxParticipants?: number;
  description?: string;
  /** Clone from an existing sibling division instead of the container itself - fastest way to set up e.g. "B" once "A" exists. */
  cloneFromDivisionId?: string;
}

/** Quick-creates a new division under a container session - everything but title is inherited from the base session unless overridden. */
export async function createSessionDivision(containerId: string, input: CreateDivisionInput): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/sessions/${containerId}/divisions`, input);
  return res.json();
}

export async function getSessionRegistrations(id: string): Promise<RegistrationWithUser[]> {
  const res = await apiRequest("GET", `${BASE}/sessions/${id}/registrations`);
  return res.json();
}

/** Sends a real message to every currently-registered player - the "Session Updates" tab's Post Update action. */
export async function broadcastToSession(id: string, message: string): Promise<{ sentTo: number }> {
  const res = await apiRequest("POST", `${BASE}/sessions/${id}/broadcast`, { message });
  return res.json();
}

export async function createSession(data: InsertSession): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/sessions`, data);
  return res.json();
}

export async function updateSession(id: string, data: Partial<InsertSession>): Promise<TennisSession> {
  const res = await apiRequest("PUT", `${BASE}/sessions/${id}`, data);
  return res.json();
}

/** draft -> pending_review for an organiser, or draft -> published directly for an admin. */
export async function publishSession(id: string): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/sessions/${id}/publish`);
  return res.json();
}

export async function cancelSession(id: string): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/sessions/${id}/cancel`);
  return res.json();
}

export async function archiveSession(id: string): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/sessions/${id}/archive`);
  return res.json();
}

/** Drafts only - anything past draft should be cancelled instead. */
export async function deleteSession(id: string): Promise<void> {
  await apiRequest("DELETE", `${BASE}/sessions/${id}`);
}

// ===== TC Live Engine (v0.1) =====

export async function checkInRegistration(sessionId: string, registrationId: string): Promise<Registration> {
  const res = await apiRequest("POST", `${BASE}/sessions/${sessionId}/checkin/${registrationId}`);
  return res.json();
}

export async function removeRegistration(sessionId: string, registrationId: string): Promise<Registration> {
  const res = await apiRequest("DELETE", `${BASE}/sessions/${sessionId}/registrations/${registrationId}`);
  return res.json();
}

export async function moveRegistrationToWaitlist(sessionId: string, registrationId: string): Promise<Registration> {
  const res = await apiRequest("POST", `${BASE}/sessions/${sessionId}/registrations/${registrationId}/waitlist`);
  return res.json();
}

export async function setRegistrationLiveStatus(
  sessionId: string,
  registrationId: string,
  liveStatus: "unavailable" | "withdrawn" | null
): Promise<Registration> {
  const res = await apiRequest("POST", `${BASE}/sessions/${sessionId}/registrations/${registrationId}/live-status`, {
    liveStatus,
  });
  return res.json();
}

/** published -> live. Requires courtsCount set and >= 2 checked-in players (enforced server-side). */
export async function goLiveSession(id: string): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/sessions/${id}/go-live`);
  return res.json();
}

/** Throws (via apiRequest) if the current round isn't fully confirmed yet - callers should keep Generate disabled instead of relying on the error. */
export async function generateNextRound(sessionId: string): Promise<{ round: SessionRound; matches: MatchWithPlayers[] }> {
  const res = await apiRequest("POST", `${BASE}/sessions/${sessionId}/rounds/generate`);
  return res.json();
}

/** Null if no round has been generated yet. */
export async function getCurrentRound(sessionId: string): Promise<{ round: SessionRound; matches: MatchWithPlayers[] } | null> {
  const res = await apiRequest("GET", `${BASE}/sessions/${sessionId}/rounds/current`);
  return res.json();
}

export async function startMatch(sessionId: string, matchId: string): Promise<Match> {
  const res = await apiRequest("POST", `${BASE}/sessions/${sessionId}/matches/${matchId}/start`);
  return res.json();
}

/** Organizer-only entry (v0.1) - saving confirms the match immediately, no second-party confirmation step. */
export async function reportMatchScore(
  sessionId: string,
  matchId: string,
  teamAGames: number,
  teamBGames: number
): Promise<Match> {
  const res = await apiRequest("POST", `${BASE}/sessions/${sessionId}/matches/${matchId}/score`, {
    teamAGames,
    teamBGames,
  });
  return res.json();
}

/** live -> completed. */
export async function finishSession(id: string): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/sessions/${id}/finish`);
  return res.json();
}

export async function getSessionLeaderboard(sessionId: string): Promise<LeaderboardRow[]> {
  const res = await apiRequest("GET", `${BASE}/sessions/${sessionId}/leaderboard`);
  return res.json();
}

// ===== Admin moderation =====

export async function getAdminSessions(status?: string): Promise<SessionWithDetails[]> {
  const url = status ? `${BASE}/admin/sessions?status=${encodeURIComponent(status)}` : `${BASE}/admin/sessions`;
  const res = await apiRequest("GET", url);
  return res.json();
}

export async function approveSession(id: string): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/admin/sessions/${id}/approve`);
  return res.json();
}

export async function rejectSession(id: string, note?: string): Promise<TennisSession> {
  const res = await apiRequest("POST", `${BASE}/admin/sessions/${id}/reject`, note ? { note } : undefined);
  return res.json();
}

// ===== Public / player-facing =====

export async function getSessionsThisWeek(): Promise<SessionWithDetails[]> {
  const res = await apiRequest("GET", `${BASE}/sessions/this-week`);
  return res.json();
}

export async function getMyRegisteredSessions(): Promise<SessionWithDetails[]> {
  const res = await apiRequest("GET", `${BASE}/sessions/mine/registered`);
  return res.json();
}

export async function joinSession(id: string): Promise<{ registration: unknown; waitlisted: boolean }> {
  const res = await apiRequest("POST", `${BASE}/sessions/${id}/join`);
  return res.json();
}

export async function leaveSession(id: string): Promise<unknown> {
  const res = await apiRequest("DELETE", `${BASE}/sessions/${id}/join`);
  return res.json();
}
