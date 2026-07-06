// client/src/lib/uploadContentImage.ts

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

export async function uploadContentImage(
  file: File,
  folder: ContentFolder,
  entityId: string,
  type: ContentImageType
): Promise<UploadContentImageResponse> {
  const formData = new FormData();

  formData.append("file", file);
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