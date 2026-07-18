import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  avatar?: string | null;
  name: string;
  isOwner: boolean;
  onEdit?: () => void;
}

const INITIALS_COLORS = [
  "bg-primary",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

// Deterministic (not random) so the same person always gets the same
// color across renders/sessions, without needing to store one.
function getInitialsColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

const AVATAR_SIZE_CLASSES =
  "h-34 w-34 sm:h-32 sm:w-32 lg:h-60 lg:w-60 rounded-full border border-background shadow-2xl";

export function ProfileAvatar({
  avatar,
  name,
  isOwner,
  onEdit,
}: ProfileAvatarProps) {
  return (
    <div className="relative group">

      {/* Avatar */}
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className={cn(AVATAR_SIZE_CLASSES, "object-cover bg-white")}
          data-testid="profile-avatar"
        />
      ) : (
        <div
          className={cn(
            AVATAR_SIZE_CLASSES,
            "flex items-center justify-center text-white font-bold select-none",
            getInitialsColor(name || "?")
          )}
          data-testid="profile-avatar-initials"
        >
          <span className="text-3xl lg:text-6xl">{getInitials(name || "?")}</span>
        </div>
      )}

      {/* Camera Button */}
      {isOwner && (
        <Button
          size="icon"
          variant="secondary"
          onClick={onEdit}
          data-testid="edit-avatar-profile"
          className="
            absolute
            bottom-2
            right-2
            h-10
            w-10
            rounded-full
            bg-primary
            hover:bg-primary/90
            border-background
            shadow-lg
            opacity-0
            group-hover:opacity-100
            transition-all
            duration-300
            hover:scale-105"
        >
          <Camera className="w-5 h-5" />
        </Button>
      )}

    </div>
  );
}
