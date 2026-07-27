import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, CheckCircle2, Hourglass, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";
import { getSessionById } from "@/lib/api/organizer-sessions";
import { toSessionListItem } from "@/lib/api/session-adapter";
import { cn } from "@/lib/utils";

// Foundation only: this is the screen that exists only while a session is
// running, per the brief. Round controls (Generate Next Round / Finish
// Round) are visually real but disabled — they need the TC Live engine,
// which isn't built on the backend yet (see shared/constants/sessions.ts -
// live/completed statuses are reserved for it but nothing produces
// round/court data today). The session itself is real; rounds/courts
// stay empty rather than faking data that doesn't exist server-side.
export default function OrganiserSessionLivePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id/live");
  const sessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", params?.id],
    queryFn: () => getSessionById(params!.id),
    enabled: !!params?.id,
  });

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary-foreground/60" />
      </div>
    );
  }

  const session = sessionQuery.data ? toSessionListItem(sessionQuery.data) : undefined;

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Session not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/sessions">Back to Sessions</Link>
        </Button>
      </div>
    );
  }

  const courts = session.courts ?? [];

  return (
    <div className="min-h-screen bg-foreground text-primary-foreground" data-testid="organiser-session-live">
      <SEO
        title={`Live — ${session.title} | TennisConnect`}
        description={`Live control centre for ${session.title}.`}
        noIndex
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href={`/organiser/sessions/${session.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
          data-testid="organiser-session-live-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Session Workspace
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Badge className="bg-primary text-primary-foreground gap-1.5 mb-2" data-testid="organiser-session-live-badge">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
              </span>
              LIVE
            </Badge>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">{session.title}</h1>
            <p className="text-primary-foreground/70 text-sm mt-1">
              {session.location}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" disabled data-testid="organiser-session-live-generate-round" title="Coming soon">
              Generate Next Round
            </Button>
            <Button disabled data-testid="organiser-session-live-finish-round" title="Coming soon">
              Finish Round
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="organiser-session-live-courts">
          {courts.map((court) => (
            <div
              key={court.id}
              className={cn(
                "rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center border border-primary-foreground/10",
                court.state === "playing" ? "bg-primary text-primary-foreground" : "bg-primary-foreground/5"
              )}
              data-testid={`organiser-session-live-court-${court.id}`}
            >
              {court.state === "ready" && <CheckCircle2 className="w-6 h-6" />}
              {court.state === "playing" && <Play className="w-6 h-6" />}
              {court.state === "pending" && <Hourglass className="w-6 h-6 opacity-60" />}
              <p className="font-semibold">{court.label}</p>
              <p className="text-xs opacity-70 capitalize">{court.state}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-primary-foreground/20 py-12 text-center text-primary-foreground/60" data-testid="organiser-session-live-placeholder">
          Waiting list, scoring, and round management aren't built yet — this
          screen is the foundation they'll live on.
        </div>
      </div>
    </div>
  );
}
