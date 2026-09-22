import { useEffect, useState } from "react";
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
import { ArrowLeft } from "lucide-react";
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
export default function OrganiserSessionTemplateEditPage() {
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

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

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

  return (
    <div className="min-h-screen bg-background" data-testid="organiser-template-edit-page">
      <SEO title={`Edit ${template.name} | Templates | TennisConnect`} description={`Edit the "${template.name}" session template.`} noIndex />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                data-testid="organiser-template-edit-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session Type</Label>
              <Select value={form.type ?? "social"} onValueChange={(v) => set("type", v)}>
                <SelectTrigger data-testid="organiser-template-edit-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-venue">Venue</Label>
              <Input
                id="template-venue"
                value={form.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                data-testid="organiser-template-edit-venue"
              />
            </div>
            <div className="space-y-1.5">
              <Label>City / Timezone</Label>
              <Select value={form.timeZone ?? "Australia/Sydney"} onValueChange={(v) => set("timeZone", v)}>
                <SelectTrigger data-testid="organiser-template-edit-timezone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AU_CITY_TIMEZONES.map((c) => (
                    <SelectItem key={c.timeZone} value={c.timeZone}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-start-time">Usual Start Time</Label>
              <Input
                id="template-start-time"
                type="time"
                value={form.preferredStartTime ?? ""}
                onChange={(e) => set("preferredStartTime", e.target.value)}
                data-testid="organiser-template-edit-starttime"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-duration">Duration (minutes)</Label>
              <Input
                id="template-duration"
                type="number"
                min={0}
                value={form.durationMinutes ?? ""}
                onChange={(e) => set("durationMinutes", e.target.value ? Number(e.target.value) : null)}
                data-testid="organiser-template-edit-duration"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Capacity & Format</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-courts">Courts</Label>
              <Input
                id="template-courts"
                type="number"
                min={0}
                value={form.courtsCount ?? ""}
                onChange={(e) => set("courtsCount", e.target.value ? Number(e.target.value) : null)}
                data-testid="organiser-template-edit-courts"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-capacity">Max Players</Label>
              <Input
                id="template-capacity"
                type="number"
                min={0}
                value={form.maxParticipants ?? ""}
                onChange={(e) => set("maxParticipants", e.target.value ? Number(e.target.value) : null)}
                data-testid="organiser-template-edit-capacity"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-rounds">Number of Rounds</Label>
              <Input
                id="template-rounds"
                type="number"
                min={0}
                value={form.plannedRoundsCount ?? ""}
                onChange={(e) => set("plannedRoundsCount", e.target.value ? Number(e.target.value) : null)}
                data-testid="organiser-template-edit-rounds"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Singles / Doubles</Label>
              <Select value={form.matchMode ?? "doubles"} onValueChange={(v) => set("matchMode", v)}>
                <SelectTrigger data-testid="organiser-template-edit-matchmode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="singles">Singles</SelectItem>
                  <SelectItem value="doubles">Doubles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 sm:col-span-2">
              <div>
                <Label htmlFor="template-waitinglist">Waiting List</Label>
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

        <div className="flex items-center gap-2">
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
