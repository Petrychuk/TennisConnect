import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, CalendarDays, SlidersHorizontal } from "lucide-react";

interface SessionFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

// Venue/format filtering and the Calendar view are visual placeholders for
// now — there's only ever been one venue in the mock data, so wiring them
// up for real waits for the backend pass.
export function SessionFiltersBar({ search, onSearchChange }: SessionFiltersBarProps) {
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
        <Select defaultValue="all">
          <SelectTrigger className="w-40" data-testid="organiser-sessions-venue-filter">
            <SelectValue placeholder="All Venues" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Venues</SelectItem>
            <SelectItem value="lyne-park">Lyne Park Tennis Centre</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all">
          <SelectTrigger className="w-40" data-testid="organiser-sessions-format-filter">
            <SelectValue placeholder="All Formats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            <SelectItem value="social">Social</SelectItem>
            <SelectItem value="round-robin">Round Robin</SelectItem>
            <SelectItem value="clinic">Clinic</SelectItem>
            <SelectItem value="tournament">Tournament</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="hidden md:inline-flex gap-2" data-testid="organiser-sessions-calendar-button">
          <CalendarDays className="w-4 h-4" />
          Calendar
        </Button>
        <Button variant="outline" size="icon" data-testid="organiser-sessions-filters-button">
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
