import { Button } from "@/components/ui/button";
import { Edit2, Save } from "lucide-react";

interface PlayerActionsProps {
  isOwnProfile: boolean;
  isEditing: boolean;

  onEdit: () => void;
  onSave: () => void;
}

export function PlayerActions({
  isOwnProfile,
  isEditing,
  onEdit,
  onSave,
}: PlayerActionsProps) {
  if (!isOwnProfile) return null;

  return (
    <div
      className="
        flex
        justify-center
        lg:justify-end
        w-full
        md:w-auto
        shrink-0
      "
    >
      <Button
        onClick={isEditing ? onSave : onEdit}
        variant={isEditing ? "default" : "outline"}
        className="
          h-10
          lg:h-11
          px-3
          lg:px-3
          rounded-full
          w-full
          max-w-[220px]
          lg:w-auto
          lg:max-w-none
          lg:min-w-0
          whitespace-nowrap
          border
          border-primary
          bg-background
          text-muted-foreground
          hover:bg-primary
          hover:text-primary-foreground
          transition-all
          duration-200 "
        data-testid={
          isEditing
            ? "save-profile"
            : "edit-profile"
        }
      >
        {isEditing ? (
          <>
            <Save className="w-1 h-1" />
            Save Profile
          </>
        ) : (
          <>
            <Edit2 className="w-1 h-1" />
            Edit Profile
          </>
        )}
      </Button>
    </div>
  );
}