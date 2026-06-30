import { ReactNode } from "react";

interface ProfileHeaderProps {
  children: ReactNode;
}

export function ProfileHeader({ children }: ProfileHeaderProps) {
  return (
    <div
      className="
        absolute
        left-0
        right-0
        bottom-0
        z-30

        container
        mx-auto
        px-4
      "
    >
      <div
        className="
          ml-0
          lg:ml-52

          rounded-3xl
          bg-background/90
          backdrop-blur-xl

          shadow-2xl

          border

          px-6
          py-6

          lg:px-8
          lg:py-8
        "
      >
        <div
          className="
            flex
            flex-col

            lg:flex-row

            lg:items-start
            lg:justify-between

            gap-6
          "
        >
          {children}
        </div>
      </div>
    </div>
  );
}