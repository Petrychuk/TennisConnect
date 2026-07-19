import { Button } from "@/components/ui/button";
import { CalendarPlus, Plus } from "lucide-react";

interface SessionsEmptyStateProps {
  onCreateSession?: () => void;
}

export function SessionsEmptyState({ onCreateSession }: SessionsEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-border"
      data-testid="organiser-sessions-empty-state"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        <CalendarPlus className="w-7 h-7" />
      </div>
      <h2 className="font-display text-xl font-bold">No sessions yet</h2>
      <p className="text-muted-foreground mt-1 max-w-sm">
        Create your first social, round robin, clinic, or tournament — it'll show up here once it does.
      </p>
      <Button className="mt-6" onClick={onCreateSession} data-testid="organiser-sessions-empty-create-button">
        <Plus className="w-4 h-4 mr-2" />
        Create Session
      </Button>
    </div>
  );
}
