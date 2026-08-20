import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, LogIn, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getMyRegisteredSessions, leaveSession } from "@/lib/api/organizer-sessions";
import { formatInTimeZone } from "@/lib/timezone";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";

const DEFAULT_CANCELLATION_POLICY =
  "Free cancellation up to 24 hours before the session starts. After that, no refund — the spot may still be offered to the waiting list.";

// The session's description is a combined blob - format summary, then
// any of Rules/Refund Policy/Late Arrivals/Cancellations the organiser
// filled in on the wizard's Details & Rules step, each its own
// "\n\n"-separated section labelled exactly like this (see
// draftToInsertSession's policySections). Pull out just the two
// sections relevant to cancelling - showing the whole description
// here would include tournament format details that don't belong
// under "cancellation & refund policy".
function extractCancellationPolicy(description?: string | null): string | null {
  if (!description) return null;
  const sections = description
    .split("\n\n")
    .filter((s) => s.startsWith("Refund Policy:") || s.startsWith("Cancellations:"));
  return sections.length > 0 ? sections.join("\n\n") : null;
}

interface MySessionsSectionProps {
  isOwnProfile: boolean;
  isAuthenticated: boolean;
  /** Restricts the list to these session types (e.g. tournament/club-championship) - omit for every type. */
  sessionTypes?: string[];
  /** Excludes these session types instead - e.g. "everything except tournaments", without needing to enumerate every other type by hand. */
  excludeTypes?: string[];
  /** "upcoming" (default) shows what's still ahead; "past" shows what's already happened - both from real registrations, no manual entry. */
  timeframe?: "upcoming" | "past";
}

// "My Sessions" — sessions the current user has joined (Play Hub).
//
// The tab itself is always visible on every profile now (rather than
// only rendering for isOwnProfile) - "my sessions" is inherently about
// the viewer though, not whoever's profile is being looked at, so it
// only shows real content on the viewer's own profile while signed in;
// everywhere else it explains why, instead of just disappearing.
export function MySessionsSection({ isOwnProfile, isAuthenticated, sessionTypes, excludeTypes, timeframe = "upcoming" }: MySessionsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [policyOpenId, setPolicyOpenId] = useState<string | null>(null);

  const registeredQuery = useQuery({
    queryKey: ["/api/organizer/sessions/mine/registered"],
    queryFn: getMyRegisteredSessions,
    enabled: isOwnProfile && isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <Card data-testid="my-sessions-signed-out">
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-muted-foreground">Sign in to see the sessions you've joined.</p>
          <Button asChild size="sm" data-testid="my-sessions-sign-in">
            <Link href="/auth">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isOwnProfile) {
    return (
      <Card data-testid="my-sessions-not-own-profile">
        <CardContent className="py-10 text-center text-muted-foreground">
          "My Sessions" shows sessions you've joined, not this profile's — visit your own profile to see yours.
        </CardContent>
      </Card>
    );
  }

  if (registeredQuery.isLoading) {
    return (
      <Card data-testid="my-sessions-loading">
        <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const now = Date.now();
  const joined = (registeredQuery.data ?? [])
    .filter((s) => !("hasDivisions" in s) || !s.hasDivisions)
    .filter((s) => !sessionTypes || sessionTypes.includes(s.type))
    .filter((s) => !excludeTypes || !excludeTypes.includes(s.type))
    .filter((s) => (timeframe === "upcoming" ? new Date(s.startAt).getTime() > now : new Date(s.startAt).getTime() <= now))
    .sort((a, b) =>
      timeframe === "upcoming"
        ? new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
        : new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
    );

  const handleCancel = async (sessionId: string, title: string) => {
    setCancellingId(sessionId);
    try {
      await leaveSession(sessionId);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine/registered"] });
      toast({ title: "Registration cancelled", description: `You're no longer registered for "${title}".` });
    } catch (error: any) {
      toast({ title: "Couldn't cancel", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  if (joined.length === 0) {
    return (
      <Card data-testid="my-sessions-empty">
        <CardContent className="py-10 text-center text-muted-foreground">
          {timeframe === "upcoming"
            ? "Nothing here yet. Check \"Play This Week\" on the homepage to find something to join."
            : "Nothing here yet — sessions you've joined will show up once they're done."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="my-sessions-list">
      {joined.map((session) => {
        const canCancel = new Date(session.startAt).getTime() > Date.now();
        const showPolicy = policyOpenId === session.id;
        return (
          <Card key={session.id} className="overflow-hidden" data-testid={`my-session-${session.id}`}>
            <CardContent className="p-0 flex items-stretch gap-4">
              <img
                src={session.coverImage || courtImage}
                alt=""
                aria-hidden="true"
                className="w-24 sm:w-32 shrink-0 object-cover"
                data-testid={`my-session-${session.id}-cover`}
              />
              <div className="flex-1 min-w-0 py-4 pr-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/organiser/sessions/${session.id}`} className="font-semibold hover:underline">
                    {session.title}
                  </Link>
                  {session.viewerRegistrationStatus === "waitlisted" && <Badge variant="secondary">Waitlisted</Badge>}
                </div>
                {session.parentSessionTitle && (
                  <p className="text-xs text-muted-foreground" data-testid={`my-session-${session.id}-parent`}>
                    Part of {session.parentSessionTitle}
                  </p>
                )}
                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatInTimeZone(session.startAt, session.timeZone, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {session.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {session.location}
                    </span>
                  )}
                  {session.organizationName && <span>by {session.organizationName}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setPolicyOpenId(showPolicy ? null : session.id)}
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  data-testid={`cancellation-policy-toggle-${session.id}`}
                >
                  Cancellation &amp; refund policy
                  {showPolicy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showPolicy && (
                  <p className="text-xs text-muted-foreground max-w-md" data-testid={`cancellation-policy-text-${session.id}`}>
                    {extractCancellationPolicy(session.description) || DEFAULT_CANCELLATION_POLICY}
                  </p>
                )}
              </div>
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(session.id, session.title)}
                  disabled={cancellingId === session.id}
                  data-testid={`cancel-session-${session.id}`}
                >
                  Cancel
                </Button>
              )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
