import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Shuffle, Repeat, MapPinned, Users, ListPlus, DollarSign, UserCog, CalendarPlus } from "lucide-react";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { getSessionDetail } from "@/lib/organiser-sessions-mock-data";

interface SessionDetailsCardProps {
  session: SessionListItem;
}

export function SessionDetailsCard({ session }: SessionDetailsCardProps) {
  const detail = getSessionDetail(session);
  const courtsCount = session.courts?.length ?? 6;

  const rows = [
    { icon: Tag, label: "Session Type", value: session.type.replace("-", " "), testId: "type" },
    { icon: Shuffle, label: "Format", value: detail.format, testId: "format" },
    { icon: Repeat, label: "Rounds", value: detail.roundsDescription, testId: "rounds" },
    { icon: MapPinned, label: "Courts", value: `${courtsCount} courts`, testId: "courts" },
    { icon: Users, label: "Max Players", value: session.maxParticipants ? `${session.maxParticipants} players` : "No limit", testId: "max-players" },
    {
      icon: ListPlus,
      label: "Waiting List",
      value: detail.waitingListEnabled ? "Enabled" : "Disabled",
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
        <CardTitle className="text-base">Session Details</CardTitle>
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
      </CardContent>
    </Card>
  );
}
