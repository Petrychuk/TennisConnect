import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../requireAuth";
import { storage } from "../storage";
import { insertTournamentHistorySchema } from "@shared/schema";
import * as imageService from "../services/tournamentHistoryImages";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* =========================
   PUBLIC
========================= */
// GET /api/profile/tournament-history?userId=xxx
router.get("/", async (req, res, next) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }

    // ✅ единственный источник — БД
    const tournaments = await storage.getUserTournamentHistory(userId);

    // photos уже лежат в БД
    res.json(
      tournaments.map(t => ({
        ...t,
        photos: Array.isArray(t.photos) ? t.photos : [],
      }))
    );
  } catch (e) {
    next(e);
  }
});

/* =========================
   PRIVATE (OWNER)
========================= */

// CREATE
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = insertTournamentHistorySchema.safeParse({
      ...req.body,
      userId: req.user!.id,
      photos: [], // ✅ всегда инициализируем
    });

    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const tournament = await storage.createTournamentHistory(parsed.data);

    res.json({
      ...tournament,
      photos: tournament.photos ?? [],
    });
  } catch (e) {
    next(e);
  }
});

// UPDATE
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const updated = await storage.updateTournamentHistory(
      req.params.id,
      req.user!.id,
      {
        name: req.body.name,
        location: req.body.location,
        date: req.body.date,
        result: req.body.result,
        award: req.body.award,
      }
    );

    res.json({
      ...updated,
      photos: updated.photos ?? [],
    });
  } catch (e) {
    next(e);
  }
});

// DELETE
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await storage.deleteTournamentHistory(
      req.params.id,
      req.user!.id
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* =========================
   PHOTOS
========================= */

// ADD PHOTO
router.post(
  "/:id/photos",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      // ✅ imageService сам обновляет БД
      const updatedTournament = await imageService.addPhoto({
        tournamentId: req.params.id,
        userId: req.user!.id,
        file: req.file,
      });
      // ✅ возвращаем обновлённый турнир ИЗ БД
      res.json({
        ...updatedTournament,
        photos: updatedTournament.photos ?? [],
      });
    } catch (e) {
      next(e);
    }
  }
);
// REMOVE PHOTO
router.delete("/:id/photos/:index", requireAuth, async (req, res, next) => {
  try {
    const updatedTournament = await imageService.removePhoto({
      tournamentId: req.params.id,
      userId: req.user!.id,
      index: Number(req.params.index),
    });
    res.json({
      ...updatedTournament,
      photos: updatedTournament.photos ?? [],
    });
  } catch (e) {
    next(e);
  }
});

export default router;
