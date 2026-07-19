import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BellRing, Lock, QrCode, Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function RegistrationQuickActionsCard() {
  const { toast } = useToast();
  const notify = (label: string) => toast({ title: `${label} isn't wired up yet` });

  const actions = [
    { key: "reminder", label: "Send Check-in Reminder", icon: BellRing, onClick: () => notify("Send Check-in Reminder") },
    { key: "close", label: "Close Registration", icon: Lock, onClick: () => notify("Close Registration") },
    { key: "qr", label: "Print QR Check-in", icon: QrCode, onClick: () => notify("Print QR Check-in") },
    { key: "export", label: "Export Attendance", icon: Download, onClick: () => notify("Export Attendance") },
    { key: "duplicate", label: "Duplicate Session", icon: Copy, onClick: () => notify("Duplicate Session") },
  ];

  return (
    <Card className="shadow-sm" data-testid="organiser-registration-quick-actions-card">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm hover:bg-accent/40 transition-colors text-left"
              data-testid={`organiser-registration-quick-action-${action.key}`}
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              {action.label}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
