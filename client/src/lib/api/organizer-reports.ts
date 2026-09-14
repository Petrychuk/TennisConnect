import { apiRequest } from "@/lib/queryClient";
import type { ReportsData, ReportsPeriod } from "@shared/schema";

const BASE = "/api/organizer";

export interface ReportsFilters {
  period: ReportsPeriod;
  seasonId?: string;
  seriesId?: string;
  from?: string;
  to?: string;
}

export async function getReportsData(filters: ReportsFilters): Promise<ReportsData> {
  const params = new URLSearchParams();
  params.set("period", filters.period);
  if (filters.seasonId) params.set("seasonId", filters.seasonId);
  if (filters.seriesId) params.set("seriesId", filters.seriesId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const res = await apiRequest("GET", `${BASE}/reports?${params.toString()}`);
  return res.json();
}
