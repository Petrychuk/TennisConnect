/*
  TC Live for players (TC-189, PO decision 10 Nov 2026 - phase 1).

  A registered player of a live session sees their current match (court,
  partner, opponents), whether they rest this round and the leaderboard, and
  reports their match's score from their phone. The rules are shared with the
  organiser screen (shared/liveRules.ts); the engine, rounds and scoring are
  the existing TC Live ones - this is a second door, not a second system.

  Same switch as the organiser's Live routes: TC_LIVE_ENABLED off -> 404;
  internal -> only internal test sessions. Only the session's registered
  players (403 for anyone else, 404 for a session that doesn't exist).
  Polling, like the organiser screen; no realtime infrastructure.

    GET  /api/live/sessions/:id/me
    POST /api/live/sessions/:id/matches/:matchId/report   { teamAGames, teamBGames }
*/
import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../requireAuth";
import { storage } from "../storage";
import { liveAllowedFor, liveMode } from "../lib/liveFeature";
import { LiveRuleError } from "../lib/liveErrors";
import { autoStartIfDue } from "../lib/liveAutoStart";
import { scoreProblem } from "@shared/liveRules";
import type { TennisSession } from "@shared/schema";
import { buildPlayerLiveView } from "../lib/playerLiveView";

const router = Router();

function requireLiveEnabled(_req: Request, res: Response, next: NextFunction) {
  if (liveMode() === "off") return res.status(404).json({ message: "Not found" });
  next();
}

/** The session, Live allowed for it, and the caller is one of its registered players. */
async function requireLivePlayer(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await storage.getSessionById(req.params.id);
    if (!session || !liveAllowedFor(session)) return res.status(404).json({ message: "Session not found" });
    await autoStartIfDue(storage, session);
    const userId = (req.user as any).id as string;
    const registrations = await storage.getRegistrationsForSession(session.id);
    const mine = registrations.find((r: any) => r.userId === userId && r.status === "registered");
    if (!mine) return res.status(403).json({ message: "Only this session's registered players can open it" });
    (req as any).session_ = session;
    (req as any).registration_ = mine;
    next();
  } catch (error) {
    next(error);
  }
}

router.get("/sessions/:id/me", requireLiveEnabled, requireAuth, requireLivePlayer, async (req, res, next) => {
  try {
    const session = (req as any).session_ as TennisSession;
    const userId = (req.user as any).id as string;
    const [current, leaderboard] = await Promise.all([
      session.status === "live" || session.status === "completed" || session.status === "archived" ? storage.getCurrentRound(session.id) : undefined,
      storage.getSessionLeaderboard(session.id),
    ]);
    res.json(buildPlayerLiveView(session, userId, !!(req as any).registration_.checkedInAt, current, leaderboard));
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/matches/:matchId/report", requireLiveEnabled, requireAuth, requireLivePlayer, async (req, res, next) => {
  try {
    const { teamAGames, teamBGames } = req.body ?? {};
    const problem = scoreProblem(teamAGames, teamBGames);
    if (problem) return res.status(400).json({ message: problem });
    const current = await storage.getCurrentRound(req.params.id);
    // Only a match of this session's current round (no editing old rounds, no IDOR via another session's match id).
    if (!current || !current.matches.some((m) => m.id === req.params.matchId)) {
      return res.status(404).json({ message: "This match isn't in the current round" });
    }
    const result = await storage.reportMatchScoreByPlayer(req.params.matchId, (req.user as any).id, teamAGames, teamBGames);
    res.json(result);
  } catch (error: any) {
    if (error instanceof LiveRuleError) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

export default router;
