import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ProfileHeroCardProps {
  avatar: ReactNode;
  header: ReactNode;
  info?: ReactNode;
  actions: ReactNode;
  stats: ReactNode;
  // How see-through the white info card is. Player and coach profiles
  // want different amounts of transparency, so this isn't hardcoded.
  cardBackgroundClassName?: string;
}

export function ProfileHeroCard({
  avatar,
  header,
  info,
  actions,
  stats,
  cardBackgroundClassName = "bg-card/50",
}: ProfileHeroCardProps) {
  return (
    <div className="container mx-auto max-w-6xl sm:px-4 relative -mt-2 sm:-mt-6 md:-mt-16 lg:-mt-20 z-30">

      <div className="relative">

        {/* Avatar */}
        <div className="
            absolute
            z-40
            left-1/2
            -translate-x-full
            -top-10
            md:left-8
            md:translate-x-0
            md:-top-10
            lg:-left-[60px]
            lg:-top-14
            "
            >
          {avatar}
        </div>

        {/* Info Card — same glass treatment as the search/filter bars
            (bg-card/50 + backdrop-blur-md + border-border/40 + shadow-lg).
            `relative` here (not on the row below) so the mobile actions
            corner-pin below measures from this card's own edge, not from
            inside its px-4/px-8 padding - otherwise "the corner" ends up
            inset by that padding instead of sitting flush in it. */}
        <div
          className={cn(
            "relative mt-14 sm:mt-10 md:mt-0 rounded-2xl backdrop-blur-md border border-border/40 shadow-lg pt-28 sm:pt-28 md:pt-8 pb-5 sm:pb-7 md:pb-8 px-4 sm:px-5 md:px-8 md:pl-56",
            cardBackgroundClassName
          )}
        >
          {/* Header + Actions */}
          <div
            className="
              flex
              flex-col
              lg:flex-row
              lg:justify-between
              lg:items-start
              gap-6
            "
          >
            <div className="flex-1 min-w-0">
              {header}

              {info && (
                <div className="mt-3">
                  {info}
                </div>
              )}
            </div>

            {/* Positioning is left to the actions component itself now
                (not forced here): the compact "Edit Profile" icon button
                wants to pin to this card's corner on mobile, but the
                wider Cancel/Save row shown while editing does not - it
                needs to stay in normal flow or it collides with the
                avatar, which is exactly what corner-pinning it here
                unconditionally used to cause. */}
            <div className="shrink-0 self-center lg:self-start">
              {actions}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8">
            {stats}
          </div>

        </div>
      </div>
    </div>
  );
}