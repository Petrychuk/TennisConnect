import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { getSessionDetail } from "@/lib/organiser-sessions-mock-data";

interface SettingsTabProps {
  session: SessionListItem;
}

// Working toggles, distinct from the Edit Wizard - these are switches an
// organiser flips during the life of the session, not the structural
// setup the wizard handles. Local-state only (no backend yet).
export function SettingsTab({ session }: SettingsTabProps) {
  const detail = getSessionDetail(session);
  const { toast } = useToast();

  const rows = [
    { key: "registration", label: "Registration Open", description: "Players can join this session.", defaultChecked: !!session.registrationOpen },
    { key: "checkin", label: "Check-in Open", description: "Players can check themselves in on arrival.", defaultChecked: !!detail.checkInOpen },
    { key: "waitlist", label: "Waiting List Enabled", description: "Auto-promote from the waiting list when a spot opens up.", defaultChecked: !!detail.waitingListEnabled },
    { key: "notify", label: "Notify Players of Changes", description: "Send an update when session details change.", defaultChecked: true },
  ];

  return (
    <Card className="shadow-sm" data-testid="organiser-session-settings-tab">
      <CardHeader>
        <CardTitle className="text-base">Session Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((row, i) => (
          <div key={row.key}>
            <div className="flex items-center justify-between py-3 gap-4" data-testid={`organiser-session-settings-${row.key}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
              </div>
              <Switch
                defaultChecked={row.defaultChecked}
                onCheckedChange={() => toast({ title: `${row.label} updated` })}
                data-testid={`organiser-session-settings-${row.key}-switch`}
              />
            </div>
            {i < rows.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
