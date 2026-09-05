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
        group relative inline-flex items-center gap-1.5 shrink-0
        cursor-pointer select-none px-2
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md
        ${fullWidth ? "w-full justify-center py-3" : "py-1.5"}
        ${className}
      `}
    >
      {/* The "brush stroke"/highlighter mark behind the text - a real
          SVG shape (previous version used a Tailwind arbitrary-value
          border-radius with a "/" in it, which Tailwind almost
          certainly parsed as an opacity-modifier separator instead of
          part of the radius value, silently dropping the whole
          utility). preserveAspectRatio="none" stretches this exact
          hand-drawn-ish path to fill the button regardless of how
          wide "Back the Rally" actually renders, so this doesn't need
          to know the text's pixel width ahead of time. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        className="
          absolute -inset-x-1.5 -inset-y-1
          text-[hsl(var(--tennis-ball))]
          -rotate-1 group-hover:rotate-0
          motion-safe:transition-transform motion-safe:duration-300
        "
      >
        <path
          d="M 2,8 C 20,3 65,2 98,5 C 99,13 99,20 97,26 C 65,29 22,28 3,25 C 1,19 1,13 2,8 Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>

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

