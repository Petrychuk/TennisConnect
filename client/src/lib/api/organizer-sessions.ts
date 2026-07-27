import { apiRequest } from "@/lib/queryClient";
import type {
  TennisSession,
  SessionWithDetails,
  InsertSession,
  Organization,
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

export async function getOrganizationByUserSlug(userSlug: string): Promise<(Organization & { upcomingSessions: TennisSession[] }) | null> {
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

export async function getSessionById(id: string): Promise<TennisSession> {
  const res = await apiRequest("GET", `${BASE}/sessions/${id}`);
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
