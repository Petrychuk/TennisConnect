import { useRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { uploadImage } from "@/lib/uploadImage";
import { useAuth } from "@/lib/auth-context";

export function AvatarUploader({ size = 40 }: { size?: number }) {
  const { user, updateUserProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1️⃣ upload через backend → Supabase Storage
      const { url } = await uploadImage("avatar", file);

      // 2️⃣ cache-busting (КЛЮЧЕВО!)
      const avatarUrl = `${url}?v=${Date.now()}`;

      // 3️⃣ обновляем AuthContext (хедер + профиль)
      await updateUserProfile({ avatar: avatarUrl });

    } catch (err) {
      console.error("Avatar upload failed", err);
    } finally {
      // 4️⃣ позволяем выбрать тот же файл ещё раз
      e.target.value = "";
    }
  };

  return (
    <>
      <Avatar
        style={{ width: size, height: size, cursor: "pointer" }}
        onClick={() => inputRef.current?.click()}
      >
        <AvatarImage src={user.avatar ?? undefined} />
        <AvatarFallback>
          {user.name?.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={handleChange}
      />
    </>
  );
}
