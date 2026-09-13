import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, LayoutTemplate, ChevronDown } from "lucide-react";

interface NewSessionMenuProps {
  className?: string;
}

// Create from Scratch / Use Template - matches the Session Templates
// spec exactly (two options, not three). "Use Template" goes straight
// to the Templates management page rather than a separate picker
// modal - that page is already a browsable list of templates each
// with their own "Use Template" button, so it doubles as the picker
// without needing a second, near-identical UI just for this entry
// point.
export function NewSessionMenu({ className }: NewSessionMenuProps) {
  const [, setLocation] = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={className} data-testid="organiser-new-session-menu-trigger">
          <Plus className="w-4 h-4 mr-2" />
          New Session
          <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocation("/organiser/sessions/new")} data-testid="organiser-new-session-menu-blank">
          <FileText className="w-4 h-4 mr-2" />
          <div>
            <p>Create from Scratch</p>
            <p className="text-xs text-muted-foreground font-normal">Start a new session with custom settings.</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocation("/organiser/sessions/templates")}
          data-testid="organiser-new-session-menu-template"
        >
          <LayoutTemplate className="w-4 h-4 mr-2" />
          <div>
            <p>Use Template</p>
            <p className="text-xs text-muted-foreground font-normal">Start with settings from a saved template.</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
