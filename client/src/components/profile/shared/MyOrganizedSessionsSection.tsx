import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useOrganiserSessions } from "@/lib/organiser-sessions-store";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-secondary text-secondary-foreground",
  published: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  live: "bg-primary text-primary-foreground",
  completed: "bg-accent text-accent-foreground",
  archived: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

// The sessions/tournaments this user organizes — as opposed to
// MySessionsSection, which is sessions they've joined as a player.
// Read-only here; creating/publishing/cancelling happens on the
// Organiser Hub, this is just the at-a-glance view on the profile.
//
// Reads from the same client-side store the Organiser Hub's Sessions
// page and wizard use (organiser-sessions-store.ts) rather than a
// backend endpoint - there's no backend for this yet, and this is what
// makes a session created in the wizard actually show up here once
// it's been published, per the intended publish -> moderation ->
// appears-on-profile flow.
export function MyOrganizedSessionsSection() {
  const sessions = useOrganiserSessions();

  return (
    <div className="space-y-3" data-testid="my-organized-sessions-list">
      <div className="flex justify-end">
        <Button asChild size="sm" data-testid="go-to-organizer-dashboard-from-profile">
          <Link href="/organiser">
            <ExternalLink className="w-4 h-4 mr-2" />
            Manage in Organiser Hub
          </Link>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card data-testid="my-organized-sessions-empty">
          <CardContent className="py-10 text-center text-muted-foreground">
            You haven't created any sessions yet. Head to your Organiser Hub to create one.
          </CardContent>
        </Card>
      ) : (
        sessions.map((session) => (
          <Card key={session.id} data-testid={`my-organized-session-${session.id}`}>
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{session.title}</span>
                  <Badge className={STATUS_BADGE[session.status]}>{STATUS_LABEL[session.status]}</Badge>
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
                  <Badge variant="secondary" className="capitalize">
                    {session.type.replace("-", " ")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
