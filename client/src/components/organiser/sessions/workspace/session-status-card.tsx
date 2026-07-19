import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, UserCheck, Play, Trophy, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { getSessionDetail } from "@/lib/organiser-sessions-mock-data";

interface SessionStatusCardProps {
  session: SessionListItem;
  onEdit?: () => void;
}

export function SessionStatusCard({ session, onEdit }: SessionStatusCardProps) {
  const detail = getSessionDetail(session);
  const isLive = session.status === "live";
  const hasEnded = session.status === "completed" || session.status === "archived";

  const rows = [
    {
      icon: ClipboardCheck,
      label: "Registration",
      value: session.registrationOpen ? "Open" : "Closed",
      positive: !!session.registrationOpen,
      testId: "registration",
    },
    {
      icon: UserCheck,
      label: "Check-in",
      value: detail.checkInOpen ? "Open" : "Not open",
      positive: detail.checkInOpen,
      testId: "checkin",
    },
    {
      icon: Play,
      label: "Live Session",
      value: isLive ? "In progress" : "Not started",
      positive: isLive,
      testId: "live",
    },
    {
      icon: Trophy,
      label: "Results",
      value: session.resultsPublished ? "Published" : "Not published",
      positive: !!session.resultsPublished,
      testId: "results",
    },
  ];

  return (
    <Card className="shadow-sm" data-testid="organiser-session-status-card">
      <CardHeader>
        <CardTitle className="text-base">Session Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.testId} className="flex items-center gap-3 text-sm" data-testid={`organiser-session-status-${row.testId}`}>
              <div
                className={cn(
                  "w-7 h-7 rounded-xl flex items-center justify-center shrink-0",
                  row.positive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">{row.label}</p>
                <p className={cn("font-medium", row.positive && "text-primary")}>{row.value}</p>
              </div>
            </div>
          );
        })}

        <Button variant="outline" className="w-full mt-2" onClick={onEdit} data-testid="organiser-session-status-edit-button">
          <Pencil className="w-4 h-4 mr-2" />
          Edit Session
        </Button>
      </CardContent>
    </Card>
  );
}
