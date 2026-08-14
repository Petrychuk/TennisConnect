import { Edit2, MessageCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoachActionsProps {
  isOwner: boolean;
  isEditing: boolean;
  isAuthenticated: boolean;

  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onContact: () => void;
}

export function CoachActions({
  isOwner,
  isEditing,
  isAuthenticated,
  onEdit,
  onSave,
  onCancel,
  onContact,
}: CoachActionsProps) {
  // Owner
  if (isOwner) {
    return isEditing ? (
      <>
        {/* Mobile */}
        <div className="flex md:hidden justify-end gap-2 w-full">
  
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-10 px-4 gap-2"
            data-testid="cancel-coach-mobile"
          >
            Cancel
          </Button>
  
          <Button
            onClick={onSave}
            className="flex-1 gap-2"
            data-testid="save-coach-mobile"
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
          data-testid="save-coach"
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
          data-testid="cancel-coach"
        >
          Cancel
        </Button>

      </div>
      </>
    ) : (
      <Button
        variant="outline"
        size="lg"
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
        data-testid="edit-coach"
      >
        <Edit2 className="w-4 h-4" />
        <span className="hidden md:inline">Edit Profile</span>
      </Button>
    );
  }

  // Logged user
  if (isAuthenticated) {
    return (
      <Button
        size="lg"
        onClick={onContact}
        className="
          w-full
          md:w-auto
          gap-2
        "
        data-testid="contact-coach"
      >
        <MessageCircle className="w-4 h-4" />
        Contact Coach
      </Button>
    );
  }

  // Guest
  return null;
}