
export async function uploadImage(
  type: "avatar" | "cover" | "session-cover",
  file: File
): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);

  // Router is mounted at /api/uploadMedia (see server/routes.ts) - this
  // used to point at /api/upload/${type}, which matches no server route
  // at all. In dev that falls through to Vite's SPA-fallback middleware,
  // which returns a 200 (so the request looks "successful" in the
  // Network tab) but with a body that isn't the JSON this function
  // expects - res.json() below then throws, and every caller (avatar
  // upload, session cover photo) surfaces that as a generic upload
  // failure with no indication the URL itself was wrong.
  const res = await fetch(`/api/uploadMedia/${type}`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Upload error response:", text);
    throw new Error("Upload failed");
  }
  
  return res.json();
}
