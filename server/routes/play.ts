// Public "Play" discovery - the single player-facing answer to "where
// can I play tennis?" (see the [Player] Create Play page spec). No
// auth required to browse; a signed-in viewer just additionally gets
// their own registration status on the details endpoint.
import { Router } from "express";
import { storage } from "../storage";
import { publicBrowseLimiter } from "../lib/rateLimiters";

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
