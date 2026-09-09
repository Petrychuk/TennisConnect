// client/src/lib/uploadContentImage.ts

import { resizeImage, type ImagePreset } from "@/lib/image";

export type ContentFolder =
  | "clubs"
  | "travel"
  | "articles"
  | "recreation"
  | "marketplace"
  | "tournaments";

export type ContentImageType =
  | "image"
  | "logo"
  | "cover";

interface UploadContentImageResponse {
  success: boolean;
  url: string;
  path: string;
  folder: ContentFolder;
  entityId: string;
  type: ContentImageType;
}

// ==========================================================
// Upload Content Image
// ==========================================================

// "logo" (club logos, always displayed in a square/circle slot) gets
// the same center-crop-to-square treatment as an avatar. "cover" gets
// the wide hero-banner treatment. Everything else ("image" - club,
// travel, article, recreation, marketplace and tournament photos) gets
// the general-purpose content preset - this single mapping is what
// makes every one of those upload flows resized, since they all go
// through this one function via ImageUploader/GalleryUploader.
const PRESET_BY_TYPE: Record<ContentImageType, ImagePreset> = {
  logo: "avatar",
  cover: "cover",
  image: "content",
};

export async function uploadContentImage(
  file: File,
  folder: ContentFolder,
  entityId: string,
  type: ContentImageType
): Promise<UploadContentImageResponse> {
  const optimized = await resizeImage(file, PRESET_BY_TYPE[type]);

  const formData = new FormData();

  formData.append("file", optimized);
  formData.append("folder", folder);
  formData.append("entityId", entityId);
  formData.append("type", type);

  const res = await fetch(
    "/api/upload/content",
    {
      method: "POST",
      body: formData,
      credentials: "include",
    }
  );

  if (!res.ok) {
    const text = await res.text();

    console.error(
      "Upload Content Image Error:",
      text
    );

    throw new Error(
      "Failed to upload image."
    );
  }

  return res.json();
}

// ==========================================================
// Delete Content Image
// ==========================================================

export async function deleteContentImage(
  path: string
): Promise<void> {
  const res = await fetch(
    "/api/upload/content",
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        path,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();

    console.error(
      "Delete Content Image Error:",
      text
    );

    throw new Error(
      "Failed to delete image."
    );
  }
}