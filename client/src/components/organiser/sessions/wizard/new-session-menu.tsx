import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, LayoutTemplate, Copy, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NewSessionMenuProps {
  className?: string;
}

// "Duplicate Previous" and "From Template" both skip Step 1 in spirit -
// they're the ~10-second path organisers reach for once they have a
// regular session running. Only "Blank Session" is wired to the real
// wizard this pass; the other two are flagged honestly as coming soon
// rather than silently doing the same thing as blank.
export function NewSessionMenu({ className }: NewSessionMenuProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
          Blank Session
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toast({ title: "From Template isn't wired up yet" })}
          data-testid="organiser-new-session-menu-template"
        >
          <LayoutTemplate className="w-4 h-4 mr-2" />
          From Template
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toast({ title: "Duplicate Previous isn't wired up yet" })}
          data-testid="organiser-new-session-menu-duplicate"
        >
          <Copy className="w-4 h-4 mr-2" />
          Duplicate Previous
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
