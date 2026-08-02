import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, UserPlus, Megaphone, ListPlus, Copy, Download, MoreHorizontal, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { publishSession } from "@/lib/api/organizer-sessions";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

interface SessionActionsCardProps {
  session?: SessionListItem;
  onEdit?: () => void;
  variant?: "list" | "grid";
}

export function SessionActionsCard({ session, onEdit, variant = "list" }: SessionActionsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const notify = (label: string) => toast({ title: `${label} isn't wired up yet` });

  const handlePublish = async () => {
    if (!session || publishing) return;
    setPublishing(true);
    try {
      const updated = await publishSession(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      if (session.parentSessionId) {
        // This session is a division - refresh the container's own
        // Divisions list too, or it keeps showing this one as "draft"
        // even though it just went live (or was sent for review).
        queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.parentSessionId, "divisions"] });
      }
      toast(
        updated.status === "published"
          ? { title: "Published", description: "It's live now - players can register." }
          : { title: "Sent for review", description: "It'll go live once an admin approves it." }
      );
    } catch (error: any) {
      toast({ title: "Couldn't publish", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const isDraft = session?.status === "draft";

  const actions = [
    ...(isDraft
      ? [{ key: "publish", label: publishing ? "Publishing..." : "Publish Session", icon: Send, onClick: handlePublish }]
      : []),
    { key: "edit", label: "Edit Session", icon: Pencil, onClick: onEdit },
    { key: "invite", label: "Invite Players", icon: UserPlus, onClick: () => notify("Invite Players") },
    { key: "announce", label: "Send Announcement", icon: Megaphone, onClick: () => notify("Send Announcement") },
    { key: "waitlist", label: "Manage Waitlist", icon: ListPlus, onClick: () => notify("Manage Waitlist") },
    { key: "duplicate", label: "Duplicate Session", icon: Copy, onClick: () => notify("Duplicate Session") },
    { key: "export", label: "Export Player List", icon: Download, onClick: () => notify("Export Player List") },
  ];

  // Tablet's compact row only has room for the 4 most common actions plus
  // an overflow tile — the full list (with Duplicate/Export) still lives
  // one tap away via "More".
  const gridActions = [...actions.slice(0, 4), { key: "more", label: "More", icon: MoreHorizontal, onClick: () => notify("More Actions") }];

  if (variant === "grid") {
    return (
      <Card className="shadow-sm" data-testid="organiser-session-actions-card">
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {gridActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={action.onClick}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-3 text-center transition-all hover:border-primary/40 hover:bg-accent/40 hover:scale-[1.01]"
                  data-testid={`organiser-session-actions-${action.key}`}
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
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm hover:bg-accent/40 transition-colors text-left"
              )}
              data-testid={`organiser-session-actions-${action.key}`}
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              {action.label}
            </button>
          );
        })}

        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={() => notify("More Actions")}
          data-testid="organiser-session-actions-more"
        >
          <MoreHorizontal className="w-4 h-4 mr-2" />
          More Actions
        </Button>
      </CardContent>
    </Card>
  );
}
