import { ReactNode } from "react";

interface ProfileStatsProps {
  children: ReactNode;
}

export function ProfileStats({ children }: ProfileStatsProps) {
  return (
    <div
      className="
        mt-6
        grid
        grid-cols-4
        gap-1.5
        sm:gap-2
        md:gap-3
        lg:gap-4
      "
    >
      {children}
    </div>
  );
}