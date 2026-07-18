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
  cardBackgroundClassName = "bg-background/90",
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

        {/* White Card */}
        <div
          className={cn(
            "mt-14 sm:mt-10 md:mt-0 rounded-2xl backdrop-blur-xl border shadow-xl pt-28 sm:pt-28 md:pt-8 pb-5 sm:pb-7 md:pb-8 px-4 sm:px-5 md:px-8 md:pl-56",
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

            <div
              className="shrink-0
                self-center
                lg:self-start"
            >
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