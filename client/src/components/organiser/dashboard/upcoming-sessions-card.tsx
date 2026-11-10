import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession } from "@/lib/organiser-hub-mock-data";
import { formatInTimeZone } from "@/lib/timezone";

interface UpcomingSessionsCardProps {
  sessions: MockSession[];
  className?: string;
  onManage?: (sessionId: string) => void;
}

function sessionStatusLabel(session: MockSession) {
  if (session.waitingCount > 0) return `${session.waitingCount} on Waiting List`;
  if (session.maxParticipants && session.registeredCount >= session.maxParticipants) return "Full";
  if (session.status === "pending_review") return "Awaiting Approval";
  return "Registration Open";
}

function spotsLeftLabel(session: MockSession): string | null {
  if (!session.maxParticipants) return null;
  const left = session.maxParticipants - session.registeredCount;
  if (left <= 0) return null;
  return `${left} spot${left === 1 ? "" : "s"} left`;
}

export function UpcomingSessionsCard({ sessions, className, onManage }: UpcomingSessionsCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-upcoming-sessions-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle asChild className="text-base"><h2>Upcoming Sessions</h2></CardTitle>
        <Link
          href="/organiser/sessions?bucket=upcoming"
          className="text-xs font-medium text-primary-text flex items-center gap-0.5 cursor-pointer hover:underline"
          data-testid="organiser-upcoming-view-all"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-1 py-6" data-testid="organiser-upcoming-empty">
            <p className="text-sm font-medium">No upcoming sessions</p>
            <p className="text-sm text-muted-foreground">Your scheduled sessions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 3).map((session) => {
              const isFullOrWaiting = session.waitingCount > 0;
              const spotsLeft = spotsLeftLabel(session);
              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-border p-2.5 flex items-center gap-2 hover:border-primary/40 hover:bg-accent/40 transition-colors"
                  data-testid={`organiser-upcoming-session-${session.id}`}
                >
                  <Link href={`/organiser/sessions/${session.id}`} className="min-w-0 flex-1" data-testid={`organiser-upcoming-session-${session.id}-link`}>
                    <p className="font-semibold text-sm leading-snug break-words">{session.title}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 min-w-0">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span className="shrink-0">
                        {formatInTimeZone(session.startAt, session.timeZone, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {session.location && (
                        <>
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{session.location}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs font-medium mt-0.5">
                      {session.registeredCount}
                      {session.maxParticipants ? `/${session.maxParticipants}` : ""} players
                      {spotsLeft ? ` · ${spotsLeft}` : ""}
                      {" · "}
                      <span className={cn(isFullOrWaiting ? "text-destructive" : "text-primary-text")}>{sessionStatusLabel(session)}</span>
                    </p>
                  </Link>
                  {onManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => onManage(session.id)}
                      data-testid={`organiser-upcoming-session-${session.id}-manage`}
                    >
                      Manage
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
