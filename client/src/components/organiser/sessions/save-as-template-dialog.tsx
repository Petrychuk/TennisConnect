import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSessionById, createSessionTemplate } from "@/lib/api/organizer-sessions";
import { sessionToDraft, draftToTemplateConfig } from "@/lib/organiser-session-wizard-types";

interface SaveAsTemplateDialogProps {
  sessionId: string;
  sessionTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Reuses sessionToDraft (the same conversion Duplicate Session already
// relies on) rather than a separate session-to-template mapping - a
// template is drawn from exactly the same "reusable settings, not
// event-specific data" subset either way. draftToTemplateConfig then
// narrows that down to just the columns a template actually has (see
// its own comment) - date/registered players/scores etc. were never
// part of the draft this pulls from in the first place, so there's
// nothing further to strip out here.
export function SaveAsTemplateDialog({ sessionId, sessionTitle, open, onOpenChange }: SaveAsTemplateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(sessionTitle);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const fullSession = await getSessionById(sessionId);
      const draft = sessionToDraft(fullSession);
      const config = draftToTemplateConfig(draft, name.trim());
      await createSessionTemplate(config);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/session-templates"] });
      toast({
        title: "Template saved successfully.",
        description: "Find it under Templates whenever you're ready to reuse it.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Couldn't save template", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="organiser-save-as-template-dialog">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save this session setup for future use. Players, dates, results and live session data
            will not be copied.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="save-template-name">Template name *</Label>
          <Input
            id="save-template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="organiser-save-as-template-name"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="organiser-save-as-template-cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="organiser-save-as-template-confirm">
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
