// Public "Play" discovery - the single player-facing answer to "where
// can I play tennis?" (see the [Player] Create Play page spec). No
// auth required to browse; a signed-in viewer just additionally gets
// their own registration status on the details endpoint.
import { Router } from "express";
import { storage } from "../storage";
import { publicBrowseLimiter } from "../lib/rateLimiters";
import {
  computeRecommendation,
  isEventEligibleForPlayer,
  hasEnoughSignalForPersonalisation,
  type RecommendationPlayerInput,
  type RecommendationEventInput,
} from "../services/recommendationEngine";

const router = Router();
router.use(publicBrowseLimiter);

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// GET /api/play/sessions
router.get("/sessions", async (req, res, next) => {
  try {
    const sessions = await storage.getPublicSessions({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      location: typeof req.query.location === "string" ? req.query.location : undefined,
      format: typeof req.query.format === "string" ? req.query.format : undefined,
      level: typeof req.query.level === "string" ? req.query.level : undefined,
      organizationId: typeof req.query.organizerId === "string" ? req.query.organizerId : undefined,
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
    });
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

// GET /api/play/recommendations - "Recommended for You" (spec: [PLAY]
// Personalised Recommendations). Deterministic, server-side scoring -
// see server/services/recommendationEngine.ts for the actual
// weighting; this route just wires it to real player/event data and
// applies the max-4/eligible-only/ranked-by-score contract.
router.get("/recommendations", async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      // Recommendations are a signed-in feature - Play itself stays
      // fully usable without an account, this endpoint just isn't
      // called for a guest (see the frontend's own isAuthenticated gate).
      return res.status(401).json({ message: "Sign in for personalised recommendations" });
    }
    const user = req.user as any;
    if (user.role !== "player") {
      return res.status(403).json({ message: "Recommendations are for players" });
    }

    const profile = await storage.getPlayerProfile(user.id);
    const playerInput: RecommendationPlayerInput = {
      skillLevel: profile?.skillLevel,
      preferredCourts: profile?.preferredCourts,
      playRadiusKm: profile?.playRadiusKm,
      latitude: profile?.latitude,
      longitude: profile?.longitude,
      availability: profile?.availability,
      gameFormat: profile?.gameFormat,
      playStyle: profile?.playStyle,
      lookingFor: profile?.lookingFor,
    };
    const isPersonalised = hasEnoughSignalForPersonalisation(playerInput);

    // Reuses the same eligible/published/non-cancelled query Play's
    // own search already goes through - no separate "recommendation
    // eligibility" query to keep in sync with the discovery one.
    const sessions = await storage.getPublicSessions({});

    const toEventInput = (s: (typeof sessions)[number]): RecommendationEventInput => ({
      id: s.id,
      type: s.type,
      skillLevel: s.skillLevel,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      startAt: s.startAt,
      timeZone: s.timeZone,
      playStatus: s.playStatus,
      registeredCount: s.registeredCount,
      maxParticipants: s.maxParticipants,
    });

    const eligible = sessions.filter((s) => isEventEligibleForPlayer(playerInput, toEventInput(s)));

    const results = isPersonalised
      ? eligible
          .map((s) => ({ activity: s, recommendation: computeRecommendation(playerInput, toEventInput(s)) }))
          .sort((a, b) => b.recommendation.score - a.recommendation.score)
      : // Low-data fallback (spec section 8) - "Popular near you", not a
        // faked percentage. Soonest-starting first, since there's no
        // real popularity/behavioural signal to rank by yet.
        eligible
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
          .map((s) => ({ activity: s, recommendation: null }));

    res.json({
      isPersonalised,
      recommendations: results.slice(0, 4),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/play/sessions/:id
router.get("/sessions/:id", async (req, res, next) => {
  try {
    const viewerUserId = req.isAuthenticated && req.isAuthenticated() ? (req.user as any).id : undefined;
    const session = await storage.getPublicSessionById(req.params.id, viewerUserId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

export default router;
