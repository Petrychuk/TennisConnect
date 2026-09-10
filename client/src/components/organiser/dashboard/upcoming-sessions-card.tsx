import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession } from "@/lib/organiser-hub-mock-data";
import { formatInTimeZone } from "@/lib/timezone";

interface UpcomingSessionsCardProps {
  sessions: MockSession[];
  className?: string;
  onCreateSession?: () => void;
}

function sessionStatusLabel(session: MockSession) {
  if (session.waitingCount > 0) return `${session.waitingCount} on Waiting List`;
  if (session.maxParticipants && session.registeredCount >= session.maxParticipants) return "Full";
  if (session.status === "pending_review") return "Awaiting Approval";
  return "Registration Open";
}

export function UpcomingSessionsCard({ sessions, className, onCreateSession }: UpcomingSessionsCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-upcoming-sessions-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Upcoming Sessions</CardTitle>
        <Link
          href="/organiser/sessions"
          className="text-xs font-medium text-primary flex items-center gap-0.5 cursor-pointer hover:underline"
          data-testid="organiser-upcoming-view-all"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-6" data-testid="organiser-upcoming-empty">
            <p className="text-sm text-muted-foreground">Nothing on the calendar yet.</p>
            {onCreateSession && (
              <Button size="sm" onClick={onCreateSession} data-testid="organiser-upcoming-empty-create">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create your first session
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sessions.map((session) => {
              const isFullOrWaiting = session.waitingCount > 0;
              return (
                <Link
                  key={session.id}
                  href={`/organiser/sessions/${session.id}`}
                  className="rounded-xl border border-border p-3 hover:border-primary/40 hover:bg-accent/40 transition-colors"
                  data-testid={`organiser-upcoming-session-${session.id}`}
                >
                  <p className="font-semibold text-sm truncate">{session.title}</p>
                  <div className="text-xs text-muted-foreground mt-1.5 space-y-1">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatInTimeZone(session.startAt, session.timeZone, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      {session.location}
                    </span>
                  </div>
                  <p className="text-xs font-medium mt-2">
                    {session.registeredCount}
                    {session.maxParticipants ? ` / ${session.maxParticipants} players` : " players"}
                  </p>
                  <p className={cn("text-xs font-medium", isFullOrWaiting ? "text-destructive" : "text-primary")}>
                    {sessionStatusLabel(session)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
