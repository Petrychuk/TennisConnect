import { ReactNode } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileCoverProps {
  cover?: string | null;
  isOwner: boolean;
  onEdit?: () => void;
  children?: ReactNode;
}

export function ProfileCover({
  cover,
  isOwner,
  onEdit,
}: ProfileCoverProps) {
  return (
    <div className="relative w-full h-[280px] sm:h-[300px] md:h-[380px] lg:h-[460px] overflow-hidden rounded-t-3xl group">

      {/* Cover Image */}
      <img
        src={cover ?? "/assets/images/default-cover.jpg"}
        alt="Profile Cover"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/25" />

      {/* Bottom Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-background via-background/60 to-transparent" />

      {/* Cover Edit Button */}
      {isOwner && (
        <Button
          size="icon"
          variant="secondary"
          onClick={onEdit}
          className="
            absolute
            right-4
            bottom-12
            md:right-6
            md:bottom-16
            lg:bottom-20
            z-30

            h-9
            w-9
            md:h-11
            md:w-11

            rounded-full
            bg-lime-400
            text-black

            shadow-xl
            border-2
            border-white/30

            backdrop-blur-sm

            opacity-100
            md:opacity-0
            md:group-hover:opacity-100

            transition-all
            duration-300
            hover:bg-lime-300
            hover:scale-110
          "
        >
          <Camera className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
      )}
    </div>
  );
}