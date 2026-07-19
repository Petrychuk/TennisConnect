import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession } from "@/lib/organiser-hub-mock-data";

interface UpcomingSessionsCardProps {
  sessions: MockSession[];
  className?: string;
}

type SessionBucket = "draft" | "registration-open" | "upcoming" | "completed";

const BUCKET_LABEL: Record<SessionBucket, string> = {
  draft: "Draft",
  "registration-open": "Registration Open",
  upcoming: "Upcoming",
  completed: "Completed",
};

function bucketFor(session: MockSession): SessionBucket {
  if (session.status === "draft") return "draft";
  if (session.status === "completed") return "completed";
  const isFull = session.maxParticipants !== null && session.registeredCount >= session.maxParticipants;
  if (session.status === "published" && !isFull) return "registration-open";
  return "upcoming"; // pending_review, or published-but-full
}

function sessionStatusLabel(session: MockSession) {
  if (session.waitingCount > 0) return `${session.waitingCount} on Waiting List`;
  if (session.maxParticipants && session.registeredCount >= session.maxParticipants) return "Full";
  if (session.status === "pending_review") return "Awaiting Approval";
  if (session.status === "completed") return "Completed";
  return "Registration Open";
}

function SessionRow({ session }: { session: MockSession }) {
  const isFullOrWaiting = session.waitingCount > 0;
  return (
    <Link
      href="#"
      onClick={(e) => e.preventDefault()}
      className="rounded-xl border border-border p-3 hover:border-primary/40 hover:bg-accent/40 transition-colors block"
      data-testid={`organiser-session-${session.id}`}
    >
      <p className="font-semibold text-sm truncate">{session.title}</p>
      <div className="text-xs text-muted-foreground mt-1.5 space-y-1">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          {new Date(session.startAt).toLocaleString(undefined, {
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
}

export function UpcomingSessionsCard({ sessions, className }: UpcomingSessionsCardProps) {
  const buckets: Record<SessionBucket, MockSession[]> = {
    draft: [],
    "registration-open": [],
    upcoming: [],
    completed: [],
  };
  for (const session of sessions) {
    buckets[bucketFor(session)].push(session);
  }

  const defaultTab: SessionBucket = buckets["registration-open"].length > 0 ? "registration-open" : "upcoming";

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-upcoming-sessions-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Sessions</CardTitle>
        <span className="text-xs font-medium text-primary flex items-center gap-0.5 cursor-pointer" data-testid="organiser-upcoming-view-all">
          View all
          <ChevronRight className="w-3 h-3" />
        </span>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-upcoming-empty">
            Nothing on the calendar yet.
          </p>
        ) : (
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full grid grid-cols-4" data-testid="organiser-sessions-tabs">
              {(Object.keys(BUCKET_LABEL) as SessionBucket[]).map((bucket) => (
                <TabsTrigger key={bucket} value={bucket} data-testid={`organiser-sessions-tab-${bucket}`}>
                  {BUCKET_LABEL[bucket]}
                  {buckets[bucket].length > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">({buckets[bucket].length})</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(BUCKET_LABEL) as SessionBucket[]).map((bucket) => (
              <TabsContent key={bucket} value={bucket} className="mt-4">
                {buckets[bucket].length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2" data-testid={`organiser-sessions-empty-${bucket}`}>
                    Nothing here yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {buckets[bucket].map((session) => (
                      <SessionRow key={session.id} session={session} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
