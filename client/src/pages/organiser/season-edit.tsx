import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { TennisBallSpinner } from "@/components/ui/tennisLoader";

import { getSeasonById, getSessionsForSeason, updateSeason } from "@/lib/api/organizer-sessions";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";

// Same compact single-card shape as Create Season - editing a season
// never needs to be bigger than creating one. Changing the dates
// doesn't touch any session already attached (there's no code path
// here that could) - per the spec's own explicit rule, this only
// warns the organiser when a change would leave existing sessions
// outside the new date range, rather than silently detaching them.
export default function OrganiserSeasonEditPage() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/seasons/:id/edit");
  const seasonId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const seasonQuery = useQuery({
    queryKey: ["/api/organizer/seasons", seasonId],
    queryFn: () => getSeasonById(seasonId!),
    enabled: isAuthenticated && !!seasonId,
  });
  const sessionsQuery = useQuery({
    queryKey: ["/api/organizer/seasons", seasonId, "sessions"],
    queryFn: () => getSessionsForSeason(seasonId!),
    enabled: isAuthenticated && !!seasonId,
  });

  const [name, setName] = useState("");
  const [type, setType] = useState("social");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (seasonQuery.data && !loaded) {
      setName(seasonQuery.data.name);
      setType(seasonQuery.data.type);
      setStartDate(seasonQuery.data.startDate);
      setEndDate(seasonQuery.data.endDate);
      setDescription(seasonQuery.data.description ?? "");
      setLoaded(true);
    }
  }, [seasonQuery.data, loaded]);

  const checkSessionConflicts = (nextStart: string, nextEnd: string) => {
    const sessions = sessionsQuery.data ?? [];
    const outside = sessions.filter((s) => {
      const day = new Date(s.startAt).toISOString().slice(0, 10);
      return day < nextStart || day > nextEnd;
    });
    setConflictWarning(
      outside.length > 0
        ? `${outside.length} session${outside.length === 1 ? "" : "s"} fall${outside.length === 1 ? "s" : ""} outside the new season dates.`
        : null
    );
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim() || !startDate || !endDate) {
      toast({ title: "Name, start date and end date are required", variant: "destructive" });
      return;
    }
    if (endDate < startDate) {
      setError("End date must be after the start date.");
      return;
    }
    setSaving(true);
    try {
      await updateSeason(seasonId!, { name: name.trim(), type, startDate, endDate, description: description.trim() || null });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/seasons"] });
      toast({ title: "Season updated" });
      setLocation(`/organiser/seasons/${seasonId}`);
    } catch (err: any) {
      toast({ title: "Couldn't save season", description: err?.message ?? "Please try again.", variant: "destructive" });
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

  if (seasonQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <TennisBallSpinner />
      </div>
    );
  }

  if (!seasonQuery.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Season not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/seasons">Back to Seasons</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="organiser-season-edit-page">
      <SEO title={`Edit ${seasonQuery.data.name} | Seasons | TennisConnect`} description={`Edit the "${seasonQuery.data.name}" season.`} noIndex />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link
          href={`/organiser/seasons/${seasonId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="organiser-season-edit-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Season
        </Link>

        <h1 className="font-display text-2xl font-bold">Edit Season</h1>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Season details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="season-name">Season name *</Label>
              <Input id="season-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="organiser-season-edit-name" />
            </div>

            <div className="space-y-1.5">
              <Label>Season type / format *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="organiser-season-edit-type"><SelectValue /></SelectTrigger>
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
                    checkSessionConflicts(e.target.value, endDate);
                  }}
                  data-testid="organiser-season-edit-start"
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
                    checkSessionConflicts(startDate, e.target.value);
                  }}
                  data-testid="organiser-season-edit-end"
                />
                {error && <p className="text-xs text-destructive" data-testid="organiser-season-edit-date-error">{error}</p>}
              </div>
            </div>

            {conflictWarning && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2" data-testid="organiser-season-edit-conflict-warning">
                {conflictWarning}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="season-description">Description (optional)</Label>
              <Textarea id="season-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="organiser-season-edit-description" />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLocation(`/organiser/seasons/${seasonId}`)} data-testid="organiser-season-edit-cancel">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} data-testid="organiser-season-edit-save">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
