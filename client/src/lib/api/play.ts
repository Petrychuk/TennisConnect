import { apiRequest } from "@/lib/queryClient";
import type { PublicSessionCard, PublicSessionDetails } from "@shared/schema";

const BASE = "/api/play";

export interface PlayFilters {
  search?: string;
  location?: string;
  format?: string;
  level?: string;
  organizerId?: string;
  dateFrom?: string; // ISO
  dateTo?: string; // ISO
}

export async function getPlaySessions(filters: PlayFilters): Promise<PublicSessionCard[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.location) params.set("location", filters.location);
  if (filters.format) params.set("format", filters.format);
  if (filters.level) params.set("level", filters.level);
  if (filters.organizerId) params.set("organizerId", filters.organizerId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  const res = await apiRequest("GET", `${BASE}/sessions${qs ? `?${qs}` : ""}`);
  const data = await res.json();
  return data.sessions;
}

export async function getPlaySessionById(id: string): Promise<PublicSessionDetails> {
  const res = await apiRequest("GET", `${BASE}/sessions/${id}`);
  return res.json();
}

export async function joinSession(sessionId: string): Promise<{ waitlisted: boolean }> {
  const res = await apiRequest("POST", `/api/organizer/sessions/${sessionId}/join`);
  return res.json();
}

export async function leaveSession(sessionId: string): Promise<void> {
  await apiRequest("DELETE", `/api/organizer/sessions/${sessionId}/join`);
}
