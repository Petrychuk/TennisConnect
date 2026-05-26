import { Router } from "express";
import { db } from "../db";
import { articles, travelPackages, recreationServices, tournaments } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  insertArticleSchema,
  insertTravelPackageSchema,
  insertRecreationServiceSchema,
  insertTournamentSchema,
} from "@shared/schema";
import { requireAuth } from "../requireAuth";
import { z } from "zod";

const router = Router();

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

/* ========== ARTICLES ========== */
router.get("/articles", async (_req, res) => {
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.isPublished, true))
    .orderBy(desc(articles.createdAt));
  res.json(rows);
});

router.get("/articles/:slug", async (req, res) => {
  const [row] = await db.select().from(articles).where(eq(articles.slug, req.params.slug));
  if (!row) return res.status(404).json({ message: "Article not found" });
  res.json(row);
});

router.post("/admin/articles", requireAdmin, async (req, res) => {
  const parsed = insertArticleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const slug = parsed.data.slug || slugify(parsed.data.title) + "-" + Math.random().toString(36).slice(2, 6);
  const [row] = await db.insert(articles).values({ ...parsed.data, slug }).returning();
  res.json(row);
});

router.put("/admin/articles/:id", requireAdmin, async (req, res) => {
  const parsed = insertArticleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const [row] = await db.update(articles).set(parsed.data).where(eq(articles.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

router.delete("/admin/articles/:id", requireAdmin, async (req, res) => {
  await db.delete(articles).where(eq(articles.id, req.params.id));
  res.json({ ok: true });
});

/* ========== TRAVEL PACKAGES ========== */
router.get("/travel", async (_req, res) => {
  const rows = await db
    .select()
    .from(travelPackages)
    .where(eq(travelPackages.isActive, true))
    .orderBy(desc(travelPackages.createdAt));
  res.json(rows);
});

router.get("/travel/:slug", async (req, res) => {
  const [row] = await db.select().from(travelPackages).where(eq(travelPackages.slug, req.params.slug));
  if (!row) return res.status(404).json({ message: "Package not found" });
  res.json(row);
});

router.post("/admin/travel", requireAdmin, async (req, res) => {
  const parsed = insertTravelPackageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const slug = parsed.data.slug || slugify(parsed.data.title) + "-" + Math.random().toString(36).slice(2, 6);
  const [row] = await db.insert(travelPackages).values({ ...parsed.data, slug }).returning();
  res.json(row);
});

router.put("/admin/travel/:id", requireAdmin, async (req, res) => {
  const parsed = insertTravelPackageSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const [row] = await db.update(travelPackages).set(parsed.data).where(eq(travelPackages.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

router.delete("/admin/travel/:id", requireAdmin, async (req, res) => {
  await db.delete(travelPackages).where(eq(travelPackages.id, req.params.id));
  res.json({ ok: true });
});

/* ========== RECREATION SERVICES ========== */
router.get("/recreation", async (_req, res) => {
  const rows = await db
    .select()
    .from(recreationServices)
    .where(eq(recreationServices.isActive, true))
    .orderBy(desc(recreationServices.createdAt));
  res.json(rows);
});

router.get("/recreation/:slug", async (req, res) => {
  const [row] = await db.select().from(recreationServices).where(eq(recreationServices.slug, req.params.slug));
  if (!row) return res.status(404).json({ message: "Service not found" });
  res.json(row);
});

router.post("/admin/recreation", requireAdmin, async (req, res) => {
  const parsed = insertRecreationServiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const slug = parsed.data.slug || slugify(parsed.data.name) + "-" + Math.random().toString(36).slice(2, 6);
  const [row] = await db.insert(recreationServices).values({ ...parsed.data, slug }).returning();
  res.json(row);
});

router.put("/admin/recreation/:id", requireAdmin, async (req, res) => {
  const parsed = insertRecreationServiceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const [row] = await db.update(recreationServices).set(parsed.data).where(eq(recreationServices.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

router.delete("/admin/recreation/:id", requireAdmin, async (req, res) => {
  await db.delete(recreationServices).where(eq(recreationServices.id, req.params.id));
  res.json({ ok: true });
});

/* ========== TOURNAMENTS (events) ========== */
router.get("/event-tournaments", async (_req, res) => {
  const rows = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
  res.json(rows);
});

router.get("/event-tournaments/:slug", async (req, res) => {
  const [row] = await db.select().from(tournaments).where(eq(tournaments.slug, req.params.slug));
  if (!row) return res.status(404).json({ message: "Tournament not found" });
  res.json(row);
});

router.post("/admin/event-tournaments", requireAdmin, async (req, res) => {
  const parsed = insertTournamentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const slug = parsed.data.slug || slugify(parsed.data.name) + "-" + Math.random().toString(36).slice(2, 6);
  const [row] = await db.insert(tournaments).values({ ...parsed.data, slug }).returning();
  res.json(row);
});

router.put("/admin/event-tournaments/:id", requireAdmin, async (req, res) => {
  const parsed = insertTournamentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid", errors: parsed.error });
  const [row] = await db.update(tournaments).set(parsed.data).where(eq(tournaments.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

router.delete("/admin/event-tournaments/:id", requireAdmin, async (req, res) => {
  await db.delete(tournaments).where(eq(tournaments.id, req.params.id));
  res.json({ ok: true });
});

/* ========== ADMIN STATUS ========== */
router.get("/admin/status", (req, res) => {
  res.json({ isAdmin: !!req.user?.isAdmin, isAuthenticated: !!req.user });
});

export default router;
