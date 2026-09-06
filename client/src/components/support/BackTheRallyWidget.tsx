import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
        // Previously this was a plain template-string concatenation
        // ending in `${className}` - since the base classes already
        // hardcoded inline-flex, a caller passing "hidden md:inline-flex"
        // had no guaranteed way to actually win the cascade (Tailwind
        // orders utilities by their own internal registration in the
        // compiled stylesheet, not by where they appear in the class
        // attribute), which is very likely why this was still showing
        // up on mobile despite the "hidden" class being present in the
        // DOM. cn() runs tailwind-merge, which resolves same-property
        // conflicts before they ever reach the DOM - the caller's
        // className now reliably wins.
        "group relative inline-flex flex-col items-center justify-center shrink-0",
        "bg-transparent border-0 cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md",
        "transition-colors duration-150",
        fullWidth
          ? "w-full py-3"
          : [
              // The header slot claims the nav's full height (h-16 =
              // 64px, matching the target 64-70px range) rather than
              // being a small pill floating inside it - the whole
              // area is clickable, but only the brush-stroke span
              // below is visually green, not this outer button.
              "self-stretch min-w-[220px] px-6",
              "border-l border-r border-black/[0.06] dark:border-white/[0.06]",
              "hover:bg-primary/5",
            ],
        className
      )}
    >
      <span className="relative inline-flex flex-col items-center">
        {/* The brush-stroke mark and the text rotate together as one
            unit (matches a highlighter actually being dragged across
            the words at an angle) - a real SVG shape rather than a
            CSS border-radius/pseudo-element trick, so it doesn't
            depend on how a given browser resolves a particular
            Tailwind arbitrary-value edge case (an earlier version hit
            exactly that: a "/" inside a bracket value was almost
            certainly parsed as an opacity-modifier separator instead
            of part of the value, silently dropping the whole utility). */}
        <span
          className="
            relative inline-flex items-center gap-2 px-2.5 py-1
            -rotate-2 group-hover:-rotate-3 group-hover:scale-[1.03]
            motion-safe:transition-transform motion-safe:duration-200
          "
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            className="absolute -left-2 -right-2 -top-1.5 -bottom-1 text-[hsl(var(--tennis-ball))]"
          >
            <path
              d="M 2,10 C 20,4 65,2 98,6 C 99,14 99,20 97,25 C 65,29 22,27 3,24 C 1,18 1,14 2,10 Z"
              fill="currentColor"
              opacity="0.9"
            />
          </svg>

          <span
            className="relative z-10 text-foreground whitespace-nowrap"
            style={{ fontFamily: '"Caveat", "Segoe Print", cursive', fontSize: "23px", fontWeight: 700, lineHeight: 1 }}
          >
            Back the Rally
          </span>

          <ArrowRight
            aria-hidden="true"
            className="
              relative z-10 w-4 h-4 shrink-0 text-foreground
              motion-safe:transition-transform motion-safe:duration-200
              group-hover:translate-x-1
            "
          />
        </span>

        {/* Subtitle - plain text below the highlighted line, no brush
            mark of its own. */}
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground whitespace-nowrap -mt-0.5">
          Support TennisConnect
        </span>
      </span>
    </button>
  );
}
