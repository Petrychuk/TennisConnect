import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AVAILABILITY_OPTIONS } from "@/components/profile/player/PlayerOverviewSections";

// [PROFILE] "Add quick edit for player availability" - spec [PLAY]
// section 7's own example almost verbatim: "Get better
// recommendations / Add when you usually play... / Add availability",
// opening an inline edit (not a Settings redirect, not the full
// Playing Preferences modal on a different page - just the one field
// this prompt is about). Only shown when it would actually change
// something: availability missing, and hasn't been dismissed this
// session.
export function AvailabilityNudge({
  onSaved,
}: {
  onSaved: (availability: string[]) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (dismissed) return null;

  const toggle = (slot: string) => {
    setSelected((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/me/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ availability: selected }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved(selected);
      setOpen(false);
      setDismissed(true);
      toast({ title: "Availability saved", description: "Your recommendations will update to match." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-4 py-3 mb-4"
        data-testid="play-availability-nudge"
      >
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Get better recommendations</p>
            <p className="text-xs text-muted-foreground">
              Add when you usually play and TennisConnect can find better matches for you.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" onClick={() => setOpen(true)} data-testid="play-availability-nudge-add">
            Add availability
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            data-testid="play-availability-nudge-dismiss"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" data-testid="play-availability-nudge-modal">
          <DialogHeader>
            <DialogTitle>When do you usually play?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {AVAILABILITY_OPTIONS.map((slot) => (
              <Badge
                key={slot}
                variant={selected.includes(slot) ? "default" : "outline"}
                className="cursor-pointer py-1.5 px-3"
                onClick={() => toggle(slot)}
                data-testid={`play-availability-nudge-option-${slot.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {slot}
              </Badge>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving || selected.length === 0} data-testid="play-availability-nudge-save">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
