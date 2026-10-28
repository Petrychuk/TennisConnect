import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
  Shared filter controls - one look for every "Filters" control on the
  site (players, coaches, clubs, articles, play, organiser hub).

  - FilterIcon       the single filter glyph (sliders), always 16px.
  - FilterTrigger    the button that opens a filter panel. Outline button;
                     turns brand-active (pale lime + dark-green border and
                     text) when filters are applied, with a count badge.
                     `iconOnly` for tight mobile bars: the label moves into
                     aria-label (with the active count), the badge stays.
  - FilterChip       a quick on/off filter (This week, a category, a
                     service). A toggle button: aria-pressed, the lime
                     button when on, the outline button when off. `compact`
                     for dense multi-select lists inside a panel.

  All three are built on <Button>, so they share its radius (12px),
  focus ring, typography and disabled state.
*/

/**
 * Container for a row of FilterChips. Phones: one swipeable row with the
 * scrollbar hidden; tablet and up: chips wrap instead of scrolling. The
 * 4px padding (cancelled by a -4px margin) keeps the 2px focus ring and
 * its offset inside the row - without it a focused or pressed chip made
 * the row overflow and the browser showed scrollbars after a click.
 */
export const FILTER_CHIP_ROW =
  "-m-1 flex items-center gap-2 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible";

export function FilterIcon({ className }: { className?: string }) {
  return <SlidersHorizontal aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}

export interface FilterTriggerProps extends Omit<ButtonProps, "variant" | "size"> {
  /** Number of filters currently applied (0 / undefined = none). */
  activeCount?: number;
  /** Visible label; also the accessible name when iconOnly. */
  label?: string;
  iconOnly?: boolean;
}

export const FilterTrigger = React.forwardRef<HTMLButtonElement, FilterTriggerProps>(
  ({ activeCount = 0, label = "Filters", iconOnly = false, className, ...props }, ref) => {
    const active = activeCount > 0;
    const accessibleName = active ? `${label} (${activeCount} active)` : label;
    return (
      <Button
        ref={ref}
        type="button"
        variant="outline"
        size={iconOnly ? "icon" : "default"}
        aria-label={iconOnly ? accessibleName : undefined}
        data-active={active ? "true" : undefined}
        className={cn(
          "relative shrink-0",
          className,
          // last, so a page's own surface colour can't hide the active state
          active && "border-primary-text bg-accent text-primary-text hover:bg-accent hover:text-primary-text",
        )}
        {...props}
      >
        <FilterIcon />
        {!iconOnly && label}
        {active && (
          <span
            aria-hidden={iconOnly ? "true" : undefined}
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-text px-1 text-[11px] font-bold leading-none text-white",
              iconOnly && "absolute -top-1.5 -right-1.5 border-2 border-background",
            )}
          >
            {activeCount}
            {!iconOnly && <span className="sr-only"> active</span>}
          </span>
        )}
      </Button>
    );
  },
);
FilterTrigger.displayName = "FilterTrigger";

export interface FilterChipProps extends Omit<ButtonProps, "variant" | "size"> {
  selected: boolean;
  compact?: boolean;
}

export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ selected, compact = false, className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      aria-pressed={selected}
      className={cn("shrink-0", compact && "min-h-7 px-2.5 text-xs", className)}
      {...props}
    />
  ),
);
FilterChip.displayName = "FilterChip";
