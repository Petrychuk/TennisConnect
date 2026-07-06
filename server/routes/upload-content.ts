import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../requireAuth";
import { supabaseAdmin } from "../supabaseAdmin";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
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

router.post(
  "/",
  requireAuth,
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
                file.mimetype,
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