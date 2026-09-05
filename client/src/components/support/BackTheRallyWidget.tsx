import { ArrowRight } from "lucide-react";

interface BackTheRallyWidgetProps {
  className?: string;
  // Header uses the compact pill; the mobile drawer (after all nav
  // links) uses the same component full-width instead of introducing
  // a second visual treatment for the same CTA.
  fullWidth?: boolean;
  onClick: () => void;
}

// One reusable trigger for both the desktop/tablet header slot (where
// the weather/time widget used to sit) and the mobile hamburger drawer
// - same component, same modal behind it either way (see
// BackTheRallyModal), just different layout context.
export function BackTheRallyWidget({
  className = "",
  fullWidth = false,
  onClick,
}: BackTheRallyWidgetProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="button-back-the-rally"
      aria-label="Back the Rally - support TennisConnect"
      className={`
        group relative inline-flex items-center gap-2 shrink-0
        cursor-pointer select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full
        ${fullWidth ? "w-full justify-center py-3" : "px-1 py-1.5"}
        ${className}
      `}
    >
      {/* The "brush stroke"/highlighter mark behind the text - a plain
          CSS asymmetric border-radius blob (the classic "marker
          highlight" trick), not an image or SVG asset. Rotated very
          slightly for a hand-drawn feel; straightens out a touch on
          hover as the only motion here besides the arrow nudge -
          subtle and instant to disable via prefers-reduced-motion
          (see the motion-safe: prefixes below; without motion-safe
          support the transform simply never runs, so nothing needs a
          JS media-query check for this).  */}
      <span
        aria-hidden="true"
        className="
          absolute inset-y-0 left-6 right-0
          bg-[hsl(var(--tennis-ball))]/80
          -rotate-1 group-hover:rotate-0
          motion-safe:transition-transform motion-safe:duration-300
          rounded-[255px_15px_225px_15px/15px_225px_15px_255px]
        "
      />

      <span
        className="
          relative z-10 text-xl leading-none shrink-0
          motion-safe:transition-transform motion-safe:duration-300
          group-hover:-rotate-12
        "
        aria-hidden="true"
      >
        🎾
      </span>

      <span className="relative z-10 font-bold text-foreground whitespace-nowrap">
        Back the Rally
      </span>

      <ArrowRight
        aria-hidden="true"
        className="
          relative z-10 w-4 h-4 shrink-0 text-foreground
          motion-safe:transition-transform motion-safe:duration-300
          group-hover:translate-x-1
        "
      />
    </button>
  );
}
