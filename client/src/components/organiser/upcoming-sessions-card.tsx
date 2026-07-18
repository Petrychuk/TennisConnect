import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession, SessionStatus } from "@/lib/organiser-hub-mock-data";

interface UpcomingSessionsCardProps {
  sessions: MockSession[];
  className?: string;
}

const STATUS_STYLES: Record<SessionStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-orange-100 text-orange-700",
  published: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  live: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  live: "Live",
  completed: "Completed",
};

export function UpcomingSessionsCard({ sessions, className }: UpcomingSessionsCardProps) {
  return (
    <Card className={cn(className)} data-testid="organiser-hub-upcoming-sessions-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="w-4 h-4 text-primary" />
          Upcoming Sessions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-hub-upcoming-empty">
            Nothing on the calendar yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/60 p-3"
                data-testid={`organiser-hub-upcoming-session-${session.id}`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{session.title}</p>
                    <Badge className={STATUS_STYLES[session.status]}>{STATUS_LABELS[session.status]}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(session.startAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {session.location}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1 shrink-0 w-fit">
                  <Users className="w-3 h-3" />
                  {session.registeredCount}
                  {session.maxParticipants ? `/${session.maxParticipants}` : ""}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
