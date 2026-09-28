import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../requireAuth";
import { storage } from "../storage";
import { runDiscovery } from "../services/discoveryOrchestration";

// [PLAY][AI] TC Discovery Agent, sections 3, 16-17, 24 - Source
// Registry management + the Admin Discovery Queue (Pending/Approved/
// Rejected/Needs Review) + the run trigger (DRY RUN by default, per
// spec section 24 - nothing here ever auto-publishes to players).
const router = Router();
router.use(requireAdmin);

// --- Source Registry (spec section 3) ---

router.get("/sources", async (req, res, next) => {
  try {
    const sources = await storage.getDiscoverySources({});
    res.json(sources);
  } catch (error) {
    next(error);
  }
});

const sourceSchema = z.object({
  name: z.string().min(1).max(200),
  baseUrl: z.string().url(),
  sourceType: z.enum(["CLUB", "COMMUNITY", "ORGANISER", "TOURNAMENT_PLATFORM", "TENNIS_ORGANISATION", "PUBLIC_EVENT_PAGE", "OTHER"]),
  state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]).optional(),
  discoveryMethod: z.string().min(1).max(100),
});

router.post("/sources", async (req, res, next) => {
  try {
    const parsed = sourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }
    const created = await storage.createDiscoverySource(parsed.data);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put("/sources/:id", async (req, res, next) => {
  try {
    const parsed = sourceSchema.partial().extend({ enabled: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }
    const updated = await storage.updateDiscoverySource(req.params.id, parsed.data);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// --- Discovery Queue (spec section 17) ---

// Tab counts for the queue header - computed with the same
// classifyQueueTab as the list itself, so the numbers always match.
router.get("/counts", async (req, res, next) => {
  try {
    res.json(await storage.getExternalActivityCounts());
  } catch (error) {
    next(error);
  }
});

router.get("/activities", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "PENDING";
    const activities = await storage.getExternalActivitiesForReview(status);
    res.json(activities);
  } catch (error) {
    next(error);
  }
});

router.post("/activities/:id/approve", async (req, res, next) => {
  try {
    const updated = await storage.reviewExternalActivity(req.params.id, {
      reviewStatus: "APPROVED",
      discoveryStatus: "ACTIVE",
      reviewedBy: req.user!.id,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/activities/:id/reject", async (req, res, next) => {
  try {
    const updated = await storage.reviewExternalActivity(req.params.id, {
      reviewStatus: "REJECTED",
      reviewedBy: req.user!.id,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/activities/:id/mark-duplicate", async (req, res, next) => {
  try {
    const schema = z.object({ duplicateOfExternalId: z.string().optional(), duplicateOfSessionId: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const updated = await storage.reviewExternalActivity(req.params.id, {
      reviewStatus: "DUPLICATE",
      reviewedBy: req.user!.id,
      duplicateOfExternalId: parsed.data.duplicateOfExternalId,
      duplicateOfSessionId: parsed.data.duplicateOfSessionId,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put("/activities/:id", async (req, res, next) => {
  try {
    const updated = await storage.updateExternalActivity(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// --- Run trigger (spec section 24) ---

const runSchema = z.object({
  isDryRun: z.boolean().default(true),
  targetCountry: z.string().optional(),
  targetState: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]).optional(),
  targetCity: z.string().optional(),
  targetSourceId: z.string().optional(),
});

router.post("/run", async (req, res, next) => {
  try {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }

    const run = await storage.createDiscoveryRun(parsed.data);
    const summary = await runDiscovery(parsed.data);
    const completed = await storage.completeDiscoveryRun(run.id, summary);

    res.json(completed);
  } catch (error) {
    next(error);
  }
});

router.get("/runs", async (req, res, next) => {
  try {
    const runs = await storage.getDiscoveryRuns();
    res.json(runs);
  } catch (error) {
    next(error);
  }
});

export default router;
