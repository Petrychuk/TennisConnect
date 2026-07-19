import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle2, ArrowUpDown, MessageSquare, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface PlayerActionsSheetProps {
  player: SessionPlayer | null;
  onOpenChange: (open: boolean) => void;
}

export function PlayerActionsSheet({ player, onOpenChange }: PlayerActionsSheetProps) {
  const { toast } = useToast();
  const notify = (label: string) => {
    if (!player) return;
    toast({ title: `${label} — coming soon`, description: `Would apply to ${player.name}.` });
  };

  const actions = [
    { key: "checkin", label: "Check In", icon: CheckCircle2 },
    { key: "move", label: "Move to Waiting", icon: ArrowUpDown },
    { key: "message", label: "Send Message", icon: MessageSquare },
    { key: "remove", label: "Remove", icon: Trash2, destructive: true },
  ];

  return (
    <Sheet open={!!player} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="organiser-registration-player-actions-sheet">
        <SheetTitle>{player?.name ?? "Player"}</SheetTitle>
        <div className="mt-2 space-y-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  notify(action.label);
                  onOpenChange(false);
                }}
                className={
                  action.destructive
                    ? "w-full flex items-center gap-3 rounded-xl px-2 py-3 text-sm text-destructive hover:bg-destructive/5 transition-colors text-left"
                    : "w-full flex items-center gap-3 rounded-xl px-2 py-3 text-sm hover:bg-accent/40 transition-colors text-left"
                }
                data-testid={`organiser-registration-player-actions-sheet-${action.key}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {action.label}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
