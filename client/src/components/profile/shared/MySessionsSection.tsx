import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useOrganiserSessions } from "@/lib/organiser-sessions-store";
import { useMyRegistrations, cancelRegistration } from "@/lib/session-registrations-store";

// "My Sessions" — sessions the current user has joined (Play Hub).
// Reads from the same client-side stores the rest of the Organiser Hub
// module uses (organiser-sessions-store + session-registrations-store)
// rather than a backend that doesn't exist yet.
export function MySessionsSection() {
  const allSessions = useOrganiserSessions();
  const registrations = useMyRegistrations();
  const { toast } = useToast();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const joined = registrations
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({ registration: r, session: allSessions.find((s) => s.id === r.sessionId) }))
    .filter((row): row is { registration: (typeof registrations)[number]; session: NonNullable<(typeof allSessions)[number]> } => !!row.session);

  const handleCancel = (sessionId: string, title: string) => {
    setCancellingId(sessionId);
    cancelRegistration(sessionId);
    toast({ title: "Registration cancelled", description: `You're no longer registered for "${title}".` });
    setCancellingId(null);
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
      {joined.map(({ registration, session }) => {
        const canCancel = new Date(session.startAt).getTime() > Date.now();
        return (
          <Card key={session.id} data-testid={`my-session-${session.id}`}>
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link href={`/organiser/sessions/${session.id}`} className="font-semibold hover:underline">
                    {session.title}
                  </Link>
                  {registration.status === "waitlisted" && <Badge variant="secondary">Waitlisted</Badge>}
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
                  {session.organizerName && <span>by {session.organizerName}</span>}
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
