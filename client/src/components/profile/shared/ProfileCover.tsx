import { ReactNode } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import genericDefaultCover from "/assets/images/cinematic_tennis_court_abstract_background.webp";

interface ProfileCoverProps {
  cover?: string | null;
  isOwner: boolean;
  onEdit?: () => void;
  children?: ReactNode;
  // Role-specific branded default (player vs coach). Falls back to a
  // generic tennis-court image if a page doesn't pass one.
  defaultCover?: string;
  // A separate, purpose-cropped version of defaultCover for narrow
  // screens - the branded defaults are an ultra-wide banner (~2.7:1)
  // with a headline, icon row and taglines spread across nearly the
  // full width; on a phone-width viewport, a plain object-cover crop
  // of that same wide image only ever shows a thin vertical sliver of
  // its centre, and depending on exactly which sliver, that can cut
  // the icon row in half. This is a dedicated centre crop (kept
  // reasonably tight around the headline + icons, dropping the
  // decorative side taglines that were never going to fit on a phone
  // anyway) rather than relying on the browser to crop the wide
  // version live. Only used when cover (the user's own photo) is
  // absent - a real uploaded cover still just uses defaultCover's
  // breakpoint-driven height + object-cover, since we have no
  // per-user mobile crop for those.
  defaultCoverMobile?: string;
}

export function ProfileCover({
  cover,
  isOwner,
  onEdit,
  defaultCover,
  defaultCoverMobile,
}: ProfileCoverProps) {
  const fallback = defaultCover || genericDefaultCover;
  // Showing the full, uncropped default banner (not object-cover
  // slicing off its top/bottom) needs the container's own aspect
  // ratio to match the image's, at both breakpoints - a fixed pixel
  // height, sized for a REAL uploaded cover of any random aspect
  // ratio, was cropping into this specific image's important content
  // instead. 1000x721 is the mobile crop's own ratio,
  // 2000x750 (=8:3) is the desktop banner's. A real user-uploaded
  // cover keeps the original fixed-height behaviour untouched.
  const isDefault = !cover && defaultCoverMobile;

  return (
    <div className={`relative w-full overflow-hidden rounded-t-3xl group ${isDefault ? "aspect-[1000/721] sm:aspect-[8/3]" : "h-[280px] sm:h-[300px] md:h-[380px] lg:h-[460px]"}`}>

      {/* Cover Image — a single bundled default when the user has none,
          so there's nothing to swap once their real data loads. The
          default specifically gets a dedicated mobile crop (see
          defaultCoverMobile's own comment above); a real user-uploaded
          cover just uses the one image at every breakpoint, same as
          before. */}
      {!cover && defaultCoverMobile ? (
        <picture>
          <source media="(min-width: 640px)" srcSet={fallback} />
          <img
            src={defaultCoverMobile}
            alt="Profile Cover"
            data-testid="profile-cover"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        </picture>
      ) : (
        <img
          src={cover || fallback}
          alt="Profile Cover"
          data-testid="profile-cover"
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
      )}

      {/* Dark Overlay — the only scrim now. The old extra fade-to-background
          strip at the bottom sat exactly where the hero card overlaps,
          pre-opacifying the photo there and making the card's own
          translucency pointless no matter how see-through it was set to. */}
      <div className="absolute inset-0 bg-black/25" />

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
          data-testid="edit-cover-profile"
        >
          <Camera className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
      )}
    </div>
  );
}