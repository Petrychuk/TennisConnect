import { FilterSection } from "@/components/shared/hero-filters";
import { Input } from "@/components/ui/input";
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

// Spec [PLAY] section 14 - the fields of the Games Filters panel. The
// panel itself (dropdown on tablet/desktop, modal on phones, with the
// "Clear all / Show results" footer) is the shared HeroFiltersPanel.
// Operates entirely on a draft object the parent owns (Clear all / Show
// results only ever affect this draft + the parent's real filter state
// on submit, never mid-edit) - no state of its own.
export function PlayFilterFields({
  draft,
  onDraftChange,
  idSuffix = "",
}: {
  draft: PlayFiltersDraft;
  onDraftChange: (draft: PlayFiltersDraft) => void;
  /** Keeps ids unique between the desktop and phone panels. */
  idSuffix?: string;
}) {
  const locationId = `play-filter-location${idSuffix}`;
  return (
    <>
      <FilterSection label="Location" icon={<MapPin />} htmlFor={locationId}>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id={locationId}
            value={draft.location}
            onChange={(e) => onDraftChange({ ...draft, location: e.target.value })}
            placeholder="Suburb, city or venue..."
            className="pl-9"
            data-testid="play-filter-location"
          />
        </div>
      </FilterSection>

      <FilterSection label="Date" icon={<CalendarDays />}>
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
            aria-label="Date"
            value={draft.customDate}
            onChange={(e) => onDraftChange({ ...draft, customDate: e.target.value })}
            className="mt-1.5"
            data-testid="play-filter-custom-date"
          />
        )}
      </FilterSection>

      <FilterSection label="Format" icon={<Tag />}>
        <Select value={draft.format} onValueChange={(v) => onDraftChange({ ...draft, format: v })}>
          <SelectTrigger aria-label="Format" data-testid="play-filter-format"><SelectValue placeholder="All Formats" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={PLAY_FILTER_ALL} data-testid="play-filter-format-all">All Formats</SelectItem>
            {PLAY_FORMAT_OPTIONS.map((opt) => (
              <SelectItem key={opt.key} value={opt.key} data-testid={`play-filter-format-${opt.key}`}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection label="Level" icon={<BarChart3 />}>
        <Select value={draft.level} onValueChange={(v) => onDraftChange({ ...draft, level: v })}>
          <SelectTrigger aria-label="Level" data-testid="play-filter-level"><SelectValue placeholder="All Levels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={PLAY_FILTER_ALL} data-testid="play-filter-level-all">All Levels</SelectItem>
            {PLAY_LEVEL_OPTIONS.filter((l) => l !== "All Levels").map((lvl) => (
              <SelectItem key={lvl} value={lvl} data-testid={`play-filter-level-${lvl}`}>{lvl}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>
    </>
  );
}
