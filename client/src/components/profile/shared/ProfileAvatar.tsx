import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileAvatarProps {
  avatar?: string | null;
  name: string;
  isOwner: boolean;
  onEdit?: () => void;
}

export function ProfileAvatar({
  avatar,
  name,
  isOwner,
  onEdit,
}: ProfileAvatarProps) {
  return (
    <div className="relative group">

      {/* Avatar */}
      <img
        src={avatar ?? "/assets/images/default-avatar.png"}
        alt={name}
        className="
          h-34
          w-34
          sm:h-32
          sm:w-32
          lg:h-60
          lg:w-60
          rounded-full
          object-cover
          border
          border-background
          shadow-2xl
         bg-white"
         data-testid="profile-avatar"
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

    </div>
  );
}