import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_AVATAR_URL } from "@/lib/defaultAvatar";

interface ProfileAvatarProps {
  avatar?: string | null;
  name: string;
  isOwner: boolean;
  onEdit?: () => void;
  // "tinted" (default) is the original light-primary-tint fallback,
  // unchanged for players. "solid" is a full-color fill - opt-in only,
  // so this shared component's default behavior never changes for
  // anything that doesn't explicitly ask for it.
  fallbackVariant?: "tinted" | "solid";
  // Small corner overlay (e.g. a certified-coach checkmark) - purely
  // presentational here, this component doesn't know what the badge
  // means, just where to put it. Sits bottom-left specifically so it
  // never overlaps the bottom-right edit/camera button.
  badge?: React.ReactNode;
}

const AVATAR_SIZE_CLASSES =
  "h-34 w-34 sm:h-32 sm:w-32 lg:h-60 lg:w-60 rounded-full border border-background shadow-2xl";

// Roughly a third of the avatar's own diameter at each breakpoint.
const BADGE_SIZE_CLASSES = "h-10 w-10 sm:h-10 sm:w-10 lg:h-16 lg:w-16";

export function ProfileAvatar({
  avatar,
  name,
  isOwner,
  onEdit,
  fallbackVariant = "tinted",
  badge,
}: ProfileAvatarProps) {
  return (
    <div className="relative group">

      {/* Avatar - falls back to the shared default avatar image (not a
          broken <img src=""> or an empty div) whenever the profile
          hasn't uploaded a photo yet. Same asset used on the player/
          coach listing cards so the "no photo" look is consistent
          everywhere, not just here. */}
      <img
        src={avatar || DEFAULT_AVATAR_URL}
        alt={name}
        className={cn(AVATAR_SIZE_CLASSES, "object-cover bg-white")}
        data-testid={avatar ? "profile-avatar" : "profile-avatar-initials"}
      />

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

      {/* Badge overlay (e.g. Certified Coach) */}
      {badge && (
        <div
          className={cn(
            BADGE_SIZE_CLASSES,
            "absolute bottom-1 left-1 flex items-center justify-center rounded-full border-2 border-background shadow-md bg-primary text-primary-foreground"
          )}
          data-testid="profile-avatar-badge"
        >
          {badge}
        </div>
      )}

    </div>
  );
}

