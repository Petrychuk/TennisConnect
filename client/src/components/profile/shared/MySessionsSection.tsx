import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getMyRegisteredSessions, leaveSession } from "@/lib/api/organizer-sessions";

interface MySessionsSectionProps {
  isOwnProfile: boolean;
  isAuthenticated: boolean;
}

// "My Sessions" — sessions the current user has joined (Play Hub).
//
// The tab itself is always visible on every profile now (rather than
// only rendering for isOwnProfile) - "my sessions" is inherently about
// the viewer though, not whoever's profile is being looked at, so it
// only shows real content on the viewer's own profile while signed in;
// everywhere else it explains why, instead of just disappearing.
export function MySessionsSection({ isOwnProfile, isAuthenticated }: MySessionsSectionProps) {
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

  const joined = registeredQuery.data ?? [];

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
          You haven't joined any sessions yet. Check "Play This Week" on the homepage to find one.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="my-sessions-list">
      {joined.map((session) => {
        const canCancel = new Date(session.startAt).getTime() > Date.now();
        return (
          <Card key={session.id} data-testid={`my-session-${session.id}`}>
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
                  data-testid={`cancel-session-${session.id}`}
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
