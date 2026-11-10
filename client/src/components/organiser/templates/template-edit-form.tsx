import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Globe, Hourglass, LayoutGrid, MapPin, Repeat, Swords, Type, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { updateSessionTemplate } from "@/lib/api/organizer-sessions";
import { SESSION_LEVEL_OPTIONS, SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { AU_CITY_TIMEZONES } from "@/lib/timezone";
import type { SessionTemplate, InsertSessionTemplate } from "@shared/schema";

// Compact control height matching the session-edit / wizard step cards.
const CONTROL = "h-11 md:pointer-fine:h-9";

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1 min-w-0", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function WithIcon({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="sm:col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">{children}</h3>;
}

/**
 * The template settings form (Basics + Capacity & Format), shown in the Edit
 * Template side panel. Only the fields SessionTemplate has columns for.
 * Editing a template never touches sessions already created from it - nothing
 * links them (see the comment on sessionTemplates in shared/schema.ts).
 */
export function TemplateEditForm({ template, onSaved, onCancel }: { template: SessionTemplate; onSaved: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<InsertSessionTemplate>>(template);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof InsertSessionTemplate>(key: K, value: InsertSessionTemplate[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name?.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateSessionTemplate(template.id, form);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/session-templates"] });
      toast({ title: "Template updated" });
      onSaved();
    } catch (error: any) {
      toast({ title: "Couldn't save template", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="organiser-template-edit-form">
      <div className="flex-1 min-h-0 overflow-y-auto px-1 -mx-1 py-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SectionTitle>Basics</SectionTitle>
          <Field label="Template Name *" htmlFor="template-name" className="sm:col-span-2">
            <WithIcon icon={Type}>
              <Input id="template-name" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-name" />
            </WithIcon>
          </Field>

          <Field label="Session Type">
            <Select value={form.type ?? "social"} onValueChange={(v) => set("type", v)}>
              <SelectTrigger aria-label="Session type" className={CONTROL} data-testid="organiser-template-edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Venue" htmlFor="template-venue">
            <WithIcon icon={MapPin}>
              <Input id="template-venue" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Lyne Park Tennis Centre" className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-venue" />
            </WithIcon>
          </Field>

          <Field label="City / Timezone">
            <WithIcon icon={Globe}>
              <Select value={form.timeZone ?? "Australia/Sydney"} onValueChange={(v) => set("timeZone", v)}>
                <SelectTrigger aria-label="City / timezone" className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AU_CITY_TIMEZONES.map((c) => (
                    <SelectItem key={c.timeZone} value={c.timeZone}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WithIcon>
          </Field>

          <Field label="Usual Start Time" htmlFor="template-start-time">
            <WithIcon icon={Clock}>
              <Input id="template-start-time" type="time" value={form.preferredStartTime ?? ""} onChange={(e) => set("preferredStartTime", e.target.value)} className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-starttime" />
            </WithIcon>
          </Field>

          <Field label="Duration (minutes)" htmlFor="template-duration">
            <WithIcon icon={Hourglass}>
              <Input id="template-duration" type="number" min={0} value={form.durationMinutes ?? ""} onChange={(e) => set("durationMinutes", e.target.value ? Number(e.target.value) : null)} className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-duration" />
            </WithIcon>
          </Field>

          <SectionTitle>Capacity &amp; Format</SectionTitle>
          <Field label="Courts" htmlFor="template-courts">
            <WithIcon icon={LayoutGrid}>
              <Input id="template-courts" type="number" min={0} value={form.courtsCount ?? ""} onChange={(e) => set("courtsCount", e.target.value ? Number(e.target.value) : null)} className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-courts" />
            </WithIcon>
          </Field>

          <Field label="Max Players" htmlFor="template-capacity">
            <WithIcon icon={Repeat}>
              <Input id="template-capacity" type="number" min={0} value={form.maxParticipants ?? ""} onChange={(e) => set("maxParticipants", e.target.value ? Number(e.target.value) : null)} className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-capacity" />
            </WithIcon>
          </Field>

          <Field label="Number of Rounds" htmlFor="template-rounds">
            <WithIcon icon={Repeat}>
              <Input id="template-rounds" type="number" min={0} value={form.plannedRoundsCount ?? ""} onChange={(e) => set("plannedRoundsCount", e.target.value ? Number(e.target.value) : null)} className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-rounds" />
            </WithIcon>
          </Field>

          <Field label="Format">
            <WithIcon icon={Swords}>
              {/* Mixed is doubles + category "mixed" (see isMixedSession). */}
              <Select
                value={form.category === "mixed" ? "mixed" : form.matchMode ?? "doubles"}
                onValueChange={(v) => {
                  set("matchMode", v === "singles" ? "singles" : "doubles");
                  if (v === "mixed") set("category", "mixed");
                  else if (form.category === "mixed") set("category", "open");
                }}
              >
                <SelectTrigger aria-label="Format" className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-matchmode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="singles">Singles</SelectItem>
                  <SelectItem value="doubles">Doubles</SelectItem>
                  <SelectItem value="mixed">Mixed Doubles</SelectItem>
                </SelectContent>
              </Select>
            </WithIcon>
          </Field>

          <Field label="Player level">
            <WithIcon icon={Users}>
              <Select value={form.skillLevel || "all"} onValueChange={(v) => set("skillLevel", v === "all" ? null : v)}>
                <SelectTrigger aria-label="Player level" className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WithIcon>
          </Field>

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Waiting List</p>
              <p className="text-xs text-muted-foreground">Enable a waiting list once the session is full.</p>
            </div>
            <Switch id="template-waitinglist" checked={form.waitingListEnabled ?? true} onCheckedChange={(v) => set("waitingListEnabled", v)} data-testid="organiser-template-edit-waitinglist" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 mt-2 border-t border-border">
        <Button onClick={handleSave} disabled={saving} data-testid="organiser-template-edit-save">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving} data-testid="organiser-template-edit-cancel">
          Cancel
        </Button>
      </div>
    </div>
  );
}
