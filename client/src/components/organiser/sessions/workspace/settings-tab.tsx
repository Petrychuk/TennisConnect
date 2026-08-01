import { useState } from "react";
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
  // Local-only toggles - no real backend column for either of these yet.
  const [checkInOpen, setCheckInOpen] = useState(!!detail.checkInOpen);
  const [notifyChanges, setNotifyChanges] = useState(true);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id] });
    queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
  };

  const waitingListMutation = useMutation({
    mutationFn: (enabled: boolean) => updateSession(session.id, { waitingListEnabled: enabled }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Waiting List Enabled updated" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't update", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  // Registration open/closed isn't its own column - it's derived from
  // registrationClosesAt. Closing sets that to right now; reopening
  // pushes it a year out rather than trying to null the field, which
  // achieves the same real effect (registration reads as open again)
  // without needing the backend to special-case an explicit clear.
  const registrationMutation = useMutation({
    mutationFn: (open: boolean) =>
      updateSession(session.id, {
        registrationClosesAt: open
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(),
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Registration Open updated" });
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
      key: "checkin",
      label: "Check-in Open",
      description: "Players can check themselves in on arrival.",
      checked: checkInOpen,
      onCheckedChange: (v: boolean) => {
        setCheckInOpen(v);
        toast({ title: "Check-in Open updated" });
      },
      disabled: false,
    },
    {
      key: "waitlist",
      label: "Waiting List Enabled",
      description: "Auto-promote from the waiting list when a spot opens up.",
      checked: !!detail.waitingListEnabled,
      onCheckedChange: (v: boolean) => waitingListMutation.mutate(v),
      disabled: waitingListMutation.isPending,
    },
    {
      key: "notify",
      label: "Notify Players of Changes",
      description: "Send an update when session details change.",
      checked: notifyChanges,
      onCheckedChange: (v: boolean) => {
        setNotifyChanges(v);
        toast({ title: "Notify Players of Changes updated" });
      },
      disabled: false,
    },
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
