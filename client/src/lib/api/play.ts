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

export interface PlayRecommendation {
  activity: PublicSessionCard;
  recommendation: { score: number; reasons: string[] } | null;
}

export async function getPlayRecommendations(): Promise<{ isPersonalised: boolean; recommendations: PlayRecommendation[] }> {
  const res = await apiRequest("GET", `${BASE}/recommendations`);
  return res.json();
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

// [PLAY][AI] Smart Natural-Language Search - see server/routes/play.ts
// smart-search route and server/services/smartSearchEngine.ts. This
// always succeeds with SOME usable result (falls back to a plain text
// search server-side) - callers don't need their own try/catch just to
// keep the search box working if AI is unavailable.
export interface SmartSearchResponse {
  intent: "FIND_ACTIVITY" | "FIND_PLAYER" | "TEXT_SEARCH";
  aiUsed: boolean;
  message?: string; // present for FIND_PLAYER
  resolvedFilters?: {
    location: string | null;
    format: string | null;
    level: string | null;
    gameFormat: string[] | null;
    timeOfDay: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  sessions: PublicSessionCard[];
  suggestions: { label: string; resultCount: number }[];
  analytics: { intent: string; usedAI: boolean; resultCount?: number };
}

export async function smartSearch(query: string): Promise<SmartSearchResponse> {
  const res = await apiRequest("POST", `${BASE}/smart-search`, { query });
  return res.json();
}
