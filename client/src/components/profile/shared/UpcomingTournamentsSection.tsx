import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, LogIn, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getMyRegisteredSessions, leaveSession } from "@/lib/api/organizer-sessions";

interface UpcomingTournamentsSectionProps {
  isOwnProfile: boolean;
  isAuthenticated: boolean;
}

// Real tournaments/divisions the viewer has actually joined (via the
// same registration system every ordinary session uses), not a manual
// entry - that's what the sibling "Past Tournaments" tab is for
// (untouched, still the existing Add Entry / results feature). This
// tab fills in automatically the moment a Join click on a tournament-
// type session or one of its divisions goes through.
export function UpcomingTournamentsSection({ isOwnProfile, isAuthenticated }: UpcomingTournamentsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const registeredQuery = useQuery({
    queryKey: ["/api/organizer/sessions/mine/registered"],
    queryFn: getMyRegisteredSessions,
    enabled: isOwnProfile && isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <Card data-testid="upcoming-tournaments-signed-out">
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-muted-foreground">Sign in to see the tournaments you've joined.</p>
          <Button asChild size="sm" data-testid="upcoming-tournaments-sign-in">
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
      <Card data-testid="upcoming-tournaments-not-own-profile">
        <CardContent className="py-10 text-center text-muted-foreground">
          Upcoming tournaments shows tournaments you've joined, not this profile's — visit your own profile to see yours.
        </CardContent>
      </Card>
    );
  }

  if (registeredQuery.isLoading) {
    return (
      <Card data-testid="upcoming-tournaments-loading">
        <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const now = Date.now();
  const upcoming = (registeredQuery.data ?? [])
    .filter((s) => (s.type === "tournament" || s.type === "club-championship") && new Date(s.startAt).getTime() > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

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

  if (upcoming.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed" data-testid="upcoming-tournaments-empty">
        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No upcoming tournaments yet — join one from an organiser's profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="upcoming-tournaments-list">
      {upcoming.map((session) => {
        const canCancel = new Date(session.startAt).getTime() > now;
        return (
          <Card key={session.id} data-testid={`upcoming-tournament-${session.id}`}>
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link href={`/organiser/sessions/${session.id}`} className="font-semibold hover:underline">
                    {session.title}
                  </Link>
                  {session.viewerRegistrationStatus === "waitlisted" && <Badge variant="secondary">Waitlisted</Badge>}
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(session.startAt).toLocaleString(undefined, {
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
              </div>
              {canCancel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(session.id, session.title)}
                  disabled={cancellingId === session.id}
                  data-testid={`cancel-tournament-${session.id}`}
                >
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
