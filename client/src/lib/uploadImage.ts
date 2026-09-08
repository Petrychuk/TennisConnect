import { resizeImage } from "@/lib/image";
import type { User } from "@/lib/auth-context";

interface UploadMediaResponse {
  url: string;
  type: "avatar" | "cover";
  user: User;
}

// Shared by both profile pages (coach-profile.tsx, player-profile.tsx)
// for avatar/cover uploads - each used to POST the raw file straight to
// `/api/uploadMedia/:type` inline, duplicating the same ~20 lines twice
// and skipping any resize. Centralising it here means the resize only
// has to be added in one place, and both pages get it for free.
//
// This used to point at `/api/upload/${type}`, a route that doesn't
// actually exist anywhere in the server (the real one is
// `/api/uploadMedia/:type` - see server/routes/uploadMedia.ts). The only
// caller pointed at that broken path was an AvatarUploader component
// that wasn't rendered anywhere in the app either - removed rather than
// fixed, since coach-profile.tsx/player-profile.tsx already cover the
// same "click the avatar to change it" flow for real.
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
