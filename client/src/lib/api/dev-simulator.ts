import { apiRequest } from "@/lib/queryClient";

const BASE = "/api/dev";

export interface LiveSimulatorSeedResult {
  sessionId: string;
  organizerEmail: string;
  testPassword: string;
  sessionTitle: string;
  courtsCount: number;
  playerCount: number;
}

/** Creates/reuses the TC Live dev fixture (organizer, org, 16 test players, 1 session) and resets it to "ready to Go Live". Only exists when NODE_ENV=development on the server. */
export async function seedLiveSimulator(): Promise<LiveSimulatorSeedResult> {
  const res = await apiRequest("POST", `${BASE}/live-simulator/seed`);
  return res.json();
}

/** Wipes rounds/matches/registrations for the existing fixture session and re-checks-in all 16 test players. */
export async function resetLiveSimulator(): Promise<{ sessionId: string; playerCount: number }> {
  const res = await apiRequest("POST", `${BASE}/live-simulator/reset`);
  return res.json();
}
