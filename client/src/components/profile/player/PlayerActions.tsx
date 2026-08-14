import { Button } from "@/components/ui/button";
import { Edit2, Save } from "lucide-react";

interface PlayerActionsProps {
  isOwnProfile: boolean;
  isEditing: boolean;

  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PlayerActions({
  isOwnProfile,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: PlayerActionsProps) {
  if (!isOwnProfile) return null;

  if (isEditing) {
    return (
      <>
        {/* Mobile */}
        <div className="flex md:hidden justify-end gap-2 w-full">

          <Button
            variant="outline"
            onClick={onCancel}
            className="h-10 px-4 gap-2"
            data-testid="cancel-profile-mobile"
          >
            Cancel
          </Button>

          <Button
            onClick={onSave}
            className="h-10 px-4 gap-2"
            data-testid="save-profile-mobile"
          >
            <Save className="w-4 h-4" />
            Save
          </Button>

        </div>

        {/* Desktop */}

        <div className="hidden md:flex flex-col items-end gap-2">

          <Button
            onClick={onSave}
            className="
              h-10
              min-w-[150px]
              px-5
              gap-2
              text-sm
              font-medium
            "
            data-testid="save-profile"
          >
            <Save className="w-4 h-4" />
            Save Profile
          </Button>

          <Button
            variant="outline"
            onClick={onCancel}
            className="
              h-10
              min-w-[150px]
              px-5

              text-sm

              border-primary/30
              hover:border-primary
              hover:bg-primary/5
            "
            data-testid="cancel-profile"
          >
            Cancel
          </Button>

        </div>
      </>
    );
  }

  // Only this compact, view-only button pins to the card's corner on
  // mobile - the wider Cancel/Save row above stays in normal flow, or it
  // would collide with the avatar the same way this used to.
  return (
    <div className="absolute top-3 right-3 md:static">
      <Button
        variant="outline"
        onClick={onEdit}
        className="
          h-10
          w-10
          md:w-auto
          md:min-w-[150px]
          px-0
          md:px-5

          gap-0
          md:gap-2

          text-sm

          border-primary/30
          hover:border-primary
          hover:bg-primary/5
        "
        data-testid="edit-profile"
      >
        <Edit2 className="w-4 h-4" />
        <span className="hidden md:inline">Edit Profile</span>
      </Button>
    </div>
  );
}