// server/routes/uploadMedia.ts
import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth } from "../requireAuth";
import { storage } from "../storage";
import { multerImageFileFilter, detectImageType } from "../lib/imageValidation";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: multerImageFileFilter,
});

router.post(
  "/:type",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { type } = req.params;
      // "session-cover" is a distinct case below: unlike avatar/cover
      // (one fixed slot per user, always overwritten), an organizer can
      // have many sessions at once, each needing its own cover photo -
      // see client/src/components/organiser/sessions/wizard/step2-date-registration.tsx,
      // which used to inline the file as base64 straight into the
      // session JSON payload and blow past express.json()'s body-size
      // limit (413) for any real photo. Not a user field, so it must
      // skip the storage.updateUser(...) call below.
      if (!["avatar", "cover", "session-cover"].includes(type)) {
        return res.status(400).json({ message: "Invalid upload type" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Belt-and-suspenders: fileFilter already checked the declared
      // mimetype, this checks the actual bytes so a relabelled non-image
      // file can't be smuggled through as "image/webp".
      const detectedType = detectImageType(req.file.buffer);
      if (!detectedType) {
        return res
          .status(400)
          .json({ message: "File content doesn't look like a valid image" });
      }

      console.log("UPLOAD ROUTE HIT:", {
        type: req.params.type,
        user: req.user?.id,
        role: req.user?.role,
        hasFile: !!req.file,
        });

      const { id: userId, role } = req.user;
      // Use appropriate folder based on user role
      const folder = type === "session-cover" ? `sessions/${userId}` : role === 'coach' ? `coaches/${userId}` : `players/${userId}`;
      // avatar/cover: fixed filename, always overwritten (one slot per
      // user). session-cover: a fresh filename per upload, since a
      // second session's cover shouldn't clobber the first one's.
      const filePath = type === "session-cover" ? `${folder}/${crypto.randomUUID()}.webp` : `${folder}/${type}.webp`;

      // 1. Загружаем файл в Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from("media")
        .upload(filePath, req.file.buffer, {
          contentType: detectedType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Supabase upload error: ${uploadError.message}`);
      }

      // 2. Получаем "чистый" URL
      const { data: urlData } = supabaseAdmin.storage
        .from("media")
        .getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) {
        throw new Error("Failed to get public URL after upload");
      }

      // 3. Сохраняем URL со свежей версией (не голый путь) - иначе он
      //    не меняется между загрузками (upsert перезаписывает файл по
      //    тому же имени), и браузер/лендинг продолжают показывать
      //    закэшированную старую картинку по старому URL даже после
      //    успешной загрузки новой.
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      if (type === "session-cover") {
        return res.status(200).json({ url: urlWithCacheBuster, type });
      }

      const updatedUser = await storage.updateUser(userId, {
        [type]: urlWithCacheBuster,
      });

      // Создаем "чистый" объект пользователя вручную, чтобы избежать ошибок сериализации.
      const safeUserObject = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        slug: updatedUser.slug,
        avatar: updatedUser.avatar,
        cover: updatedUser.cover,
        status: updatedUser.status,
        profileCompleted: updatedUser.profileCompleted,
        createdAt: updatedUser.createdAt,
      };

      // 4. Возвращаем успешный и "безопасный" JSON-ответ
      return res.status(200).json({
        url: urlWithCacheBuster,
        type,
        user: { // Отправляем "чистый" объект
            ...safeUserObject,
            [type]: urlWithCacheBuster // и перезаписываем в нем поле аватара/обложки
        },
      });

    } catch (err) {
      // Передаем любую ошибку в глобальный обработчик
      return next(err);
    }
  }
);

// Delete a file the current user owns from the "media" bucket.
// Takes the public URL (same shape the upload route above returns, and
// what the client already has on hand for an avatar/cover/gallery photo)
// rather than a raw storage path - and only ever deletes something that
// resolves to *this* user's own folder ("coaches/{userId}/..." or
// "players/{userId}/..."), so one account can never delete another's
// files by guessing/knowing their path. This replaces deleting directly
// from the browser with the public Supabase key, which had no such check.
router.delete(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { url } = req.body as { url?: string };
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "url is required" });
      }

      const path = url.split("/storage/v1/object/public/media/")[1]?.split("?")[0];
      if (!path) {
        return res.status(400).json({ message: "Not a recognised media URL" });
      }

      const { id: userId, role } = req.user;
      const ownFolder = role === "coach" ? `coaches/${userId}/` : `players/${userId}/`;

      if (!path.startsWith(ownFolder)) {
        return res.status(403).json({ message: "You can only delete your own files" });
      }

      const { error } = await supabaseAdmin.storage.from("media").remove([path]);
      if (error) {
        throw new Error(`Supabase delete error: ${error.message}`);
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
