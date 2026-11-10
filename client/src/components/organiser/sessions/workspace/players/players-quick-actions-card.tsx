import { MessageSquare, Download, ListPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlayersQuickActionsCardProps {
  /** Opens the session's Messages tab (an update to everyone registered). Omitted for divisions. */
  onMessageAll?: () => void;
  onExport: () => void;
  onShowWaitingList: () => void;
}

// Tablet/phone shortcuts on the Players tab. Every button does something
// real (Phase 2) - "Message All", "Check-in Reminder", "Export List",
// "Manage Groups/Waitlist" and "More" used to only toast "isn't wired up
// yet". Session-wide actions live in the header's More menu.
export function PlayersQuickActionsCard({ onMessageAll, onExport, onShowWaitingList }: PlayersQuickActionsCardProps) {
  const actions = [
    ...(onMessageAll ? [{ key: "message-all", label: "Message Players", icon: MessageSquare, onClick: onMessageAll }] : []),
    { key: "export-list", label: "Export List", icon: Download, onClick: onExport },
    { key: "waiting-list", label: "Waiting List", icon: ListPlus, onClick: onShowWaitingList },
  ];

  return (
    <Card data-testid="organiser-players-quick-actions-card">
      <CardHeader>
        <CardTitle asChild className="text-base"><h2>Quick Actions</h2></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-3 text-center transition-all hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`organiser-players-quick-action-${action.key}`}
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-medium leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
