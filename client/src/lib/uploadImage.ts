
export async function uploadImage(
  type: "avatar" | "cover",
  file: File
): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`/api/upload/${type}`, {
    method: "POST",
     body: fd,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Upload error response:", text);
    throw new Error("Upload failed");
  }
  
  const data = await res.json();
  return res.json();
}
