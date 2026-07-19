import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, BellRing, Download, Users2, MoreHorizontal, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlayersQuickActionsCardProps {
  lastLabel?: string;
  lastIcon?: LucideIcon;
  onMore?: () => void;
}

export function PlayersQuickActionsCard({ lastLabel = "Manage Waitlist", lastIcon: LastIcon = Users2, onMore }: PlayersQuickActionsCardProps) {
  const { toast } = useToast();
  const notify = (label: string) => toast({ title: `${label} isn't wired up yet` });

  const actions = [
    { key: "message-all", label: "Message All", icon: MessageSquare, onClick: () => notify("Message All") },
    { key: "checkin-reminder", label: "Check-in Reminder", icon: BellRing, onClick: () => notify("Check-in Reminder") },
    { key: "export-list", label: "Export List", icon: Download, onClick: () => notify("Export List") },
    { key: "last", label: lastLabel, icon: LastIcon, onClick: () => notify(lastLabel) },
    { key: "more", label: "More", icon: MoreHorizontal, onClick: onMore ?? (() => notify("More Actions")) },
  ];

  return (
    <Card data-testid="organiser-players-quick-actions-card">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-3 text-center transition-all hover:border-primary/40 hover:bg-accent/40 hover:scale-[1.01]"
                data-testid={`organiser-players-quick-action-${action.key}`}
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-medium leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
