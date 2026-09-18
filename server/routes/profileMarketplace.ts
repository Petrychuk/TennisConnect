import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../requireAuth";
import { supabaseAdmin } from "../supabaseAdmin";
import { storage } from "../storage";
import { multerImageFileFilter, detectImageType } from "../lib/imageValidation";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: multerImageFileFilter,
});

// PUBLIC VIEW
router.get("/public/:userId", async (req, res) => {
  const items = await storage.getUserMarketplaceItems(req.params.userId);
  res.json(items);
});

// PUBLIC: all marketplace items (for marketplace page)
router.get("/all", async (req, res, next) => {
  try {
    const items = await storage.getAllMarketplaceItems();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   GET MY MARKETPLACE ITEMS
========================================= */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const items = await storage.getUserMarketplaceItems(userId);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   CREATE ITEM
========================================= */
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const user = req.user!;
    const item = await storage.createMarketplaceItem({
      ...req.body,
      userId: user.id,
      sellerName: user.name,
      sellerEmail: user.email,
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   UPDATE ITEM
========================================= */
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const updated = await storage.updateMarketplaceItem(
      req.params.id,
      req.user!.id,
      req.body
    );

    res.json(updated);
  } catch (err: any) {
    if (err?.message === "Item not found or access denied") {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
});

/* =========================================
   DELETE ITEM
========================================= */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await storage.deleteMarketplaceItem(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err?.message === "Item not found or access denied") {
      return res.status(404).json({ message: err.message });
    }
    next(err);
  }
});

/* =========================================
   UPLOAD PHOTO
========================================= */
router.post(
  "/:id/photos",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Belt-and-suspenders, same as uploadMedia.ts: fileFilter above
      // only checked the declared mimetype - this checks the actual
      // bytes so an HTML/SVG/script payload relabelled as an image
      // can't be smuggled in and served back from the public bucket
      // with a browser-executable content type.
      const detectedType = detectImageType(req.file.buffer);
      if (!detectedType) {
        return res.status(400).json({ message: "File content doesn't look like a valid image" });
      }

      const fileName = `photo-${Date.now()}.webp`;
      const filePath = `marketplace/${userId}/${id}/${fileName}`;

      const { error } = await supabaseAdmin.storage
        .from("media")
        .upload(filePath, req.file.buffer, {
          contentType: detectedType,
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabaseAdmin.storage
        .from("media")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const updatedItem = await storage.addMarketplacePhoto(
        id,
        userId,
        publicUrl
      );

      res.json(updatedItem);
    } catch (err: any) {
      if (err?.message === "Item not found or access denied") {
        return res.status(404).json({ message: err.message });
      }
      next(err);
    }
  }
);

/* =========================================
   DELETE PHOTO
========================================= */
router.delete(
  "/:id/photos",
  requireAuth,
  async (req, res, next) => {
    try {
      const { photoUrl } = req.body;

      const updatedItem = await storage.removeMarketplacePhoto(
        req.params.id,
        req.user!.id,
        photoUrl
      );

      res.json(updatedItem);
    } catch (err: any) {
      if (err?.message === "Item not found or access denied") {
        return res.status(404).json({ message: err.message });
      }
      next(err);
    }
  }
);

export default router;
