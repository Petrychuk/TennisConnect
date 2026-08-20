import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag, Shuffle, Layers, Repeat, MapPinned, Users, ListPlus, DollarSign, UserCog, CalendarPlus } from "lucide-react";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { getSessionDetail } from "@/lib/organiser-sessions-mock-data";

interface SessionDetailsCardProps {
  session: SessionListItem;
  isDivision?: boolean;
}

export function SessionDetailsCard({ session, isDivision }: SessionDetailsCardProps) {
  const [, setLocation] = useLocation();
  const detail = getSessionDetail(session);
  // Real value (sessions.courts_count) - previously fell back to
  // session.courts?.length, which only exists while status is "live"
  // and silently showed a hardcoded "6" the rest of the time regardless
  // of what the organizer actually configured.
  const courtsCount = session.courtsCount;
  // No structured storage for rounds count yet (Step 3 of the wizard
  // folds it into the free-text description instead of a real column -
  // see organiser-session-wizard-types.ts draftToInsertSession) so
  // there's nothing real to show outside TC Live's own round tracking.
  const roundsCount = session.roundTotal ?? null;

  const rows = [
    { icon: Tag, label: isDivision ? "Division Type" : "Session Type", value: session.type.replace("-", " "), testId: "type" },
    ...(isDivision
      ? []
      : [
          // Format/Game Format aren't backed by real columns yet either
          // (same Step 3 gap as rounds above) - showing "Not set" is
          // honest; a specific-looking value like "Fun Doubles" here
          // was a hardcoded placeholder true for every session
          // regardless of what was actually configured.
          { icon: Shuffle, label: "Format", value: session.format ?? "Not set", testId: "format" },
          { icon: Layers, label: "Game Format", value: detail.gameFormat ?? "Not set", testId: "game-format" },
          { icon: Repeat, label: "Rounds", value: roundsCount != null ? `${roundsCount} Rounds` : "Not set", testId: "rounds" },
        ]),
    { icon: MapPinned, label: "Courts", value: courtsCount != null ? `${courtsCount} Courts` : "Not set", testId: "courts" },
    { icon: Users, label: "Max Players", value: session.maxParticipants ? `${session.maxParticipants} Players` : "No limit", testId: "max-players" },
    {
      icon: ListPlus,
      label: "Waiting List",
      value: detail.waitingListEnabled ? "Enabled (10 spots)" : "Disabled",
      testId: "waiting-list",
    },
    { icon: DollarSign, label: "Cost", value: detail.costPerPlayer ? `$${detail.costPerPlayer} per player` : "Free", testId: "cost" },
    { icon: UserCog, label: "Organiser", value: detail.organizerName, testId: "organiser" },
    {
      icon: CalendarPlus,
      label: "Created",
      value: new Date(detail.createdAt).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      testId: "created",
    },
  ];

  return (
    <Card className="shadow-sm" data-testid="organiser-session-details-card">
      <CardHeader>
        <CardTitle className="text-base">{isDivision ? "Division Details" : "Session Details"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.testId}
              className="flex items-center justify-between text-sm gap-4"
              data-testid={`organiser-session-details-${row.testId}`}
            >
              <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Icon className="w-4 h-4" />
                {row.label}
              </span>
              <span className="font-medium text-right capitalize">{row.value}</span>
            </div>
          );
        })}

        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={() => setLocation(`/organiser/sessions/${session.id}?tab=settings`)}
          data-testid="organiser-session-details-view-full"
        >
          View Full Details
        </Button>
      </CardContent>
    </Card>
  );
}
