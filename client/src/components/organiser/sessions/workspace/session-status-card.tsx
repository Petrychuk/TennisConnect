import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, UserCheck, Play, Trophy, Pencil, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { getSessionDetail } from "@/lib/organiser-sessions-mock-data";

interface SessionStatusCardProps {
  session: SessionListItem;
  onEdit?: () => void;
  showEditButton?: boolean;
}

export function SessionStatusCard({ session, onEdit, showEditButton = true }: SessionStatusCardProps) {
  const detail = getSessionDetail(session);
  const isLive = session.status === "live";
  const capacity = session.maxParticipants ?? session.registeredCount;

  return (
    <Card className="shadow-sm" data-testid="organiser-session-status-card">
      <CardHeader>
        <CardTitle className="text-base">Session Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 text-sm" data-testid="organiser-session-status-registration">
          <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <ClipboardCheck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">Registration</p>
              <span className="text-xs font-semibold">{session.registeredCount} / {capacity}</span>
            </div>
            <Progress value={(session.registeredCount / capacity) * 100} className="h-1.5 mt-1.5" />
          </div>
          {session.registeredCount >= capacity ? (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          )}
        </div>

        <div className="flex items-start gap-3 text-sm" data-testid="organiser-session-status-checkin">
          <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">Check-in</p>
              <span className="text-xs font-semibold">{session.checkedInCount} / {session.registeredCount}</span>
            </div>
            <Progress value={(session.checkedInCount / Math.max(session.registeredCount, 1)) * 100} className="h-1.5 mt-1.5" />
          </div>
          {detail.checkInOpen && session.checkedInCount >= session.registeredCount ? (
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          )}
        </div>

        <div className="flex items-center gap-3 text-sm" data-testid="organiser-session-status-live">
          <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", isLive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <Play className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">Live Session</p>
            <p className={cn("font-medium", isLive && "text-primary")}>{isLive ? "In Progress" : "Not started"}</p>
          </div>
          {isLive ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>

        <div className="flex items-center gap-3 text-sm" data-testid="organiser-session-status-results">
          <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", session.resultsPublished ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <Trophy className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">Results</p>
            <p className={cn("font-medium", session.resultsPublished && "text-primary")}>{session.resultsPublished ? "Published" : "Pending"}</p>
          </div>
          {session.resultsPublished ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>

        {showEditButton && (
          <Button variant="outline" className="w-full mt-2" onClick={onEdit} data-testid="organiser-session-status-edit-button">
            <Pencil className="w-4 h-4 mr-2" />
            Edit Session
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
