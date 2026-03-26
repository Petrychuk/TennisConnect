import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../requireAuth";
import { supabaseAdmin } from "../supabaseAdmin";
import { storage } from "../storage";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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
      req.body
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/* =========================================
   DELETE ITEM
========================================= */
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await storage.deleteMarketplaceItem(req.params.id);
    res.json({ success: true });
  } catch (err) {
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

      const fileName = `photo-${Date.now()}.webp`;
      const filePath = `marketplace/${userId}/${id}/${fileName}`;

      const { error } = await supabaseAdmin.storage
        .from("media")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabaseAdmin.storage
        .from("media")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const updatedItem = await storage.addMarketplacePhoto(
        id,
        publicUrl
      );

      res.json(updatedItem);
    } catch (err) {
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
        photoUrl
      );

      res.json(updatedItem);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
