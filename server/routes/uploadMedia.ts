// server/routes/uploadMedia.ts
import { Router } from "express";
import multer from "multer";
import { supabaseAdmin } from "../supabaseAdmin";
import { requireAuth } from "../requireAuth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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
      if (!["avatar", "cover"].includes(type)) {
        return res.status(400).json({ message: "Invalid upload type" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      console.log("UPLOAD ROUTE HIT:", {
        type: req.params.type,
        user: req.user?.id,
        role: req.user?.role,
        hasFile: !!req.file,
        });

      const { id: userId, role } = req.user;
      // Use appropriate folder based on user role
      const folder = role === 'coach' ? `coaches/${userId}` : `players/${userId}`;
      const filePath = `${folder}/${type}.webp`;

      // 1. Загружаем файл в Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from("media")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
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

      // 3. Обновляем пользователя в БД и получаем свежие данные
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({ [type]: publicUrl })
        .eq("id", userId)
        .select()
        .single();

      if (updateError || !updatedUser) {
        throw new Error(`Failed to update user profile in DB: ${updateError?.message}`);
      }
      
      const urlWithCacheBuster = `${publicUrl}?t=${new Date().getTime()}`;

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

export default router;
