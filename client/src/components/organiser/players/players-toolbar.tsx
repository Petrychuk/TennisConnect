import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface PlayersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  level: string;
  onLevelChange: (value: string) => void;
}

// Group filter deliberately not here - a real Player Group object
// doesn't exist yet (Phase 2), and the previous version's "Group A/B/
// C" options were entirely fake placeholders with nothing behind
// them. Status/Level are real now (both actually filter the table via
// the props above) - they used to just be visual defaultValue="all"
// selects with no onChange at all, doing nothing when changed. The
// Grid/List view toggle and the separate decorative Filters icon
// button were both removed too - the toggle had no real second view
// worth switching to once the bottom analytics blocks were gone, and
// the icon button never opened anything.
export function PlayersToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  level,
  onLevelChange,
}: PlayersToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2" data-testid="organiser-players-page-toolbar">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search players by name..."
          className="pl-9"
          data-testid="organiser-players-page-search-input"
        />
      </div>

      <div className="flex gap-2">
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-32" data-testid="organiser-players-page-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={onLevelChange}>
          <SelectTrigger className="w-32" data-testid="organiser-players-page-level-filter">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Social">Social</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
