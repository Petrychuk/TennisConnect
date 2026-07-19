import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, UserPlus, Megaphone, ListPlus, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SessionActionsCardProps {
  onEdit?: () => void;
}

export function SessionActionsCard({ onEdit }: SessionActionsCardProps) {
  const { toast } = useToast();
  const notify = (label: string) => toast({ title: `${label} isn't wired up yet` });

  const actions = [
    { key: "edit", label: "Edit Session", icon: Pencil, onClick: onEdit },
    { key: "invite", label: "Invite Players", icon: UserPlus, onClick: () => notify("Invite Players") },
    { key: "announce", label: "Send Announcement", icon: Megaphone, onClick: () => notify("Send Announcement") },
    { key: "waitlist", label: "Manage Waitlist", icon: ListPlus, onClick: () => notify("Manage Waitlist") },
    { key: "more", label: "More Actions", icon: MoreHorizontal, onClick: () => notify("More Actions") },
  ];

  return (
    <Card className="shadow-sm" data-testid="organiser-session-actions-card">
      <CardHeader>
        <CardTitle className="text-base">Actions</CardTitle>
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
              data-testid={`organiser-session-actions-${action.key}`}
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
