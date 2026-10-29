import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/*
  The Filters panel that opens from the sliders button in the hero search
  (components/shared/hero-search.tsx). One look on every page (Games,
  Players, Coaches, Clubs):

  - tablet and desktop (>= 768px): a dropdown under the button;
  - phones: a modal with a title, a close (X) button and a sticky
    "Clear all / Show results" footer, so it's obvious how to finish.

  Each page renders one panel per search pill (`variant` = the pill it
  belongs to). Only the panel for the current screen size ever opens, so
  the hidden pill's panel can't pop up too.

  Purely presentational: the page owns `open` and every filter value. The
  footer's "Show results" just closes the panel unless the page passes
  `onApply` (Games applies its draft filters there).
*/

export interface HeroFiltersPanelProps {
  /** Which search pill this panel belongs to. */
  variant: "desktop" | "mobile";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The <HeroSearchFiltersButton>. */
  trigger: React.ReactElement;
  title?: string;
  children: React.ReactNode;
  /** Shows "Clear all" in the footer when there is something to clear. */
  onClear?: () => void;
  canClear?: boolean;
  onApply?: () => void;
  applyLabel?: string;
  contentTestId?: string;
  clearTestId?: string;
  applyTestId?: string;
}

export function HeroFiltersPanel({
  variant,
  open,
  onOpenChange,
  trigger,
  title = "Filters",
  children,
  onClear,
  canClear = true,
  onApply,
  applyLabel = "Show results",
  contentTestId,
  clearTestId,
  applyTestId,
}: HeroFiltersPanelProps) {
  const isMobile = useIsMobile();
  const isCurrent = variant === "mobile" ? isMobile : !isMobile;
  const titleId = React.useId();
  const apply = onApply ?? (() => onOpenChange(false));

  const footer = (
    <>
      {onClear && canClear ? (
        <Button type="button" variant="ghost" onClick={onClear} data-testid={clearTestId}>
          Clear all
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" onClick={apply} data-testid={applyTestId}>
        {applyLabel}
      </Button>
    </>
  );

  if (variant === "mobile") {
    return (
      <Dialog open={open && isCurrent} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-md gap-0 p-0" data-testid={contentTestId}>
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription className="sr-only">Choose filters, then Show results.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 py-4">{children}</div>
          <DialogFooter className="sticky bottom-0 flex-row items-center justify-between gap-2 border-t bg-background px-5 py-3 sm:justify-between">
            {footer}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop dropdown: never taller than the space Radix measured between the
  // button and the edge of the window, so the "Clear all / Show results"
  // footer always stays on screen and the fields scroll instead. With a
  // fixed 80vh cap, a long panel (Games) opened from the hero hung below the
  // bottom of a 800px-tall window and "Show results" could not be reached.
  return (
    <Popover open={open && isCurrent} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sticky="always"
        collisionPadding={16}
        aria-labelledby={titleId}
        className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] flex-col p-0"
        data-testid={contentTestId}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p id={titleId} className="text-base font-semibold">
            {title}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close filters"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4" onWheel={(e) => e.stopPropagation()}>
          {children}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">{footer}</div>
      </PopoverContent>
    </Popover>
  );
}

/** One titled group inside the panel (same small uppercase label everywhere). */
export function FilterSection({
  label,
  icon,
  htmlFor,
  children,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  /** Set when the section holds a single input that the label should name. */
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const labelClass =
    "flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground [&_svg]:size-3.5";
  return (
    <div role={htmlFor ? undefined : "group"} aria-labelledby={htmlFor ? undefined : id} className={cn("space-y-2", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {icon}
          {label}
        </label>
      ) : (
        <p id={id} className={labelClass}>
          {icon}
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
