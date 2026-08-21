import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import {
  getSessionRegistrations,
  checkInRegistration,
  goLiveSession,
  generateNextRound,
  getCurrentRound,
  reportMatchScore,
  finishSession,
  getSessionLeaderboard,
} from "@/lib/api/organizer-sessions";
import { seedLiveSimulator, resetLiveSimulator } from "@/lib/api/dev-simulator";
import type { MatchWithPlayers } from "@shared/schema";

// Developer-only tool (TC Live spec §33) for running through
// Registration -> Check-in -> Go Live -> Rounds -> Finish -> Leaderboard
// alone, against the real organizer API - not a mocked preview. Every
// button here calls the same endpoints session-live.tsx does; "Seed" and
// "Reset" are the only two dev-only calls (server/routes/dev.ts), which
// only exist when NODE_ENV=development on the server.
//
// Never shipped: the route is only registered in App.tsx when
// import.meta.env.DEV is true, which Vite strips from production builds
// entirely (the import.meta.env.DEV check is a compile-time constant).
export default function LiveSimulatorPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const write = (line: string) => setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true);
    write(`▶ ${label}...`);
    try {
      const result = await action();
      write(`✓ ${label} done`);
      return result;
    } catch (error: any) {
      write(`✗ ${label} FAILED: ${error?.message ?? "unknown error"}`);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = () =>
    run("Seed fixture", async () => {
      const result = await seedLiveSimulator();
      setSessionId(result.sessionId);
      write(`  session ${result.sessionId} - ${result.playerCount} players, ${result.courtsCount} courts`);
      write(`  login: ${result.organizerEmail} / ${result.testPassword}`);
      return result;
    });

  const handleReset = () =>
    run("Reset fixture", async () => {
      const result = await resetLiveSimulator();
      setSessionId(result.sessionId);
      return result;
    });

  const handleCheckInAll = () =>
    run("Check in all players", async () => {
      if (!sessionId) throw new Error("Seed the fixture first");
      const registrations = await getSessionRegistrations(sessionId);
      const notCheckedIn = registrations.filter((r) => !r.checkedInAt);
      for (const r of notCheckedIn) {
        await checkInRegistration(sessionId, r.id);
      }
      write(`  checked in ${notCheckedIn.length} players`);
    });

  const handleGoLive = () =>
    run("Go live", async () => {
      if (!sessionId) throw new Error("Seed the fixture first");
      return goLiveSession(sessionId);
    });

  const handleGenerateRound = () =>
    run("Generate round", async () => {
      if (!sessionId) throw new Error("Seed the fixture first");
      const result = await generateNextRound(sessionId);
      write(`  round ${result.round.roundNumber}: ${result.matches.length} matches`);
      return result;
    });

  // Assigns a random valid score to every not-yet-confirmed match in the
  // current round (4-0 .. 4-3 either way, per TC Live spec §34 - never a
  // tie, never anything a real session would produce as an outcome).
  const handleCompleteRound = () =>
    run("Complete round (random scores)", async () => {
      if (!sessionId) throw new Error("Seed the fixture first");
      const current = await getCurrentRound(sessionId);
      if (!current) throw new Error("No round to complete - generate one first");
      const pending = current.matches.filter((m: MatchWithPlayers) => m.status !== "confirmed");
      for (const match of pending) {
        const loserGames = Math.floor(Math.random() * 4); // 0-3
        const aWins = Math.random() < 0.5;
        const teamAGames = aWins ? 4 : loserGames;
        const teamBGames = aWins ? loserGames : 4;
        await reportMatchScore(sessionId, match.id, teamAGames, teamBGames);
      }
      write(`  scored ${pending.length} matches`);
    });

  const handleFinish = () =>
    run("Finish session", async () => {
      if (!sessionId) throw new Error("Seed the fixture first");
      const session = await finishSession(sessionId);
      const leaderboard = await getSessionLeaderboard(sessionId);
      write(`  leaderboard: ${leaderboard.map((r) => `${r.userName} (${r.wins}W)`).join(", ")}`);
      return session;
    });

  const handleSimulateFullSession = () =>
    run("Simulate full session (3 rounds)", async () => {
      if (!sessionId) throw new Error("Seed the fixture first");
      await handleCheckInAll();
      await handleGoLive();
      for (let i = 0; i < 3; i++) {
        await handleGenerateRound();
        await handleCompleteRound();
      }
      await handleFinish();
    });

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">TC Live Simulator</h1>
          <p className="text-sm text-muted-foreground">
            Dev-only. {sessionId ? `Fixture session: ${sessionId}` : "No fixture seeded yet."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={handleSeed}>Seed Fixture</Button>
            <Button size="sm" variant="secondary" disabled={busy || !sessionId} onClick={handleCheckInAll}>Check In All</Button>
            <Button size="sm" variant="secondary" disabled={busy || !sessionId} onClick={handleGoLive}>Go Live</Button>
            <Button size="sm" variant="secondary" disabled={busy || !sessionId} onClick={handleGenerateRound}>Generate Round</Button>
            <Button size="sm" variant="secondary" disabled={busy || !sessionId} onClick={handleCompleteRound}>Complete Round (Random)</Button>
            <Button size="sm" variant="secondary" disabled={busy || !sessionId} onClick={handleFinish}>Finish Session</Button>
            <Button size="sm" disabled={busy || !sessionId} onClick={handleSimulateFullSession}>Simulate Full Session</Button>
            <Button size="sm" variant="destructive" disabled={busy || !sessionId} onClick={handleReset}>Reset</Button>
            {busy && <TennisBallSpinner className="self-center" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-xs bg-muted rounded-lg p-3 max-h-96 overflow-y-auto space-y-0.5">
              {log.length === 0 && <p className="text-muted-foreground">Nothing yet - hit "Seed Fixture" to start.</p>}
              {log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
