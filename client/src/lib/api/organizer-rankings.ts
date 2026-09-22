import { apiRequest } from "@/lib/queryClient";
import type {
  Series,
  InsertSeries,
  TennisSession,
  SeriesStandingRow,
  SeriesSessionResultRow,
  PlayerFormEntry,
} from "@shared/schema";

const BASE = "/api/organizer";

export type SeriesWithCounts = Series & { sessionsCount: number; playersCount: number };
export type SeriesSession = TennisSession & { playersCount: number; roundsCount: number };

export async function getSeriesForSeason(seasonId: string): Promise<SeriesWithCounts[]> {
  const res = await apiRequest("GET", `${BASE}/seasons/${seasonId}/series`);
  return res.json();
}

export async function createSeries(data: Omit<InsertSeries, "organizationId" | "createdBy">): Promise<Series> {
  const res = await apiRequest("POST", `${BASE}/series`, data);
  return res.json();
}

export async function updateSeries(id: string, data: Partial<InsertSeries>): Promise<Series> {
  const res = await apiRequest("PUT", `${BASE}/series/${id}`, data);
  return res.json();
}

export async function deleteSeries(id: string): Promise<void> {
  await apiRequest("DELETE", `${BASE}/series/${id}`);
}

export async function getSessionsForSeries(seriesId: string): Promise<SeriesSession[]> {
  const res = await apiRequest("GET", `${BASE}/series/${seriesId}/sessions`);
  return res.json();
}

export async function addSessionsToSeries(seriesId: string, sessionIds: string[]): Promise<void> {
  await apiRequest("POST", `${BASE}/series/${seriesId}/sessions`, { sessionIds });
}

export async function removeSessionFromSeries(seriesId: string, sessionId: string): Promise<void> {
  await apiRequest("DELETE", `${BASE}/series/${seriesId}/sessions/${sessionId}`);
}

export async function getSeriesStandings(seriesId: string): Promise<SeriesStandingRow[]> {
  const res = await apiRequest("GET", `${BASE}/series/${seriesId}/standings`);
  return res.json();
}

export async function getSeriesSessionResults(seriesId: string, sessionId: string): Promise<SeriesSessionResultRow[]> {
  const res = await apiRequest("GET", `${BASE}/series/${seriesId}/sessions/${sessionId}/results`);
  return res.json();
}

export async function getPlayerRecentForm(seriesId: string, userId: string): Promise<PlayerFormEntry[]> {
  const res = await apiRequest("GET", `${BASE}/series/${seriesId}/players/${userId}/form`);
  return res.json();
}
