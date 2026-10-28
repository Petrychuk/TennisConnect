import * as React from "react";
import { cn } from "@/lib/utils";

/*
  The label above a page hero title ("Now live in Sydney", "Find best
  player", ...). Every hero uses this one component so the labels share
  one TennisConnect look instead of the generic translucent pill:

  - an opaque near-black pill, so the white text stays readable on any
    photo (the translucent pill blended into the image);
  - a lime tracer that runs round the border like a ball along the court
    line, and a dot that pings like a ball landing (index.css,
    .tc-hero-badge). Both stop for prefers-reduced-motion.

  `icon` replaces the dot (e.g. a plane on /travels). `size="sm"` is the
  smaller phone version that overlaps the bottom edge of the photo.
*/

export interface HeroBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  size?: "sm" | "default";
}

export function HeroBadge({ icon, size = "default", className, children, ...props }: HeroBadgeProps) {
  return (
    <div
      className={cn(
        "tc-hero-badge inline-flex items-center gap-2 rounded-full text-white",
        size === "sm" ? "px-3 py-1" : "px-3.5 py-1.5",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0 text-primary [&_svg]:size-3.5">
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" className="tc-hero-badge-dot size-2 shrink-0 rounded-full bg-primary" />
      )}
      <span
        className={cn(
          "font-bold uppercase leading-none tracking-wider",
          size === "sm" ? "text-[10px]" : "text-xs md:text-sm",
        )}
      >
        {children}
      </span>
    </div>
  );
}
