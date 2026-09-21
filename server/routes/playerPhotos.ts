import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import multer from "multer";
import { requireAuth } from "../requireAuth";
import { supabaseAdmin } from "../supabaseAdmin";
import { storage } from "../storage";
import { multerImageFileFilter, detectImageType } from "../lib/imageValidation";

const router = Router();

// Duplicated from routes.ts's own (non-exported, local-only) requireRole
// - same behaviour, kept local here rather than changing routes.ts's
// export surface for one small helper.
function requireRole(role: "player" | "coach") {
  return (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.user!.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: multerImageFileFilter,
});

// POST /api/me/player-profile/photos - add one photo to the caller's
// OWN gallery. Always scoped to req.user!.id, never a photo/profile id
// from the request - there's nothing here for an IDOR to even target.
router.post("/", requireAuth, requireRole("player"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Same belt-and-suspenders as every other upload route in this app:
    // the fileFilter above only checked the declared mimetype - this
    // checks the actual bytes.
    const detectedType = detectImageType(req.file.buffer);
    if (!detectedType) {
      return res.status(400).json({ message: "File content doesn't look like a valid image" });
    }

    const userId = req.user!.id;
    const extension = detectedType.split("/")[1];
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const filePath = `players/${userId}/gallery/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("media")
      .upload(filePath, req.file.buffer, {
        contentType: detectedType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabaseAdmin.storage.from("media").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const profile = await storage.addPlayerProfilePhoto(userId, publicUrl);
    res.status(201).json(profile);
  } catch (err: any) {
    if (err?.message === "Maximum 8 photos allowed") {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
});

// DELETE /api/me/player-profile/photos - remove one photo by URL, from
// the caller's own gallery only.
router.delete("/", requireAuth, requireRole("player"), async (req, res, next) => {
  try {
    const { photoUrl } = req.body;
    if (!photoUrl || typeof photoUrl !== "string") {
      return res.status(400).json({ message: "photoUrl is required" });
    }

    const profile = await storage.removePlayerProfilePhoto(req.user!.id, photoUrl);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

export default router;
