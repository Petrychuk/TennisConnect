import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, CalendarDays, SlidersHorizontal } from "lucide-react";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";

interface SessionFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  venue: string;
  onVenueChange: (value: string) => void;
  venueOptions: string[];
  format: string;
  onFormatChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  calendarOpen: boolean;
  onCalendarOpenChange: (open: boolean) => void;
}

// Venue and Format are real filters now, driven by the organiser's
// actual session data (venueOptions) and the same 12 session types
// used everywhere else in the app - this used to be a fixed
// two-venue, four-format placeholder list from back when there was
// only ever one venue in the mock data. Calendar view and the extra
// filters button are still genuinely unbuilt.
export function SessionFiltersBar({
  search,
  onSearchChange,
  venue,
  onVenueChange,
  venueOptions,
  format,
  onFormatChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  calendarOpen,
  onCalendarOpenChange,
}: SessionFiltersBarProps) {
  const hasDateFilter = !!dateFrom || !!dateTo;

  return (
    <div className="flex flex-col sm:flex-row gap-2" data-testid="organiser-sessions-filters-bar">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search sessions..."
          className="pl-9"
          data-testid="organiser-sessions-search-input"
        />
      </div>

      <div className="hidden md:flex gap-2">
        <Select value={venue} onValueChange={onVenueChange}>
          <SelectTrigger className="w-40" data-testid="organiser-sessions-venue-filter">
            <SelectValue placeholder="All Venues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Venues</SelectItem>
            {venueOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={format} onValueChange={onFormatChange}>
          <SelectTrigger className="w-40" data-testid="organiser-sessions-format-filter">
            <SelectValue placeholder="All Formats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            {SESSION_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          variant={calendarOpen ? "default" : "outline"}
          className="hidden md:inline-flex gap-2"
          onClick={() => onCalendarOpenChange(!calendarOpen)}
          data-testid="organiser-sessions-calendar-button"
        >
          <CalendarDays className="w-4 h-4" />
          {calendarOpen ? "List" : "Calendar"}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative" data-testid="organiser-sessions-filters-button">
              <SlidersHorizontal className="w-4 h-4" />
              {hasDateFilter && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" data-testid="organiser-sessions-filters-active-dot" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3" data-testid="organiser-sessions-more-filters">
            <div className="space-y-1.5">
              <Label className="text-sm">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                data-testid="organiser-sessions-date-from"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                data-testid="organiser-sessions-date-to"
              />
            </div>
            {hasDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onDateFromChange("");
                  onDateToChange("");
                }}
                data-testid="organiser-sessions-date-clear"
              >
                Clear dates
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
