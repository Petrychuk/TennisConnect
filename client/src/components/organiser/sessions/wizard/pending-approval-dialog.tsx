import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Hourglass } from "lucide-react";

interface PendingApprovalDialogProps {
  open: boolean;
  sessionName: string;
  sessionTypeLabel: string;
}

// After publishing, a session isn't live yet - it goes to an admin
// moderator first. Once approved it shows up on the organiser's own
// profile/hub and on players' profiles; until then it just sits as
// pending. This dialog is the moment that gets explained to the
// organiser, right after they hit Publish.
export function PendingApprovalDialog({ open, sessionName, sessionTypeLabel }: PendingApprovalDialogProps) {
  const [, setLocation] = useLocation();

  return (
    <Dialog open={open}>
      <DialogContent className="text-center" data-testid="organiser-wizard-pending-approval-dialog">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
          <Hourglass className="w-7 h-7" />
        </div>
        <DialogHeader className="items-center">
          <DialogTitle>Sent for approval</DialogTitle>
          <DialogDescription>
            Your {sessionTypeLabel.toLowerCase()} "{sessionName}" is now pending review by a moderator. Once
            it's approved, it'll appear on your profile and in the Organiser Hub for you to manage.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => setLocation("/organiser/sessions")} data-testid="organiser-wizard-pending-approval-done">
            Back to Sessions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
