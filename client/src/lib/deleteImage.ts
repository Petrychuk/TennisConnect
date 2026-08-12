// Deletes go through our own backend now, not straight to Supabase from
// the browser with the public anon key - the server checks the file is
// actually inside *this* user's own folder before removing anything
// (see server/routes/uploadMedia.ts). Same call shape as before, so
// nothing calling this needs to change.
export async function deleteImage(publicUrl: string) {
  if (!publicUrl) return;

  const res = await fetch("/api/uploadMedia", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ url: publicUrl }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to delete image: ${text || res.status}`);
  }
}
