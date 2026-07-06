import { Router } from "express";
import { db } from "../db";
import { articles, travelPackages, recreationServices, tournaments } from "@shared/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import {
  insertArticleSchema,
  insertTravelPackageSchema,
  insertRecreationServiceSchema,
  insertTournamentSchema,
  insertClubSchema,
} from "@shared/schema";
import { storage } from "../storage";

const router = Router();
console.log("CONTENT ROUTES LOADED");

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Forbidden: admin only" });
  }
  next();
}

// Async wrapper that catches errors so PUT/POST with bad data never crashes the process
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error("[content route error]", err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

function hasUpdateFields(data: Record<string, any>): boolean {
  return Object.keys(data || {}).length > 0;
}

/* ========== ARTICLES ========== */
router.get("/admin/articles",
  requireAdmin,
  asyncHandler(async (_req: any, res: any) => {
    const rows = await db
      .select()
      .from(articles)
      .orderBy(desc(articles.createdAt));

    res.json(rows);
  })
);
router.get("/articles",
  asyncHandler(async (_req: any, res: any) => {
    const rows = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.isPublished, true),
          ne(articles.category, "Legal")
        )
      )
      .orderBy(desc(articles.createdAt));
    res.json(rows);
  })
);
router.get("/articles/:slug",
  asyncHandler(async (req: any, res: any) => {
    const [row] = await db.select().from(articles).where(eq(articles.slug, req.params.slug));
    if (!row) return res.status(404).json({ message: "Article not found" });
    res.json(row);
  })
);
router.post("/admin/articles",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertArticleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    const slug = parsed.data.slug || slugify(parsed.data.title) + "-" + Math.random().toString(36).slice(2, 6);
    const [row] = await db.insert(articles).values({ ...parsed.data, slug }).returning();
    res.json(row);
  })
);

router.put("/admin/articles/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertArticleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    if (!hasUpdateFields(parsed.data)) return res.status(400).json({ message: "No fields to update" });
    const [row] = await db.update(articles).set(parsed.data).where(eq(articles.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  })
);

router.delete("/admin/articles/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    await db.delete(articles).where(eq(articles.id, req.params.id));
    res.json({ ok: true });
  })
);

router.get("/legal/:type",
  asyncHandler(async (req: any, res: any) => {
    const [row] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.category, "Legal"),
          eq(articles.legalType, req.params.type)
        )
      );

    if (!row) {
      return res.status(404).json({
        message: "Document not found",
      });
    }

    res.json(row);
  })
);

/* ========== TRAVEL PACKAGES ========== */
router.get("/travel",
  asyncHandler(async (_req: any, res: any) => {
    const rows = await db
      .select()
      .from(travelPackages)
      .where(eq(travelPackages.isActive, true))
      .orderBy(desc(travelPackages.createdAt));
    res.json(rows);
  })
);

router.get("/travel/:slug",
  asyncHandler(async (req: any, res: any) => {
    const [row] = await db.select().from(travelPackages).where(eq(travelPackages.slug, req.params.slug));
    if (!row) return res.status(404).json({ message: "Package not found" });
    res.json(row);
  })
);

router.post("/admin/travel",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertTravelPackageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    const slug = parsed.data.slug || slugify(parsed.data.title) + "-" + Math.random().toString(36).slice(2, 6);
    const [row] = await db.insert(travelPackages).values({ ...parsed.data, slug }).returning();
    res.json(row);
  })
);

router.put("/admin/travel/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertTravelPackageSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    if (!hasUpdateFields(parsed.data)) return res.status(400).json({ message: "No fields to update" });
    const [row] = await db.update(travelPackages).set(parsed.data).where(eq(travelPackages.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  })
);

router.delete("/admin/travel/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    await db.delete(travelPackages).where(eq(travelPackages.id, req.params.id));
    res.json({ ok: true });
  })
);

/* ========== RECREATION SERVICES ========== */
router.get("/recreation",
  asyncHandler(async (_req: any, res: any) => {
    const rows = await db
      .select()
      .from(recreationServices)
      .where(eq(recreationServices.isActive, true))
      .orderBy(desc(recreationServices.createdAt));
    res.json(rows);
  })
);

router.get("/recreation/:slug",
  asyncHandler(async (req: any, res: any) => {
    const [row] = await db.select().from(recreationServices).where(eq(recreationServices.slug, req.params.slug));
    if (!row) return res.status(404).json({ message: "Service not found" });
    res.json(row);
  })
);

router.post("/admin/recreation",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertRecreationServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    const slug = parsed.data.slug || slugify(parsed.data.name) + "-" + Math.random().toString(36).slice(2, 6);
    const [row] = await db.insert(recreationServices).values({ ...parsed.data, slug }).returning();
    res.json(row);
  })
);

router.put("/admin/recreation/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertRecreationServiceSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    if (!hasUpdateFields(parsed.data)) return res.status(400).json({ message: "No fields to update" });
    const [row] = await db.update(recreationServices).set(parsed.data).where(eq(recreationServices.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  })
);

router.delete("/admin/recreation/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    await db.delete(recreationServices).where(eq(recreationServices.id, req.params.id));
    res.json({ ok: true });
  })
);

/* ========== TOURNAMENTS (events) ========== */
router.get("/event-tournaments",
  asyncHandler(async (_req: any, res: any) => {
    const rows = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
    res.json(rows);
  })
);

router.get("/event-tournaments/:slug",
  asyncHandler(async (req: any, res: any) => {
    const [row] = await db.select().from(tournaments).where(eq(tournaments.slug, req.params.slug));
    if (!row) return res.status(404).json({ message: "Tournament not found" });
    res.json(row);
  })
);

router.post("/admin/event-tournaments",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertTournamentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    const slug = parsed.data.slug || slugify(parsed.data.name) + "-" + Math.random().toString(36).slice(2, 6);
    const [row] = await db.insert(tournaments).values({ ...parsed.data, slug }).returning();
    res.json(row);
  })
);

router.put("/admin/event-tournaments/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    const parsed = insertTournamentSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error.flatten() });
    if (!hasUpdateFields(parsed.data)) return res.status(400).json({ message: "No fields to update" });
    const [row] = await db.update(tournaments).set(parsed.data).where(eq(tournaments.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  })
);

router.delete("/admin/event-tournaments/:id",
  requireAdmin,
  asyncHandler(async (req: any, res: any) => {
    await db.delete(tournaments).where(eq(tournaments.id, req.params.id));
    res.json({ ok: true });
  })
);

/* ========== ADMIN STATUS ========== */
router.get("/admin/status", (req: any, res: any) => {
  res.json({ isAdmin: !!req.user?.isAdmin, isAuthenticated: !!req.user });
});

/* ========== CLUBS SERVICES ========== */
router.get("/admin/clubs",
  requireAdmin,
  async (req, res, next) => {
    try {
      const clubs =
        await storage.getAllClubs();
      res.json(clubs);

    } catch (err) {
      next(err);
    }
  }
);

router.get("/admin/clubs/:id",
  requireAdmin,
  async (req, res, next) => {
    try {
      const club =
        await storage.getClubById(
          req.params.id
        );
      if (!club) {
        return res.status(404).json({
          message: "Club not found",
        });
      }
      res.json(club);
    } catch (err) {
      next(err);
    }
  }
);

router.post("/admin/clubs",
  requireAdmin,
  async (req, res, next) => {
    try {
      const result =
        insertClubSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.flatten(),
        });
      }
      const club =
        await storage.createClub(
          result.data
        );

      res.status(201).json(club);

    } catch (err) {
      next(err);

    }
  }
);

router.put("/admin/clubs/:id",
  requireAdmin,
  async (req, res, next) => {
    try {

      const result =
        insertClubSchema.partial().safeParse(req.body);

      if (!result.success) {

        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.flatten(),
        });
      }
      const club =
        await storage.updateClub(
          req.params.id,
          result.data
        );
      res.json(club);

    } catch (err) {
      next(err);
    }
  }
);

router.delete("/admin/clubs/:id",
  requireAdmin,
  async (req, res, next) => {
    try {

      const club =
        await storage.getClubById(
          req.params.id
        );

      if (!club) {
        return res.status(404).json({
          message: "Club not found",
        });

      }

      await storage.deleteClub(
        req.params.id
      );
      res.json({
        success: true,
        message: "Club deleted successfully",
      });

    } catch (err) {
      next(err);
    }
  }
);

router.patch("/admin/clubs/:id/publish",
  requireAdmin,
  async (req, res, next) => {
    try {

      const club = await storage.publishClub(
        req.params.id
      );
      res.json(club);

    } catch (err) {
      next(err);
    }
  }
);

router.patch("/admin/clubs/:id/unpublish",
  requireAdmin,
  async (req, res, next) => {
    try {
      const club = await storage.unpublishClub(
        req.params.id
      );
      res.json(club);
    } catch (err) {
      next(err);
    }
  }
);

router.patch("/admin/clubs/:id/archive",
  requireAdmin,
  async (req, res, next) => {
    try {
      const club = await storage.archiveClub(
        req.params.id
      );
      res.json(club);
    } catch (err) {
      next(err);
    }
  }
);

router.patch("/admin/clubs/:id/restore",
  requireAdmin,
  async (req, res, next) => {
    try {
      const club = await storage.restoreClub(
        req.params.id
      );
      res.json(club);
    } catch (err) {
      next(err);
    }
  }
);

router.patch("/admin/clubs/:id/listing",
  requireAdmin,
  async (req, res, next) => {
    try {
      const { listingType } = req.body;

      if (
        listingType !== "free" &&
        listingType !== "premium"
      ) {
        return res.status(400).json({
          message:
            "Listing type must be 'free' or 'premium'.",
        });
      }

      const club =
        await storage.updateClubListing(
          req.params.id,
          listingType
        );

      res.json(club);
    } catch (err) {
      next(err);
    }
  }
);

export default router;



