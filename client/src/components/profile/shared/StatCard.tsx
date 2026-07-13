import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  subtitle?: string;

  clickable?: boolean;
  onClick?: () => void;

  className?: string;
  "data-testid"?: string;
}

export function StatCard({
  icon,
  value,
  label,
  subtitle,
  clickable = false,
  onClick,
  className,
  "data-testid": dataTestId,
}: StatCardProps) {
  return (
    <button
  type="button"
  disabled={!clickable}
  onClick={onClick}
  data-testid={dataTestId}
  className={cn(
    `
    rounded-xl
    border
    border-border/60

    bg-background/80
    backdrop-blur-sm

    p-2
    sm:p-2.5
    md:p-3
    lg:px-4
    lg:py-4

    transition-all
    duration-200

    hover:border-primary/30
    hover:bg-background

    text-left
    overflow-hidden
    `,
    className
  )}
>
  <div className="flex flex-col items-center text-center">
  <div
  className="
    flex
    items-center
    justify-center
    gap-1
    sm:gap-1.5
  "
>
  <div
    className="
      flex
      items-center
      justify-center

      w-5
      h-5

      sm:w-6
      sm:h-6

      md:w-8
      md:h-8

      rounded-md
      bg-primary/10

      text-primary

      shrink-0
    "
  >
    {icon}
  </div>

  <div
    className="
      text-sm
      sm:text-base
      md:text-xl

      font-bold
      leading-none

      text-muted-foreground

      whitespace-nowrap
      truncate
    "
  >
    {value}
  </div>
</div>
    {/* Label */}
    <div
      className="
        mt-1

        text-[9px]
        sm:text-[10px]
        md:text-xs

        font-medium
        uppercase
        tracking-wide

        text-muted-foreground

        whitespace-nowrap
        truncate
        max-w-full
      "
    >
      {label}
    </div>

    {/* Subtitle */}
    {subtitle && (
      <div
        className="
          hidden
          md:flex

          items-center
          gap-1

          mt-2

          text-[11px]
          text-muted-foreground
        "
      >
        <span>{subtitle}</span>

        {clickable && (
          <ChevronRight className="w-3 h-3" />
        )}
      </div>
    )}

  </div>
</button>
  );
}