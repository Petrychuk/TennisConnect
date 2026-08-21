import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import { getSessionById, updateSession } from "@/lib/api/organizer-sessions";
import { NumberField } from "@/components/organiser/sessions/wizard/number-field";

// A single-page edit form for the core, always-real fields (title,
// venue, date/time, capacity, pricing, registration window, waiting
// list, description) via the real updateSession endpoint - this is
// deliberately not the full multi-step creation wizard pre-filled (a
// separate, larger piece of work), but it's genuinely functional
// rather than a placeholder.
export default function OrganiserSessionEditPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id/edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", params?.id],
    queryFn: () => getSessionById(params!.id),
    enabled: !!params?.id,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [pricing, setPricing] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState("");
  const [waitingListEnabled, setWaitingListEnabled] = useState(true);
  const [registrationCloses, setRegistrationCloses] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = sessionQuery.data;
    if (!session || loaded) return;
    const start = new Date(session.startAt);
    setTitle(session.title);
    setDescription(session.description ?? "");
    setVenue(session.location ?? "");
    setDate(start.toISOString().split("T")[0]);
    setStartTime(start.toTimeString().slice(0, 5));
    setEndTime(session.endAt ? new Date(session.endAt).toTimeString().slice(0, 5) : "");
    setMaxParticipants(session.maxParticipants != null ? String(session.maxParticipants) : "");
    const priceNum = session.price != null ? Number(session.price) : 0;
    setPricing(priceNum > 0 ? "paid" : "free");
    setPrice(priceNum > 0 ? String(priceNum) : "");
    setWaitingListEnabled(session.waitingListEnabled);
    setRegistrationCloses(session.registrationClosesAt ? new Date(session.registrationClosesAt).toISOString().split("T")[0] : "");
    setLoaded(true);
  }, [sessionQuery.data, loaded]);

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardHeader>
            <CardTitle>Organiser access required</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            You need to be an approved organiser to view this page. Head to your profile to
            request organiser access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = sessionQuery.data;

  if (sessionQuery.isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <TennisBallSpinner />
      </div>
    );
  }

  const handleSave = async () => {
    if (!params?.id || saving) return;
    if (!title.trim() || !venue.trim() || !date) {
      toast({ title: "Name, venue, and date are required", variant: "destructive" });
      return;
    }
    if (registrationCloses && registrationCloses > date) {
      toast({ title: "Registration can't close after the session date", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateSession(params.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        location: venue.trim(),
        startAt: new Date(`${date}T${startTime || "00:00"}`),
        endAt: endTime ? new Date(`${date}T${endTime}`) : undefined,
        maxParticipants: maxParticipants.trim() ? Number(maxParticipants) : undefined,
        price: pricing === "paid" ? Number(price || 0) : 0,
        waitingListEnabled,
        registrationClosesAt: registrationCloses ? new Date(`${registrationCloses}T23:59`) : undefined,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      toast({ title: "Saved", description: "Session details updated." });
      setLocation(`/organiser/sessions/${params.id}`);
    } catch (error: any) {
      toast({ title: "Couldn't save", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8" data-testid="organiser-session-edit">
      <SEO title={`Edit ${session.title} | Organiser Hub | TennisConnect`} description="Edit your session's details." noIndex />
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href={`/organiser/sessions/${params?.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="organiser-session-edit-back">
          <ArrowLeft className="w-4 h-4" />
          Back to {session.title}
        </Link>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Edit Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Session Name</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="organiser-session-edit-title" />
            </div>

            <div className="space-y-1.5">
              <Label>Venue</Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} data-testid="organiser-session-edit-venue" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="organiser-session-edit-date" />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="organiser-session-edit-start-time" />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="organiser-session-edit-end-time" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Registration Closes</Label>
              <Input type="date" value={registrationCloses} max={date || undefined} onChange={(e) => setRegistrationCloses(e.target.value)} data-testid="organiser-session-edit-registration-closes" />
              {date && registrationCloses > date && (
                <p className="text-xs text-destructive">Registration can't close after the session date.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Max Players</Label>
                <NumberField min={1} value={maxParticipants === "" ? NaN : Number(maxParticipants)} onChange={(v) => setMaxParticipants(String(v))} placeholder="No limit" data-testid="organiser-session-edit-max-players" />
              </div>
              <div className="space-y-1.5">
                <Label>Pricing</Label>
                <RadioGroup value={pricing} onValueChange={(v) => setPricing(v as "free" | "paid")} className="flex items-center gap-4 h-10">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="free" data-testid="organiser-session-edit-pricing-free" />
                    Free
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="paid" data-testid="organiser-session-edit-pricing-paid" />
                    Paid
                  </label>
                </RadioGroup>
              </div>
            </div>

            {pricing === "paid" && (
              <div className="space-y-1.5">
                <Label>Price</Label>
                <NumberField min={0} value={price === "" ? NaN : Number(price)} onChange={(v) => setPrice(String(v))} data-testid="organiser-session-edit-price" />
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <Label className="text-sm">Waiting List</Label>
              <Switch checked={waitingListEnabled} onCheckedChange={setWaitingListEnabled} data-testid="organiser-session-edit-waiting-list" />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-24" data-testid="organiser-session-edit-description" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLocation(`/organiser/sessions/${params?.id}`)} data-testid="organiser-session-edit-cancel">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} data-testid="organiser-session-edit-save">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
