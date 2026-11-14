import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, MapPin, Repeat, Square, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { friendlyApiError } from "@/lib/apiError";
import { ensureMyOrganization, createSession, updateSession } from "@/lib/api/organizer-sessions";
import { createDraftSaver } from "@/lib/sessionDraftSaver";
import { SESSION_TYPE_OPTIONS, draftToSessionPayload } from "@/lib/organiser-session-wizard-types";
import { buildDraftFromTemplate } from "@/lib/templateQuickCreate";
import { toZonedDateTimeInputs, zonedTimeToUtc } from "@/lib/timezone";
import type { SessionTemplate } from "@shared/schema";

const DEFAULT_START = "18:30";

/**
 * Use Template, the short way: pick a date (and a start time if it differs) and
 * a DRAFT is created from the template, then its page opens. Nothing is
 * published here - publishing keeps all its usual checks (required fields,
 * organiser rights, review) on the session page. Anything the quick form can't
 * settle goes to the full wizard through "Advanced setup".
 */
export function CreateFromTemplateDialog({ template, onClose }: { template: SessionTemplate | null; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [submitted, setSubmitted] = useState(false);
  const [creating, setCreating] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (template) {
      setDate("");
      setStartTime(template.preferredStartTime || DEFAULT_START);
      setSubmitted(false);
      setCreating(false);
      busy.current = false;
    }
  }, [template?.id]);

  if (!template) return null;

  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === template.type)?.label ?? "Session";
  const zone = template.timeZone || "Australia/Sydney";
  const today = toZonedDateTimeInputs(new Date(), zone).date;
  const needsVenue = !template.location?.trim();

  let dateError: string | null = null;
  if (submitted) {
    if (!date) dateError = "Choose a date";
    else if (!startTime) dateError = "Choose a start time";
    else if (zonedTimeToUtc(date, startTime, zone).getTime() <= Date.now()) dateError = "Choose a date and time in the future";
  }

  const advancedHref = `/organiser/sessions/new?templateId=${template.id}`;

  const handleCreate = async () => {
    if (busy.current) return;
    setSubmitted(true);
    if (needsVenue || !date || !startTime || zonedTimeToUtc(date, startTime, zone).getTime() <= Date.now()) return;
    busy.current = true;
    setCreating(true);
    try {
      const draft = buildDraftFromTemplate(template, date, startTime);
      const saver = createDraftSaver({
        ensureOrganization: () => ensureMyOrganization(`${user?.name ?? "My"}'s Sessions`),
        create: (payload) => createSession(payload as any),
        update: (id, payload) => updateSession(id, payload as any),
      });
      const row = await saver.save((mode) => draftToSessionPayload(draft, mode) as any);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      toast({ title: "Session created from template", description: "It's saved as a draft - review it and publish when you're ready." });
      onClose();
      setLocation(`/organiser/sessions/${row.id}`);
    } catch (error) {
      toast({ title: "Couldn't create the session", description: friendlyApiError(error, "Please try again, or use Advanced setup."), variant: "destructive" });
    } finally {
      busy.current = false;
      setCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !creating && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="organiser-create-from-template-dialog">
        <DialogHeader>
          <DialogTitle>Create from Template</DialogTitle>
          <DialogDescription>Pick a date - everything else comes from the template.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5" data-testid="organiser-create-from-template-summary">
          <p className="font-display font-bold truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
            <span>{typeLabel}</span>
            {template.location && (<><span aria-hidden>·</span><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{template.location}</span></>)}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {template.courtsCount != null && <span className="flex items-center gap-1"><Square className="w-3.5 h-3.5" />{template.courtsCount} courts</span>}
            {template.maxParticipants != null && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{template.maxParticipants} players</span>}
            {template.plannedRoundsCount != null && <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" />{template.plannedRoundsCount} rounds</span>}
            {template.durationMinutes ? <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{template.durationMinutes} min</span> : null}
          </div>
        </div>

        {needsVenue && (
          <p className="text-sm text-destructive" role="alert" data-testid="organiser-create-from-template-needs-setup">
            This template has no venue yet. Use Advanced setup to finish the details.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="quick-create-date" className="text-xs font-medium text-muted-foreground">Session date *</label>
            <Input id="quick-create-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-11 md:pointer-fine:h-9" aria-invalid={!!dateError} data-testid="organiser-create-from-template-date" />
          </div>
          <div className="space-y-1">
            <label htmlFor="quick-create-time" className="text-xs font-medium text-muted-foreground">Start time</label>
            <Input id="quick-create-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-11 md:pointer-fine:h-9" data-testid="organiser-create-from-template-time" />
          </div>
          {dateError && <p className="col-span-2 text-xs text-destructive" role="alert" data-testid="organiser-create-from-template-error">{dateError}</p>}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:space-x-0">
          <Button variant="ghost" size="sm" className="justify-start px-0 sm:px-2 text-muted-foreground" onClick={() => { onClose(); setLocation(advancedHref); }} disabled={creating} data-testid="organiser-create-from-template-advanced">
            Advanced setup
          </Button>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={creating} data-testid="organiser-create-from-template-cancel">Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || needsVenue} data-testid="organiser-create-from-template-submit">
              {creating ? "Creating..." : "Create Session"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
