import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Placeholder for a card whose own request is still loading. */
export function CardSkeleton({ className, testId, height = "h-64" }: { className?: string; testId: string; height?: string }) {
  return (
    <Skeleton
      className={cn(height, "rounded-2xl w-full", className)}
      role="status"
      aria-label="Loading"
      data-testid={testId}
    />
  );
}

/**
 * Compact inline warning for a REAL request failure (never for "no data yet").
 * One line on desktop, wraps on a phone; Try again re-fetches only what failed.
 */
export function DashboardWarning({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4">
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
        data-testid="organiser-dashboard-error"
      >
        <span className="flex items-start gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" aria-hidden />
          <span className="min-w-0" data-testid="organiser-dashboard-error-message">{message}</span>
        </span>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={retrying}
          onClick={onRetry}
          data-testid="organiser-dashboard-retry"
        >
          {retrying ? "Trying…" : "Try again"}
        </Button>
      </div>
    </div>
  );
}

/** A card slot whose data failed: small and quiet, the warning above carries the retry. */
export function CardUnavailable({ title, className, testId }: { title: string; className?: string; testId: string }) {
  return (
    <Card className={cn("shadow-sm", className)} data-testid={testId}>
      <CardContent className="flex flex-col items-center justify-center text-center gap-1 py-10">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">Unavailable right now.</p>
      </CardContent>
    </Card>
  );
}

/** First visit: no sessions yet. Replaces the Live/Upcoming cards, which would only say "nothing" twice. */
export function WelcomeEmptyState({ onCreateSession, className }: { onCreateSession: () => void; className?: string }) {
  return (
    <Card className={cn("shadow-sm", className)} data-testid="organiser-dashboard-empty">
      <CardContent className="flex flex-col items-center text-center gap-3 py-10 px-4 sm:px-8">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary-text flex items-center justify-center">
          <CalendarPlus className="w-6 h-6" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold">Welcome to your Organiser Hub</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          You haven't created a session yet. Set up your first one and your players, check-ins and stats will appear here.
        </p>
        <Button size="lg" className="w-full sm:w-auto" onClick={onCreateSession} data-testid="organiser-dashboard-empty-create">
          Create Session
        </Button>
      </CardContent>
    </Card>
  );
}
