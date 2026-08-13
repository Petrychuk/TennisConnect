import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// GET /api/players
router.get("/", async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  
    const rows = await storage.getAllPlayers();
  
    const total = rows.length;
    const offset = (page - 1) * limit;

    const players = rows
      .slice(offset, offset + limit)
      .map(row => ({
        id: row.user.id,
        slug: row.user.slug,
        name: row.user.name,
        avatar: row.user.avatar,
        cover: row.user.cover,
        location: row.profile.location,
        skillLevel: row.profile.skillLevel,
        bio: row.profile.bio,
        isOrganizer: row.user.isOrganizer,
      }));
  
    res.json({
      players,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

// GET /api/players/:slug
router.get("/:slug", async (req, res) => {
  const user = await storage.getUserBySlug(req.params.slug);

  if (!user || user.role !== "player" || !user.profileCompleted) {
    return res.status(404).json({
      message: "Player not found",
    });
  }

  const profile = await storage.getPlayerProfile(user.id);

  res.json({
    user,
    profile,
  });
});

export default router;