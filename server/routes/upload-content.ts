import { Router } from "express";
import multer from "multer";

import { requireAuth, requireAdmin } from "../requireAuth";
import { supabaseAdmin } from "../supabaseAdmin";
import { multerImageFileFilter, detectImageType } from "../lib/imageValidation";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: multerImageFileFilter,
});

const ALLOWED_FOLDERS = [
  "clubs",
  "travel",
  "articles",
  "recreation",
  "marketplace",
  "tournaments",
] as const;

const ALLOWED_TYPES = [
  "image",
  "logo",
  "cover",
] as const;

type Folder =
  (typeof ALLOWED_FOLDERS)[number];

type UploadType =
  (typeof ALLOWED_TYPES)[number];

// Admin-only: the only callers are the admin content-management UI
// (GalleryUploader / ImageUploader). Without requireAdmin here, any
// logged-in user could hit this route directly and upload/overwrite
// photos for any club/travel package/article by guessing its entityId.
router.post(
  "/",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  async (req, res, next) => {
    try {

      if (!req.user) {
        return res
          .status(401)
          .json({
            message: "Unauthorized",
          });
      }

      const file = req.file;

      if (!file) {
        return res
          .status(400)
          .json({
            message: "No file uploaded",
          });
      }

      const folder =
        req.body.folder as Folder;

      const entityId =
        req.body.entityId as string;

      const type =
        req.body.type as UploadType;

      if (
        !ALLOWED_FOLDERS.includes(folder)
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid folder",
          });
      }

      if (
        !ALLOWED_TYPES.includes(type)
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid image type",
          });
      }

      if (!entityId) {
        return res
          .status(400)
          .json({
            message:
              "entityId is required",
          });
      }

      // Belt-and-suspenders: fileFilter already checked the declared
      // mimetype, this checks the actual bytes so a relabelled non-image
      // file can't be smuggled through as "image/webp".
      const detectedType = detectImageType(file.buffer);
      if (!detectedType) {
        return res
          .status(400)
          .json({ message: "File content doesn't look like a valid image" });
      }
      
      // Storage Path

      const filePath =
        `${folder}/${entityId}/${type}.webp`;

     
      // Upload to Supabase Storage

      const { error: uploadError } =
        await supabaseAdmin.storage
          .from("media")
          .upload(
            filePath,
            file.buffer,
            {
              contentType:
                detectedType,
              upsert: true,
            }
          );

      if (uploadError) {
        throw new Error(
          `Supabase upload error: ${uploadError.message}`
        );
      }

      // Public URL

      const { data: publicData } =
        supabaseAdmin.storage
          .from("media")
          .getPublicUrl(filePath);

      if (!publicData?.publicUrl) {
        throw new Error(
          "Failed to get public URL"
        );
      }

      const url =
        `${publicData.publicUrl}?t=${Date.now()}`;

      // Success

      return res.status(200).json({

        success: true,
        url,
        path: filePath,
        folder,
        entityId,
        type,

      });
    } catch (err) {

      return next(err);

    }

  }
);

// Delete Image

router.delete(
  "/",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {

    try {

      if (!req.user) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const { path } = req.body;

      if (!path) {
        return res.status(400).json({
          message: "Path is required",
        });
      }

      const { error } =
        await supabaseAdmin.storage
          .from("media")
          .remove([path]);

      if (error) {
        throw new Error(error.message);
      }

      return res.status(200).json({

        success: true,

        path,

      });

    } catch (err) {

      return next(err);

    }

  }
);

export default router;
