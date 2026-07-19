import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";

interface MyOrganizedSession {
  id: string;
  title: string;
  type: string;
  status: "draft" | "pending_review" | "published" | "rejected" | "cancelled" | "live" | "completed";
  location: string | null;
  startAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-orange-100 text-orange-700",
  published: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  live: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  live: "Live",
  completed: "Completed",
};

// The sessions/tournaments this user organizes — as opposed to
// MySessionsSection, which is sessions they've joined as a player.
// Read-only here; creating/publishing/cancelling happens on the
// Organiser Hub, this is just the at-a-glance view on the profile.
export function MyOrganizedSessionsSection() {
  const [sessions, setSessions] = useState<MyOrganizedSession[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/organizer/sessions/mine", { credentials: "include" });
        if (!res.ok) return setSessions([]);
        setSessions(await res.json());
      } catch {
        setSessions([]);
      }
    })();
  }, []);

  if (sessions === null) {
    return (
      <div className="flex justify-center py-8" data-testid="my-organized-sessions-loading">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
