import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  avatar?: string | null;
  name: string;
  isOwner: boolean;
  onEdit?: () => void;
}

// Same look as the navbar's account-menu avatar fallback (light primary
// tint, primary-colored initial) so the "no photo" presentation is
// consistent across the app, not a separate style just for this page.
function getInitial(name: string) {
  return name?.trim()?.[0]?.toUpperCase() || "U";
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
            "flex items-center justify-center bg-primary/10 text-primary font-bold select-none"
          )}
          data-testid="profile-avatar-initials"
        >
          <span className="text-3xl lg:text-6xl">{getInitial(name)}</span>
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
