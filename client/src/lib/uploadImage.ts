import { supabase } from "./supabaseClient";
import { resizeImage } from "./image";

export async function uploadImage(
  file: File,
  options: {
    bucket?: string;
    folder: string;
    replace?: boolean;
  }
): Promise<string> {
  const { bucket = "media", folder, replace = false } = options;

  // ✅ 1. Проверяем, что сессия ЕСТЬ
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("User is not authenticated");
  }

  // ✅ 2. resize
  const resizedBase64 = await resizeImage(file);
  const blob = await (await fetch(resizedBase64)).blob();

  const fileName = replace ? "image.webp" : `${crypto.randomUUID()}.webp`;
  const path = `${folder}/${fileName}`;

  // ✅ 3. upload
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      upsert: replace,
      contentType: "image/webp",
    });

  if (error) throw error;

  // ✅ 4. public url
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}
