import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Copy, Megaphone, Download, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsCardProps {
  onCreateSession?: () => void;
  className?: string;
}

interface ActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
}

// "View Public Page" and org settings moved out — an organiser reaches for
// those once, not every week. These four are the ones that matter once
// there are 7-10 sessions running.
export function QuickActionsCard({ onCreateSession, className }: QuickActionsCardProps) {
  const actions: ActionItem[] = [
    { key: "create-session", label: "Create Session", icon: Plus, onClick: onCreateSession },
    { key: "duplicate-session", label: "Duplicate Session", icon: Copy, disabled: true },
    { key: "send-announcement", label: "Send Announcement", icon: Megaphone, disabled: true },
    { key: "export-attendance", label: "Export Attendance", icon: Download, disabled: true },
  ];

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-quick-actions-card">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-3 text-center transition-all hover:border-primary/40 hover:bg-accent/40 hover:scale-[1.01]",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:scale-100"
                )}
                data-testid={`organiser-quick-action-${action.key}`}
                title={action.disabled ? "Coming soon" : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium leading-tight text-center">{action.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
