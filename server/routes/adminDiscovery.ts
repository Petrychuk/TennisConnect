import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../requireAuth";
import { storage } from "../storage";
import { runDiscovery, isDiscoveryRunning } from "../services/discoveryOrchestration";
import { isSafeExternalUrl, resolveRegistrationUrl, resolveTimeZoneForState } from "../services/discoveryNormalization";
import { isValidYmd } from "../services/discoveryOccurrences";
import { resolveAustralianVenueCoordinates } from "../services/geocodingService";

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

// The Agent fetches these server-side, so only public http(s) pages are
// accepted (isSafeExternalUrl blocks localhost/private ranges/metadata).
const sourceUrl = z.string().url().refine(isSafeExternalUrl, "Must be a public http(s) page");
const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;

const sourceSchema = z.object({
  name: z.string().min(1).max(200),
  baseUrl: sourceUrl,
  // Additional pages of the same source, listed explicitly - the Agent
  // never follows links (spec section 4).
  extraUrls: z.array(sourceUrl).max(5).optional(),
  sourceType: z.enum(["CLUB", "COMMUNITY", "ORGANISER", "TOURNAMENT_PLATFORM", "TENNIS_ORGANISATION", "PUBLIC_EVENT_PAGE", "OTHER"]),
  // null = the source spans several states / is national.
  state: z.enum(AU_STATES).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  discoveryMethod: z.string().min(1).max(100).default("AI_EXTRACTION"),
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
      // Approving is the admin saying "this is NOT a duplicate". Without
      // clearing the suspected-duplicate link, a false positive would be
      // approved yet stay hidden from Play (which excludes anything
      // linked to an existing TennisConnect session).
      duplicateOfExternalId: null,
      duplicateOfSessionId: null,
      duplicateConfidence: null,
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

// Only the fields an admin can meaningfully correct - never review
// status, source, timestamps or duplicate links (those change through
// their own actions), and never a stray key from the request body.
// An empty string from a form is treated as "cleared" (null).
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable());
const optDate = z.preprocess(blankToNull, z.string().refine(isValidYmd, "Use YYYY-MM-DD").nullable());
const optTime = z.preprocess(blankToNull, z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM").nullable());

const editActivitySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optText(2000),
    activityType: optText(50),
    gameFormat: z.preprocess(blankToNull, z.enum(["singles", "doubles", "mixed"]).nullable()),
    startDate: optDate,
    endDate: optDate,
    startTime: optTime,
    endTime: optTime,
    recurrenceFrequency: z.preprocess(blankToNull, z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]).nullable()),
    recurrenceDayOfWeek: z.preprocess(
      blankToNull,
      z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]).nullable()
    ),
    venueName: optText(200),
    address: optText(300),
    suburb: optText(100),
    city: optText(100),
    state: z.preprocess(blankToNull, z.enum(AU_STATES).nullable()),
    postcode: optText(10),
    normalisedLevel: z.preprocess(blankToNull, z.enum(["Beginner", "Intermediate", "Advanced", "Pro"]).nullable()),
    price: z.preprocess(blankToNull, z.number().int().min(0).max(10000).nullable()),
    organiserName: optText(200),
    // A link players will click - must survive the same http(s)-only
    // check the Agent applies to extracted links.
    registrationUrl: z.preprocess(
      blankToNull,
      z.string().max(500).refine((v) => resolveRegistrationUrl(v, "https://invalid.example/") !== null, "Must be an http(s) link").nullable()
    ),
  })
  .partial();

router.put("/activities/:id", async (req, res, next) => {
  try {
    const parsed = editActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const patch: Record<string, unknown> = { ...parsed.data };

    // Changing where an activity is changes what depends on it: the time
    // zone follows the state, and the coordinates follow the place.
    if ("state" in patch || "suburb" in patch || "city" in patch) {
      const current = await storage.getExternalActivityById(req.params.id);
      if (!current) return res.status(404).json({ message: "Not found" });
      const merged = { suburb: current.suburb, city: current.city, state: current.state, ...patch } as {
        suburb: string | null;
        city: string | null;
        state: string | null;
      };
      patch.timeZone = resolveTimeZoneForState(merged.state);
      const coords = await resolveAustralianVenueCoordinates(merged);
      patch.latitude = coords?.latitude ?? null;
      patch.longitude = coords?.longitude ?? null;
    }

    const updated = await storage.updateExternalActivity(req.params.id, patch);
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

    // One run at a time - two overlapping runs would both write the same
    // sources' findings.
    if (isDiscoveryRunning()) {
      return res.status(409).json({ message: "A discovery run is already in progress. Try again in a moment." });
    }

    const run = await storage.createDiscoveryRun(parsed.data);

    // A real run over several sources (each up to a few pages, each a
    // network fetch plus a model call) can take minutes - far too long
    // to hold one HTTP request open. So it runs in the background and
    // this responds at once; the UI polls GET /runs/:id for the result.
    // runDiscovery takes its lock synchronously, so a second POST right
    // after this one gets the 409 above.
    runDiscovery(parsed.data)
      .then((summary) => storage.completeDiscoveryRun(run.id, summary))
      .catch(async (err: any) => {
        console.log(JSON.stringify({ event: "discovery_run_error", runId: run.id, error: err?.message }));
        await storage
          .completeDiscoveryRun(run.id, { errors: [{ sourceId: "", sourceName: "Run", error: err?.message ?? "Run failed" }] })
          .catch(() => {});
      });

    res.status(202).json({ id: run.id });
  } catch (error) {
    next(error);
  }
});

router.get("/runs/:id", async (req, res, next) => {
  try {
    const run = await storage.getDiscoveryRunById(req.params.id);
    if (!run) return res.status(404).json({ message: "Not found" });
    res.json(run);
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
