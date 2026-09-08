import { resizeImage } from "@/lib/image";

interface UploadMediaResponse {
  url: string;
  type: "avatar" | "cover";
  user: Record<string, unknown>;
}

// Shared by both profile pages (coach-profile.tsx, player-profile.tsx)
// for avatar/cover uploads - each used to POST the raw file straight to
// `/api/uploadMedia/:type` inline, duplicating the same ~20 lines twice
// and skipping any resize. Centralising it here means the resize only
// has to be added in one place, and both pages get it for free.
//
// Note: this used to point at `/api/upload/${type}`, a route that
// doesn't actually exist anywhere in the server (the real one is
// `/api/uploadMedia/:type` - see server/routes/uploadMedia.ts). Nothing
// called this specific function before now (the only usage was the
// orphaned AvatarUploader component, which isn't rendered anywhere), so
// that mismatch never surfaced as a live bug - fixed here as part of
// wiring it up for real.
export async function uploadMedia(
  type: "avatar" | "cover",
  file: File
): Promise<UploadMediaResponse> {
  const optimized = await resizeImage(file, type);

  const formData = new FormData();
  formData.append("file", optimized);

  const res = await fetch(`/api/uploadMedia/${type}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    console.error("uploadMedia: non-JSON response", text);
    throw new Error("Server returned a non-JSON response");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || `Upload failed (${res.status})`);
  }

  if (!data?.url || !data?.user) {
    throw new Error("Invalid server response");
  }

  return data;
}
