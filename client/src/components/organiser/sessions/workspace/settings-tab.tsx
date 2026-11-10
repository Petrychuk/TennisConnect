import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { getSessionDetail } from "@/lib/organiser-sessions-mock-data";
import { updateSession } from "@/lib/api/organizer-sessions";

interface SettingsTabProps {
  session: SessionListItem;
}

export function SettingsTab({ session }: SettingsTabProps) {
  const detail = getSessionDetail(session);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Only settings that are saved. "Check-in Open" and "Notify Players of
  // Changes" were switches that only said "not saved yet" (Phase 2: hidden
  // - organisers check players in from the Players tab, and there's no
  // player self check-in or change-notification setting behind them).

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
    // The same session is on Play too (cards, quick view, details).
    queryClient.invalidateQueries({ queryKey: ["/api/play/sessions"] });
  };

  const waitingListMutation = useMutation({
    mutationFn: (enabled: boolean) => updateSession(session.id, { waitingListEnabled: enabled }),
    onSuccess: (_data, enabled) => {
      invalidate();
      toast({ title: enabled ? "Waiting list turned on" : "Waiting list turned off" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't update", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  // Registration open/closed isn't its own column - it's derived from
  // registrationClosesAt. Closing sets that to right now. Reopening clears
  // it (null is a supported clear), so registration stays open until the
  // session starts. It used to push the date a year out, which put a close
  // time after the session on the Edit form (and "2027" in it).
  const registrationMutation = useMutation({
    mutationFn: (open: boolean) =>
      updateSession(session.id, { registrationClosesAt: open ? null : new Date() } as any),
    onSuccess: (_data, open) => {
      invalidate();
      toast({ title: open ? "Registration reopened" : "Registration closed", description: open ? "Players can join again." : "Players can no longer join." });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't update", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const rows = [
    {
      key: "registration",
      label: "Registration Open",
      description: "Players can join this session.",
      checked: !!session.registrationOpen,
      onCheckedChange: (v: boolean) => registrationMutation.mutate(v),
      disabled: registrationMutation.isPending,
    },
    {
      key: "waitlist",
      label: "Waiting List Enabled",
      description: "Auto-promote from the waiting list when a spot opens up.",
      checked: !!detail.waitingListEnabled,
      onCheckedChange: (v: boolean) => waitingListMutation.mutate(v),
      disabled: waitingListMutation.isPending,
    },
  ];

  return (
    <Card className="shadow-sm" data-testid="organiser-session-settings-tab">
      <CardHeader>
        <CardTitle asChild className="text-base"><h2>Session Settings</h2></CardTitle>
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
                checked={row.checked}
                onCheckedChange={row.onCheckedChange}
                disabled={row.disabled}
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
