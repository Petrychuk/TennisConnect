import { supabase } from "./supabaseClient";

export async function deleteImage(publicUrl: string) {
  if (!publicUrl) return;

  const bucket = "media";
  const path = publicUrl.split(`/storage/v1/object/public/${bucket}/`)[1];

  if (!path) return;

  await supabase.storage.from(bucket).remove([path]);
}
