import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { createSeason } from "@/lib/api/organizer-sessions";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";

// Deliberately a single compact centered card, not a multi-step
// wizard like Create Session - a Season has three required fields and
// one optional one, nothing that benefits from being split across
// steps. Sessions are NOT chosen here at all (see the hint text below
// the dates) - the flow is Create Season -> Season Details -> Add
// Sessions, so a season always exists as an empty container first
// rather than one long form trying to do everything at once.
export default function OrganiserSeasonNewPage() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [type, setType] = useState("social");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim() || !startDate || !endDate) {
      toast({ title: "Name, start date and end date are required", variant: "destructive" });
      return;
    }
    // Inline validation right under the field, not a toast after
    // submitting - per explicit request.
    if (endDate < startDate) {
      setError("End date must be after the start date.");
      return;
    }
    setSaving(true);
    try {
      const season = await createSeason({ name: name.trim(), type, startDate, endDate, description: description.trim() || null });
      toast({ title: `${season.name} created` });
      setLocation(`/organiser/seasons/${season.id}`);
    } catch (err: any) {
      toast({ title: "Couldn't create season", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }
  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardContent className="p-6 text-muted-foreground">
            You need to be an approved organiser to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="organiser-season-new-page">
      <SEO title="Create Season | Organiser Hub | TennisConnect" description="Set up a period to organise sessions and track results." noIndex />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href="/organiser/seasons"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="organiser-season-new-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Seasons
        </Link>

        <div>
          <h1 className="font-display text-2xl font-bold">Create New Season</h1>
          <p className="text-muted-foreground mt-1">Set up a period to organise sessions and track results.</p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Season details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="season-name">Season name *</Label>
              <Input
                id="season-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Winter 2026"
                data-testid="organiser-season-new-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Season type / format *</Label>
              {/* Every format is offered - a Season groups related
                  sessions of one format, not just Social Tennis (an
                  earlier, too-narrow version of this page assumed
                  that). Whichever type is picked here is what the
                  "Add Sessions" flow later filters by, so a Social
                  Tennis season and a League Match season can never end
                  up sharing the same ranking pool. */}
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="organiser-season-new-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="season-start">Start date *</Label>
                <Input
                  id="season-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setError(null);
                  }}
                  data-testid="organiser-season-new-start"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="season-end">End date *</Label>
                <Input
                  id="season-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setError(null);
                  }}
                  data-testid="organiser-season-new-end"
                />
                {error && (
                  <p className="text-xs text-destructive" data-testid="organiser-season-new-date-error">{error}</p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Sessions can be added after the season is created.</p>

            <div className="space-y-1.5">
              <Label htmlFor="season-description">Description (optional)</Label>
              <Textarea
                id="season-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Winter social and competitive tennis season."
                rows={3}
                data-testid="organiser-season-new-description"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLocation("/organiser/seasons")} data-testid="organiser-season-new-cancel">
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving} data-testid="organiser-season-new-submit">
                {saving ? "Creating..." : "Create Season"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
