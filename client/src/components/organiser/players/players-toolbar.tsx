import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  view?: "table" | "grid";
  onViewChange?: (view: "table" | "grid") => void;
  showAdvancedFilters?: boolean;
}

export function PlayersToolbar({
  search,
  onSearchChange,
  view = "table",
  onViewChange,
  showAdvancedFilters = false,
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

      {showAdvancedFilters && (
        <div className="hidden lg:flex gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-32" data-testid="organiser-players-page-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-32" data-testid="organiser-players-page-level-filter">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-32" data-testid="organiser-players-page-group-filter">
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

      <Button variant="outline" size="icon" className="shrink-0" data-testid="organiser-players-page-filters-button">
        <SlidersHorizontal className="w-4 h-4" />
      </Button>

      {onViewChange && (
        <div className="hidden sm:flex items-center rounded-xl border border-border p-1 shrink-0" data-testid="organiser-players-page-view-toggle">
          <button
            type="button"
            onClick={() => onViewChange("grid")}
            className={cn("p-1.5 rounded-xl", view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            data-testid="organiser-players-page-view-grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("table")}
            className={cn("p-1.5 rounded-xl", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            data-testid="organiser-players-page-view-table"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
