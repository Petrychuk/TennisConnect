import { useEffect, useState } from "react";
import { OrganiserAccessGate } from "@/components/organiser/ui/organiser-layout";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Clock, Globe, Hourglass, LayoutGrid, MapPin, Repeat, Swords, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";

import { getSessionTemplates, updateSessionTemplate } from "@/lib/api/organizer-sessions";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { AU_CITY_TIMEZONES } from "@/lib/timezone";
import type { SessionTemplate, InsertSessionTemplate } from "@shared/schema";

// A focused settings form, not a reuse of the wizard's own Step2/Step3
// components - those include date/registration-window/cover-photo
// fields that genuinely don't apply here (a template has no date of
// its own at all). Only the fields SessionTemplate actually has
// columns for are editable - matches exactly what Save as Template
// captures, so there's nothing here that silently does nothing on
// save.
function OrganiserSessionTemplateEditPageContent() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/templates/:id/edit");
  const templateId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // No single-template GET route exists - list + find is the simplest
  // correct option given how few templates an organiser typically has,
  // rather than adding a new GET /session-templates/:id route for one
  // page's sake.
  const templatesQuery = useQuery({
    queryKey: ["/api/organizer/session-templates"],
    queryFn: getSessionTemplates,
    enabled: isAuthenticated,
  });
  const template = templatesQuery.data?.find((t) => t.id === templateId);

  const [form, setForm] = useState<Partial<InsertSessionTemplate>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (template && !loaded) {
      setForm(template);
      setLoaded(true);
    }
  }, [template, loaded]);

  const set = <K extends keyof InsertSessionTemplate>(key: K, value: InsertSessionTemplate[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!templateId || !form.name?.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Editing a template never touches any session already created
      // from it - there's no link stored anywhere between them (see
      // the schema's own comment on sessionTemplates).
      await updateSessionTemplate(templateId, form);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/session-templates"] });
      toast({ title: "Template updated" });
      setLocation("/organiser/sessions/templates");
    } catch (error: any) {
      toast({ title: "Couldn't save template", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  if (templatesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <TennisBallSpinner />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Template not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/sessions/templates">Back to Templates</Link>
        </Button>
      </div>
    );
  }

  // Compact field + control heights matching the session-edit / wizard step cards.
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

  return (
    <div className="min-h-screen bg-background" data-testid="organiser-template-edit-page">
      <SEO title={`Edit ${template.name} | Templates | TennisConnect`} description={`Edit the "${template.name}" session template.`} noIndex />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <Link
          href="/organiser/sessions/templates"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="organiser-template-edit-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </Link>

        <h1 className="font-display text-2xl font-bold">Edit Template</h1>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Template Name *" htmlFor="template-name" className="sm:col-span-2">
              <WithIcon icon={Type}>
                <Input
                  id="template-name"
                  value={form.name ?? ""}
                  onChange={(e) => set("name", e.target.value)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-template-edit-name"
                />
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
                <Input
                  id="template-venue"
                  value={form.location ?? ""}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. Lyne Park Tennis Centre"
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-template-edit-venue"
                />
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
                <Input
                  id="template-start-time"
                  type="time"
                  value={form.preferredStartTime ?? ""}
                  onChange={(e) => set("preferredStartTime", e.target.value)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-template-edit-starttime"
                />
              </WithIcon>
            </Field>

            <Field label="Duration (minutes)" htmlFor="template-duration">
              <WithIcon icon={Hourglass}>
                <Input
                  id="template-duration"
                  type="number"
                  min={0}
                  value={form.durationMinutes ?? ""}
                  onChange={(e) => set("durationMinutes", e.target.value ? Number(e.target.value) : null)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-template-edit-duration"
                />
              </WithIcon>
            </Field>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Capacity & Format</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Courts" htmlFor="template-courts">
              <WithIcon icon={LayoutGrid}>
                <Input
                  id="template-courts"
                  type="number"
                  min={0}
                  value={form.courtsCount ?? ""}
                  onChange={(e) => set("courtsCount", e.target.value ? Number(e.target.value) : null)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-template-edit-courts"
                />
              </WithIcon>
            </Field>

            <Field label="Max Players" htmlFor="template-capacity">
              <WithIcon icon={Repeat}>
                <Input
                  id="template-capacity"
                  type="number"
                  min={0}
                  value={form.maxParticipants ?? ""}
                  onChange={(e) => set("maxParticipants", e.target.value ? Number(e.target.value) : null)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-template-edit-capacity"
                />
              </WithIcon>
            </Field>

            <Field label="Number of Rounds" htmlFor="template-rounds">
              <WithIcon icon={Repeat}>
                <Input
                  id="template-rounds"
                  type="number"
                  min={0}
                  value={form.plannedRoundsCount ?? ""}
                  onChange={(e) => set("plannedRoundsCount", e.target.value ? Number(e.target.value) : null)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-template-edit-rounds"
                />
              </WithIcon>
            </Field>

            <Field label="Singles / Doubles">
              <WithIcon icon={Swords}>
                <Select value={form.matchMode ?? "doubles"} onValueChange={(v) => set("matchMode", v)}>
                  <SelectTrigger aria-label="Singles / doubles" className={cn(CONTROL, "pl-9")} data-testid="organiser-template-edit-matchmode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="singles">Singles</SelectItem>
                    <SelectItem value="doubles">Doubles</SelectItem>
                  </SelectContent>
                </Select>
              </WithIcon>
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Waiting List</p>
                <p className="text-xs text-muted-foreground">Enable a waiting list once the session is full.</p>
              </div>
              <Switch
                id="template-waitinglist"
                checked={form.waitingListEnabled ?? true}
                onCheckedChange={(v) => set("waitingListEnabled", v)}
                data-testid="organiser-template-edit-waitinglist"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} data-testid="organiser-template-edit-save">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" onClick={() => setLocation("/organiser/sessions/templates")} data-testid="organiser-template-edit-cancel">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// Access (signed in, organiser or admin) is checked once, for every Hub
// page, by OrganiserAccessGate (components/organiser/ui/organiser-layout.tsx).
export default function OrganiserSessionTemplateEditPage() {
  return (
    <OrganiserAccessGate>
      <OrganiserSessionTemplateEditPageContent />
    </OrganiserAccessGate>
  );
}
