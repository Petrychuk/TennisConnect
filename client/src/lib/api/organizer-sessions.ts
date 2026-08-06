import { apiRequest } from "@/lib/queryClient";
import type {
  TennisSession,
  SessionWithDetails,
  InsertSession,
  Organization,
  RegistrationWithUser,
  OrgPlayerRow,
  Registration,
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

export async function getSessionById(id: string): Promise<TennisSession> {
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
