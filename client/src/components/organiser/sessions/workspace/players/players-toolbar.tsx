import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, CheckCircle2, UserPlus } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";

interface PlayersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onCheckInAll?: () => void;
  checkInAllLoading?: boolean;
  onInvitePlayers?: () => void;
  /** Selected level ("all" or a levelLabel) - omit onLevelChange to hide the filter. */
  level?: string;
  onLevelChange?: (level: string) => void;
}

// Search and the Level filter both work on the loaded registrations.
export function PlayersToolbar({
  search,
  onSearchChange,
  onCheckInAll,
  checkInAllLoading = false,
  onInvitePlayers,
  level,
  onLevelChange,
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

      {/* Level filter - the only filter here that isn't already a tab
          above (status) and that has real data behind it (no groups exist). */}
      {onLevelChange && (
        <Select value={level ?? "all"} onValueChange={onLevelChange}>
          <SelectTrigger aria-label="Filter by level" className="sm:w-40" data-testid="organiser-players-level-filter">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Social">Social / not set</SelectItem>
          </SelectContent>
        </Select>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 sm:flex-none" onClick={onCheckInAll} disabled={checkInAllLoading} data-testid="organiser-players-checkin-all">
          {checkInAllLoading ? <TennisBallSpinner className="mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Check-in All
        </Button>
        {onInvitePlayers && (
          <Button className="flex-1 sm:flex-none" onClick={onInvitePlayers} data-testid="organiser-players-invite-button">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Players
          </Button>
        )}
      </div>
    </div>
  );
}
