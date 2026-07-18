import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Trophy, Plus, ExternalLink } from "lucide-react";

interface DashboardHeaderProps {
  organizationName: string;
  organizationSlug: string;
  onCreateSession?: () => void;
}

export function DashboardHeader({
  organizationName,
  organizationSlug,
  onCreateSession,
}: DashboardHeaderProps) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/60"
      data-testid="organiser-hub-header"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">Organiser Hub</h1>
          <p className="text-sm text-muted-foreground">{organizationName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" asChild data-testid="organiser-hub-view-org-page">
          <Link href={`/organizations/${organizationSlug}`}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View public page
          </Link>
        </Button>
        <Button onClick={onCreateSession} data-testid="organiser-hub-create-session">
          <Plus className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </div>
    </div>
  );
}
