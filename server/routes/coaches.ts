import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// GET /api/coaches
router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 16));

  const rows = await storage.getAllCoachesWithProfiles();

  const total = rows.length;
  const offset = (page - 1) * limit;

  const coaches = rows
    .slice(offset, offset + limit)
    .map(row => ({
      id: row.user.id,
      slug: row.user.slug,
      name: row.user.name,
      avatar: row.user.avatar,
      cover: row.user.cover,
      location: row.profile.location,
      title: row.profile.title,
      bio: row.profile.bio,
      rate: row.profile.rate,
      isOrganizer: row.user.isOrganizer,
    }));

  res.json({
    coaches,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/coaches/:slug
router.get("/:slug", async (req, res) => {
  const user = await storage.getUserBySlug(req.params.slug);

  if (!user || user.role !== "coach") {
    return res.status(404).json({
      message: "Coach not found",
    });
  }

  const profile = await storage.getCoachProfile(user.id);

  res.json({
    user,
    profile,
  });
});

export default router;