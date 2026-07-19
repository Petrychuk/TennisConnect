import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { CountdownTimer } from "../countdown-timer";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.png";

interface SessionSummaryCardProps {
  session: SessionListItem;
  className?: string;
}

export function SessionSummaryCard({ session, className }: SessionSummaryCardProps) {
  const hasStarted = session.status === "live" || session.status === "completed" || session.status === "archived";
  const statusWord = hasStarted ? "Finished" : "Not Started";
  const roundLabel =
    session.roundCurrent && session.roundTotal
      ? `Round ${session.roundCurrent} / ${session.roundTotal}`
      : session.roundTotal
      ? `Round 0 / ${session.roundTotal}`
      : "No rounds set";

  return (
    <Card className={cn("shadow-sm", className)} data-testid="organiser-session-summary-card">
      <CardHeader>
        <CardTitle className="text-base">Session Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative rounded-xl overflow-hidden h-48">
          <img src={courtImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div data-testid="organiser-session-summary-registered">
            <p className="text-xl font-bold">{session.registeredCount}</p>
            <p className="text-xs text-muted-foreground">Registered</p>
          </div>
          <div data-testid="organiser-session-summary-checkedin">
            <p className="text-xl font-bold">{session.checkedInCount}</p>
            <p className="text-xs text-muted-foreground">Checked In</p>
          </div>
          <div data-testid="organiser-session-summary-waiting">
            <p className="text-xl font-bold">{session.waitingCount}</p>
            <p className="text-xs text-muted-foreground">Waiting List</p>
          </div>
          <div data-testid="organiser-session-summary-round">
            {session.status === "live" && session.roundEndsAt ? (
              <>
                <p className="text-xl font-bold">{roundLabel}</p>
                <p className="text-xs text-muted-foreground">
                  Ends in <CountdownTimer target={session.roundEndsAt} className="font-medium text-foreground" />
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold">{statusWord}</p>
                <p className="text-xs text-muted-foreground">{roundLabel}</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
