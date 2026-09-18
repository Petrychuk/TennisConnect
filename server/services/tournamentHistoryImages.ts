import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { supabaseAdmin } from "../supabaseAdmin";
import { detectImageType } from "../lib/imageValidation";

const MAX_PHOTOS = 5;

interface AddPhotoArgs {
  tournamentId: string;
  userId: string;
  file: Express.Multer.File;
}

interface RemovePhotoArgs {
  tournamentId: string;
  userId: string;
  index: number;
}

/* =========================
   ADD PHOTO
========================= */
export async function addPhoto({
  tournamentId,
  userId,
  file,
}: AddPhotoArgs) {
  const tournament = await storage.getTournamentOwnedByUser(
    tournamentId,
    userId
  );

  const photos: string[] = Array.isArray(tournament.photos)
    ? tournament.photos
    : [];

  if (photos.length >= MAX_PHOTOS) {
    throw new Error("Maximum 5 photos allowed");
  }

  // Belt-and-suspenders, same as uploadMedia.ts: the route's multer
  // fileFilter only checked the declared mimetype - this checks the
  // actual bytes so an HTML/SVG/script payload relabelled as an image
  // can't be smuggled in and served back with a browser-executable
  // content type. The extension AND filename are both fully
  // server-generated from here on - file.originalname (fully
  // attacker-controlled) never touches the storage path, since a
  // crafted name like "../../coaches/someone-else/avatar.webp" is
  // exactly the kind of thing an object-storage key should never be
  // built from directly.
  const detectedType = detectImageType(file.buffer);
  if (!detectedType) {
    throw new Error("File content doesn't look like a valid image");
  }
  const extension = detectedType.split("/")[1];

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const path = `players/${userId}/tournaments/${tournamentId}/${fileName}`;

  const uploadResult = await supabaseAdmin.storage
    .from("media")
    .upload(path, file.buffer, {
      contentType: detectedType,
      upsert: false,
    });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const { data } = supabaseAdmin.storage
    .from("media")
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Failed to get public URL");
  }

  // ⬅️ ОБНОВЛЯЕМ БД
  const updatedTournament = await storage.updateTournamentHistory(
    tournamentId,
    userId,
    {
      photos: [...photos, data.publicUrl],
    }
  );

  // ❗❗❗ ВАЖНО: возвращаем ТУРНИР, а не url
  return updatedTournament;
}

/* =========================
   REMOVE PHOTO
========================= */
export async function removePhoto({
  tournamentId,
  userId,
  index,
}: RemovePhotoArgs) {
  const tournament = await storage.getTournamentOwnedByUser(
    tournamentId,
    userId
  );

  const photos: string[] = tournament.photos ?? [];
  const url = photos[index];

  if (!url) {
    throw new Error("Photo not found");
  }

  const path = url.split("/storage/v1/object/public/media/")[1];

  await supabaseAdmin.storage.from("media").remove([path]);

  const updatedPhotos = photos.filter((_, i) => i !== index);

  return storage.updateTournamentHistory(tournamentId, userId, {
    photos: updatedPhotos,
  });
}
