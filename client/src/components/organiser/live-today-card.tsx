import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession } from "@/lib/organiser-hub-mock-data";

interface LiveTodayCardProps {
  sessions: MockSession[];
  className?: string;
}

export function LiveTodayCard({ sessions, className }: LiveTodayCardProps) {
  const isLive = sessions.length > 0;

  return (
    <Card className={cn(className)} data-testid="organiser-hub-live-today-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className={cn("w-4 h-4", isLive ? "text-red-500" : "text-muted-foreground")} />
          Today
        </CardTitle>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            LIVE
          </span>
        )}
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-hub-live-today-empty">
            Nothing running today. Enjoy the break.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/60 p-3"
                data-testid={`organiser-hub-live-session-${session.id}`}
              >
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold truncate">{session.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(session.startAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
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
