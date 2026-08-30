import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, CheckCircle2, UserPlus } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";

interface PlayersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onCheckInAll?: () => void;
  checkInAllLoading?: boolean;
  onInvitePlayers?: () => void;
  showAdvancedFilters?: boolean;
}

// Level/Group filtering is visual-only for now (desktop shows the
// selects to match the mockup) — real filtering waits for the backend
// pass, search already works client-side against the real list.
export function PlayersToolbar({
  search,
  onSearchChange,
  onCheckInAll,
  checkInAllLoading = false,
  onInvitePlayers,
  showAdvancedFilters = false,
}: PlayersToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2" data-testid="organiser-players-toolbar">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search players..."
          className="pl-9"
          data-testid="organiser-players-search-input"
        />
      </div>

      {showAdvancedFilters && (
        <div className="hidden lg:flex gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-32" data-testid="organiser-players-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-32" data-testid="organiser-players-level-filter">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="social">Social</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-32" data-testid="organiser-players-group-filter">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              <SelectItem value="a">Group A</SelectItem>
              <SelectItem value="b">Group B</SelectItem>
              <SelectItem value="c">Group C</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Button variant="outline" size="icon" className="shrink-0" data-testid="organiser-players-filters-button">
        <SlidersHorizontal className="w-4 h-4" />
      </Button>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={onCheckInAll} disabled={checkInAllLoading} data-testid="organiser-players-checkin-all">
          {checkInAllLoading ? <TennisBallSpinner className="mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Check-in All
        </Button>
        <Button className="flex-1 sm:flex-none" onClick={onInvitePlayers} data-testid="organiser-players-invite-button">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Players
        </Button>
      </div>
    </div>
  );
}
