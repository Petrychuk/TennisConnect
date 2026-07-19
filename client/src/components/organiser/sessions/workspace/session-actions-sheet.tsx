import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Pencil,
  UserPlus,
  Megaphone,
  ListPlus,
  Download,
  Copy,
  Link2,
  QrCode,
  Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SessionActionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export function SessionActionsSheet({ open, onOpenChange, onEdit }: SessionActionsSheetProps) {
  const { toast } = useToast();
  const notify = (label: string) => toast({ title: `${label} isn't wired up yet` });

  const actions = [
    { key: "edit", label: "Edit Session", icon: Pencil, onClick: onEdit },
    { key: "invite", label: "Invite Players", icon: UserPlus, onClick: () => notify("Invite Players") },
    { key: "announce", label: "Send Announcement", icon: Megaphone, onClick: () => notify("Send Announcement") },
    { key: "waitlist", label: "Manage Waitlist", icon: ListPlus, onClick: () => notify("Manage Waitlist") },
    { key: "export", label: "Export Player List", icon: Download, onClick: () => notify("Export Player List") },
    { key: "duplicate", label: "Duplicate Session", icon: Copy, onClick: () => notify("Duplicate Session") },
    { key: "share", label: "Share Session Link", icon: Link2, onClick: () => notify("Share Session Link") },
    { key: "qr", label: "QR Code", icon: QrCode, onClick: () => notify("QR Code") },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]" data-testid="organiser-session-actions-sheet">
        <SheetTitle>Actions</SheetTitle>
        <div className="mt-2 space-y-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  action.onClick?.();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-3 text-sm hover:bg-accent/40 transition-colors text-left"
                data-testid={`organiser-session-actions-sheet-${action.key}`}
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                {action.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              notify("Cancel Session");
              onOpenChange(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-2 py-3 text-sm text-destructive hover:bg-destructive/5 transition-colors text-left"
            )}
            data-testid="organiser-session-actions-sheet-cancel"
          >
            <Ban className="w-4 h-4 shrink-0" />
            Cancel Session
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
