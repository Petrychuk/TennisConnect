import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterIcon } from "@/components/shared/filters";
import { cn } from "@/lib/utils";

/*
  The search bar and quick shortcuts that sit in a page hero (Games,
  Players, ...). Purely presentational: every value and handler comes
  from the page, so each page keeps its own filtering logic exactly as
  it was. The page decides what "search" (the lime button / Enter) does,
  what the filters button opens, and which existing filters the
  shortcut icons switch on.

  - HeroSearch               the white pill: icon, input, filters slot,
                             lime search button. `tone="photo"` floats
                             on the hero image (tablet/desktop);
                             `tone="light"` sits on the page background
                             (phones).
  - HeroSearchFiltersButton  round sliders button with an active-count
                             badge, for the `filters` slot. forwardRef,
                             so it works as a PopoverTrigger child.
  - HeroShortcuts            the row of round icon toggles under the
                             search (aria-pressed). Swipeable on phones.
*/

type Tone = "photo" | "light";

export interface HeroSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  /** The lime button and Enter. */
  onSubmit: () => void;
  placeholder: string;
  /** Accessible name of the input (defaults to the placeholder). */
  label?: string;
  inputTestId?: string;
  submitTestId?: string;
  submitLabel?: string;
  /** Usually a <HeroSearchFiltersButton>, optionally wrapped in a Popover. */
  filters?: React.ReactNode;
  busy?: boolean;
  tone?: Tone;
  className?: string;
}

export function HeroSearch({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  label,
  inputTestId,
  submitTestId,
  submitLabel = "Search",
  filters,
  busy = false,
  tone = "photo",
  className,
}: HeroSearchProps) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn(
        "flex w-full items-center gap-1 rounded-full border bg-background pl-4 pr-1.5 transition-colors",
        // Focus: a thin (1px) dark-green outline, not a thick ring.
        "focus-within:border-primary-text",
        tone === "photo"
          ? "h-14 border-transparent shadow-[0_10px_30px_-10px_rgb(0_0_0/0.55)] md:h-[68px] md:pl-6"
          : "h-12 border-border shadow-sm",
        className,
      )}
    >
      <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground md:size-6" />
      <input
        type="text"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none md:text-lg"
        data-testid={inputTestId}
      />
      {filters}
      <Button
        type="submit"
        size="icon"
        aria-label={submitLabel}
        disabled={busy}
        className={cn("shrink-0 rounded-full [&_svg]:size-5", tone === "photo" ? "size-11 md:size-[52px] md:[&_svg]:size-6" : "size-9 [&_svg]:size-4")}
        data-testid={submitTestId}
      >
        <Search aria-hidden="true" className="size-5" />
      </Button>
    </form>
  );
}

export interface HeroSearchFiltersButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  activeCount?: number;
  label?: string;
}

export const HeroSearchFiltersButton = React.forwardRef<HTMLButtonElement, HeroSearchFiltersButtonProps>(
  ({ activeCount = 0, label = "Filters", className, ...props }, ref) => {
    const active = activeCount > 0;
    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={active ? `${label} (${activeCount} active)` : label}
        data-active={active ? "true" : undefined}
        className={cn("relative shrink-0 rounded-full text-foreground md:size-12", active && "text-primary-text", className)}
        {...props}
      >
        <FilterIcon className="size-5 md:size-6" />
        {active && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-primary-text px-1 text-[11px] font-bold leading-none text-white"
          >
            {activeCount}
          </span>
        )}
      </Button>
    );
  },
);
HeroSearchFiltersButton.displayName = "HeroSearchFiltersButton";

export interface HeroShortcut {
  key: string;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  testId?: string;
}

export interface HeroShortcutsProps {
  items: HeroShortcut[];
  /** Name of the group for screen readers, e.g. "Quick filters". */
  label: string;
  tone?: Tone;
  className?: string;
  testId?: string;
  /** Phones show only the first N shortcuts (the rest stay reachable in
   *  the Filters panel), so the row fits without scrolling. */
  maxOnPhone?: number;
}

export function HeroShortcuts({ items, label, tone = "photo", className, testId, maxOnPhone = 4 }: HeroShortcutsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cn(
        // Phones: one swipeable row (scrollbar hidden), edge to edge.
        // Tablet and up: wraps, never scrolls.
        "-mx-4 flex gap-1 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:gap-x-4 md:gap-y-2 md:overflow-visible md:px-0",
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.selected}
          onClick={item.onClick}
          disabled={item.disabled}
          title={item.title}
          data-testid={item.testId}
          className={cn(
            "group/sc flex min-w-[76px] shrink-0 flex-1 flex-col items-center gap-1.5 md:flex-none rounded-button px-1.5 py-1 text-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            tone === "photo" ? "md:min-w-[112px]" : "",
            index >= maxOnPhone && "max-md:hidden",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-11 items-center justify-center rounded-full transition-colors [&_svg]:size-5 md:size-14 md:[&_svg]:size-6",
              item.selected
                ? "bg-primary text-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]"
                : tone === "photo"
                  ? "bg-black/45 text-white ring-1 ring-white/25 backdrop-blur-md group-hover/sc:bg-black/60"
                  : "bg-secondary text-foreground group-hover/sc:bg-secondary-hover",
            )}
          >
            {item.icon}
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-xs font-semibold leading-tight md:text-base",
              tone === "photo" ? "text-white tc-hero-text" : "text-foreground",
              // Selected: a lime underline (lime text would be unreadable
              // on light photos and on white).
              item.selected && "underline decoration-primary decoration-2 underline-offset-4",
            )}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
