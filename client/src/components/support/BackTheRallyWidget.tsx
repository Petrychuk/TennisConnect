import { cn } from "@/lib/utils";
import buttonImage from "/assets/images/back-the-rally-button.webp";

interface BackTheRallyWidgetProps {
  className?: string;
  // Header uses the full-nav-height treatment; the mobile drawer
  // (after all nav links) uses the same component full-width instead
  // of introducing a second visual treatment for the same CTA.
  fullWidth?: boolean;
  onClick: () => void;
}

// One reusable trigger for both the desktop/tablet header slot (where
// the weather/time widget used to sit) and the mobile hamburger drawer
// - same component, same modal behind it either way (see
// BackTheRallyModal), just different layout context.
//
// This renders the supplied graphic directly (transparent background -
// the original had a light rounded-card frame around it that isn't
// wanted here, removed by keying out near-white/near-gray pixels with
// a smooth alpha falloff rather than a hard cutoff, so the brush
// stroke's own soft edges didn't turn into jagged pixel-stairs).
// A plain <button><img></button> rather than reproducing the
// composition in SVG/CSS text - the graphic is the source of truth for
// exactly how "Back the Rally" and its highlighter stroke look now,
// rather than an approximation of it. Aspect ratio is preserved at
// every size (w-auto against a fixed height) so it never looks
// stretched.
export function BackTheRallyWidget({
  className,
  fullWidth = false,
  onClick,
}: BackTheRallyWidgetProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="button-back-the-rally"
      aria-label="Back the Rally - support TennisConnect"
      className={cn(
        "group relative inline-flex items-center justify-center shrink-0",
        "bg-transparent border-0 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md",
        "transition-colors duration-150",
        fullWidth
          ? "w-full py-3"
          : [
              // Claims the nav's full height (h-16 = 64px) as its
              // clickable area rather than being a small pill inside
              // a much larger empty hit-target. No visible border
              // around it anymore (was a hairline border-l/border-r,
              // removed per feedback) - just padding, so it blends
              // into the header with nothing but hover feedback to
              // mark its edges.
              "self-stretch px-4",
              "hover:bg-primary/5",
            ],
        className
      )}
    >
      <img
        src={buttonImage}
        alt="Back the Rally - Support TennisConnect"
        className={cn(
          "w-auto object-contain",
          "motion-safe:transition-transform motion-safe:duration-200",
          "group-hover:-rotate-1 group-hover:scale-[1.04]",
          fullWidth ? "h-20 max-w-[340px]" : "h-12"
        )}
        draggable={false}
      />
    </button>
  );
}
