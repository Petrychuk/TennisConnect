import { resizeImage } from "@/lib/image";
import type { User } from "@/lib/auth-context";

interface UploadMediaResponse {
  url: string;
  type: "avatar" | "cover" | "session-cover";
  // Only present for avatar/cover - session-cover has no user record to
  // update (see the validation right below, and
  // server/routes/uploadMedia.ts's own session-cover branch).
  user?: User;
}

// Overloads so the return type reflects which `user` is actually
// guaranteed for a given `type`, without every avatar/cover call site
// needing its own runtime check or non-null assertion: calling with
// "avatar" | "cover" narrows the result to a required `user: User`
// (matching what the server always returns for those), calling with
// "session-cover" narrows it to `user?: undefined` (matching that the
// server never returns one for that type).
export async function uploadMedia(
  type: "avatar" | "cover",
  file: File
): Promise<UploadMediaResponse & { user: User }>;
export async function uploadMedia(
  type: "session-cover",
  file: File
): Promise<UploadMediaResponse & { user?: undefined }>;
// Shared by profile pages (coach-profile.tsx, player-profile.tsx) for
// avatar/cover uploads, and by the live-session cover-photo flow
// (tc-live-v0.1) for "session-cover" - each used to duplicate its own
// raw fetch straight to `/api/uploadMedia/:type` inline, skipping any
// resize. Centralising it here means the resize only has to be added
// in one place.
//
// This used to point at `/api/upload/${type}`, a route that matches
// no server route at all (the real one is `/api/uploadMedia/:type` -
// see server/routes/uploadMedia.ts). Fixed independently on both
// branches with slightly different framing - reconciled here rather
// than picking one over the other.
export async function uploadMedia(
  type: "avatar" | "cover" | "session-cover",
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

  if (!data?.url) {
    throw new Error("Invalid server response");
  }
  // "user" only ever comes back for avatar/cover (the server updates
  // and returns the owning user's record for those) - session-cover
  // deliberately has no user to update (see server/routes/uploadMedia.ts,
  // which returns just { url, type } for it) and correctly never
  // includes one. Requiring it unconditionally here made every
  // successful session-cover upload look like a failure - the server
  // returned 200 with the right { url, type } shape, but this check
  // threw anyway because data.user is legitimately undefined for that
  // type, not because anything actually went wrong.
  if (type !== "session-cover" && !data?.user) {
    throw new Error("Invalid server response");
  }

  return data;
}

// Backward-compatible alias - tc-live-v0.1 called this function
// uploadImage(). Kept so any caller on that branch I can't see from
// here doesn't break silently at runtime; safe to delete once nothing
// imports the old name anymore (search the repo for `uploadImage(`
// before removing it).
export const uploadImage = uploadMedia;