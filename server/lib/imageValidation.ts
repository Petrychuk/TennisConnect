// server/lib/imageValidation.ts
//
// Shared image-upload validation for multer routes. Two layers:
//   1. multer `fileFilter` rejects anything whose *declared* mimetype
//      isn't an allowed image type, before the body is even buffered.
//   2. `detectImageType` sniffs the first few bytes of the actual file
//      content (magic numbers) so a renamed/relabelled non-image file
//      can't slip through just because the client lied about the
//      Content-Type or file extension.
//
// Both checks are needed - (1) alone trusts the client completely,
// (2) alone still lets multer buffer arbitrarily-typed files into memory.

import type { FileFilterCallback } from "multer";
import type { Request } from "express";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export function multerImageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
) {
  if (
    ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as AllowedImageMimeType)
  ) {
    callback(null, true);
  } else {
    callback(
      Object.assign(
        new Error("Only JPEG, PNG, WEBP or GIF images are allowed"),
        { status: 400 },
      ),
    );
  }
}

// Sniffs the actual file bytes against known image magic numbers.
// Returns the real content type, or null if it doesn't match any
// supported image format (regardless of what the client claimed).
export function detectImageType(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // WEBP: "RIFF"....."WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}
