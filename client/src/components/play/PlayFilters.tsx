import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, CalendarDays, Tag, BarChart3 } from "lucide-react";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { PLAY_DATE_FILTER_OPTIONS, PLAY_LEVEL_OPTIONS, type PlayDateFilter } from "@/lib/play-status";

export const PLAY_FILTER_ALL = "all";

// "Custom Session" is an organiser-defined free-for-all format - not a
// recognisable category a player would filter by, so it's excluded
// from Play's own Format filter (still valid elsewhere, e.g. the
// organiser wizard).
export const PLAY_FORMAT_OPTIONS = SESSION_TYPE_OPTIONS.filter((opt) => opt.key !== "custom");

export interface PlayFiltersDraft {
  location: string;
  dateFilter: PlayDateFilter;
  customDate: string;
  format: string;
  level: string;
}

// Spec [PLAY] section 14 - the Filters dialog, extracted so it isn't
// tangled into play.tsx's own layout/query code. Operates entirely on
// a draft object the parent owns (Clear all / Show results only ever
// affect this draft + the parent's real filter state on submit, never
// mid-edit) - this component has no state of its own beyond what's
// passed in.
export function PlayFilters({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onClear,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: PlayFiltersDraft;
  onDraftChange: (draft: PlayFiltersDraft) => void;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="play-filters-dialog">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="play-filter-location" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" /> Location
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="play-filter-location"
                value={draft.location}
                onChange={(e) => onDraftChange({ ...draft, location: e.target.value })}
                placeholder="Suburb, city or venue..."
                className="pl-9"
                data-testid="play-filter-location"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" /> Date
            </p>
            <RadioGroup
              value={draft.dateFilter}
              onValueChange={(v) => onDraftChange({ ...draft, dateFilter: v as PlayDateFilter })}
              className="gap-1.5"
              data-testid="play-filter-date"
            >
              {PLAY_DATE_FILTER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value={opt.value} data-testid={`play-filter-date-${opt.value}`} />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
            {draft.dateFilter === "custom" && (
              <Input
                type="date"
                value={draft.customDate}
                onChange={(e) => onDraftChange({ ...draft, customDate: e.target.value })}
                className="mt-1.5"
                data-testid="play-filter-custom-date"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Tag className="w-3.5 h-3.5" /> Format
            </Label>
            <Select value={draft.format} onValueChange={(v) => onDraftChange({ ...draft, format: v })}>
              <SelectTrigger data-testid="play-filter-format"><SelectValue placeholder="All Formats" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={PLAY_FILTER_ALL} data-testid="play-filter-format-all">All Formats</SelectItem>
                {PLAY_FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key} data-testid={`play-filter-format-${opt.key}`}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <BarChart3 className="w-3.5 h-3.5" /> Level
            </Label>
            <Select value={draft.level} onValueChange={(v) => onDraftChange({ ...draft, level: v })}>
              <SelectTrigger data-testid="play-filter-level"><SelectValue placeholder="All Levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={PLAY_FILTER_ALL} data-testid="play-filter-level-all">All Levels</SelectItem>
                {PLAY_LEVEL_OPTIONS.filter((l) => l !== "All Levels").map((lvl) => (
                  <SelectItem key={lvl} value={lvl} data-testid={`play-filter-level-${lvl}`}>{lvl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={onClear} data-testid="play-filters-clear-all">
            Clear all
          </Button>
          <Button onClick={onApply} data-testid="play-filters-show-results">
            Show results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
