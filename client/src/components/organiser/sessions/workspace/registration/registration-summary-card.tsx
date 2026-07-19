import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, Hourglass, UserPlus, Clock } from "lucide-react";
import type { SessionListItem, SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface RegistrationSummaryCardProps {
  session: SessionListItem;
  players: SessionPlayer[];
}

export function RegistrationSummaryCard({ session, players }: RegistrationSummaryCardProps) {
  const registered = players.filter((p) => p.status === "registered").length;
  const checkedIn = players.filter((p) => p.status === "registered" && p.checkedIn).length;
  const waiting = players.filter((p) => p.status === "waiting").length;
  const available = session.maxParticipants !== null ? Math.max(session.maxParticipants - registered, 0) : null;

  const items = [
    { key: "registered", icon: Users, value: String(registered), label: "Registered" },
    { key: "checkedin", icon: CheckCircle2, value: String(checkedIn), label: "Checked In" },
    { key: "waiting", icon: Hourglass, value: String(waiting), label: "Waiting List" },
    ...(available !== null ? [{ key: "available", icon: UserPlus, value: String(available), label: "Available" }] : []),
    {
      key: "closes",
      icon: Clock,
      value: session.registrationClosesAt
        ? new Date(session.registrationClosesAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : "—",
      label: "Registration Closes",
    },
  ];

  return (
    <Card className="shadow-sm" data-testid="organiser-registration-summary-card">
      <CardHeader>
        <CardTitle className="text-base">Registration Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} data-testid={`organiser-registration-summary-${item.key}`}>
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1.5">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold leading-tight">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
