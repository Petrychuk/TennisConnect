import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { OrganiserLayout } from "@/components/organiser/ui/organiser-layout";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarDays, ChevronRight, FileText, MapPin, Users } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";
import { getSessionById, updateSession } from "@/lib/api/organizer-sessions";
import { friendlyApiError } from "@/lib/apiError";
import { NumberField } from "@/components/organiser/sessions/wizard/number-field";
import { AU_CITY_TIMEZONES, zonedTimeToUtc, toZonedDateTimeInputs } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { sessionCategoryOf } from "@shared/sessionCategories";
import { SESSION_LEVEL_OPTIONS, isMixedSession } from "@/lib/organiser-session-wizard-types";
import { POLICY_LABELS, policyColumns, readSessionPolicies, type SessionPolicies } from "@shared/sessionPolicies";

// A single-page edit form for the core, always-real fields (title,
// venue, date/time, capacity, pricing, registration window, waiting
// list, description) via the real updateSession endpoint - this is
// deliberately not the full multi-step creation wizard pre-filled (a
// separate, larger piece of work), but it's genuinely functional
// rather than a placeholder.
function OrganiserSessionEditPageContent() {
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
  const [timeZone, setTimeZone] = useState("Australia/Sydney");
  const [courtsCount, setCourtsCount] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [pricing, setPricing] = useState<"free" | "paid">("free");
  const [price, setPrice] = useState("");
  const [waitingListEnabled, setWaitingListEnabled] = useState(true);
  // Singles / Doubles / Mixed - changed when the turnout is not what was planned.
  const [matchFormat, setMatchFormat] = useState<"singles" | "doubles" | "mixed">("doubles");
  // "" = all levels.
  const [skillLevel, setSkillLevel] = useState("");
  const [registrationCloses, setRegistrationCloses] = useState("");
  const [registrationClosesTime, setRegistrationClosesTime] = useState("23:59");
  // Rules & policies - their own columns now; an older session's are split
  // out of its description here, and saved to the columns (and out of the
  // description) on the next save. shared/sessionPolicies.ts
  const [policies, setPolicies] = useState<SessionPolicies>({ rules: null, refund: null, lateArrival: null, cancellation: null });
  // Rules & policies start collapsed; the values live in `policies` above, so
  // collapsing never clears them.
  const [policiesOpen, setPoliciesOpen] = useState(false);
  // Inline errors appear after the first Save attempt, next to the field.
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = sessionQuery.data;
    if (!session || loaded) return;
    const zone = session.timeZone ?? "Australia/Sydney";
    // Reads the venue's own wall-clock date/time (see
    // toZonedDateTimeInputs) - was previously `new Date(session.startAt)`
    // + `.toISOString()`/`.toTimeString()`, which read the UTC calendar
    // date and the BROWSER's own local clock time respectively, neither
    // of which is what the organizer actually set for the venue.
    const { date: startDate, time: startTimeStr } = toZonedDateTimeInputs(session.startAt, zone);
    setTitle(session.title);
    const read = readSessionPolicies(session);
    setDescription(read.description ?? "");
    setPolicies(read.policies);
    setVenue(session.location ?? "");
    setTimeZone(zone);
    setCourtsCount(session.courtsCount != null ? String(session.courtsCount) : "");
    setDate(startDate);
    setStartTime(startTimeStr);
    setEndTime(session.endAt ? toZonedDateTimeInputs(session.endAt, zone).time : "");
    setMaxParticipants(session.maxParticipants != null ? String(session.maxParticipants) : "");
    const priceNum = session.price != null ? Number(session.price) : 0;
    setPricing(priceNum > 0 ? "paid" : "free");
    setPrice(priceNum > 0 ? String(priceNum) : "");
    setWaitingListEnabled(session.waitingListEnabled);
    setMatchFormat(isMixedSession(session) ? "mixed" : session.matchMode === "singles" ? "singles" : "doubles");
    setSkillLevel(session.skillLevel ?? "");
    // A close time after the session starts can't be valid. Older sessions can
    // carry one (the Registration switch used to reopen by pushing it a year
    // out), so it is pulled back to the start instead of opening the form on
    // an error the organiser did not cause.
    const closes = session.registrationClosesAt ? toZonedDateTimeInputs(session.registrationClosesAt, zone) : null;
    const closesAfterStart = !!closes && closes.date > startDate;
    setRegistrationCloses(closesAfterStart ? startDate : closes?.date ?? "");
    setRegistrationClosesTime(closesAfterStart ? startTimeStr : closes?.time ?? "23:59");
    setLoaded(true);
  }, [sessionQuery.data, loaded]);



  const session = sessionQuery.data;
  const usesMatchFormat = session ? sessionCategoryOf(session.type).usesMatchFormat : false;

  // A draft is finished in the wizard: this flat form insists on name, venue and
  // date, and has no format, cover, visibility or registration-open fields.
  const isDraft = session?.status === "draft";
  useEffect(() => {
    if (isDraft && params?.id) setLocation(`/organiser/sessions/new?draft=${params.id}`, { replace: true });
  }, [isDraft, params?.id, setLocation]);

  // An archived session is closed - it can't be edited, so don't show the form.
  const isArchived = session?.status === "archived";
  useEffect(() => {
    if (isArchived && params?.id) {
      toast({ title: "Archived sessions can't be edited", description: "Duplicate it to run it again." });
      setLocation(`/organiser/sessions/${params.id}`, { replace: true });
    }
  }, [isArchived, params?.id, setLocation, toast]);

  if (sessionQuery.isLoading || !session || isDraft || isArchived) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <TennisBallSpinner />
      </div>
    );
  }

  const handleSave = async () => {
    if (!params?.id || saving) return;
    setSubmitted(true);
    if (!title.trim() || !venue.trim() || !date) {
      toast({ title: "Name, venue, and date are required", variant: "destructive" });
      return;
    }
    if (registrationCloses && registrationCloses > date) {
      toast({ title: "Registration can't close after the session date", variant: "destructive" });
      return;
    }
    if (pricing === "paid" && !(Number(price) > 0)) {
      toast({ title: "Enter a price for a paid session", description: "Or switch the session to Free.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateSession(params.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        location: venue.trim(),
        timeZone,
        courtsCount: courtsCount.trim() ? Number(courtsCount) : undefined,
        startAt: zonedTimeToUtc(date, startTime || "00:00", timeZone),
        endAt: endTime ? zonedTimeToUtc(date, endTime, timeZone) : undefined,
        maxParticipants: maxParticipants.trim() ? Number(maxParticipants) : undefined,
        price: pricing === "paid" ? Number(price || 0) : 0,
        waitingListEnabled,
        // Mixed is doubles for pairing; the mix itself is the category. Leaving
        // Mixed falls back to Open; Men's/Women's are kept otherwise.
        ...(usesMatchFormat
          ? {
              matchMode: matchFormat === "singles" ? "singles" : "doubles",
              ...(matchFormat === "mixed" ? { category: "mixed" } : session.category === "mixed" ? { category: "open" } : {}),
            }
          : {}),
        skillLevel: skillLevel || null,
        registrationClosesAt: registrationCloses ? zonedTimeToUtc(registrationCloses, registrationClosesTime || "23:59", timeZone) : undefined,
        ...policyColumns(policies),
      } as any);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      // Players see the same session on Play: without this /play keeps the old description, time and price.
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions"] });
      toast({ title: "Saved", description: "Session details updated." });
      setLocation(`/organiser/sessions/${params.id}`);
    } catch (error: any) {
      toast({ title: "Couldn't save", description: friendlyApiError(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const nameError = submitted && !title.trim();
  const venueError = submitted && !venue.trim();
  const dateError = submitted && !date;
  const priceError = submitted && pricing === "paid" && !(Number(price) > 0);
  const closesError = !!date && !!registrationCloses && registrationCloses > date;
  const policiesConfigured = (Object.keys(POLICY_LABELS) as (keyof SessionPolicies)[]).some((k) => (policies[k] ?? "").trim() !== "");

  return (
    <div className="px-4 pt-4 sm:pt-6 overflow-x-hidden" data-testid="organiser-session-edit">
      <SEO title={`Edit ${session.title} | Organiser Hub | TennisConnect`} description="Edit your session's details." noIndex />
      <div className="mx-auto w-full max-w-[820px] space-y-3">
        {/* Compact header: where you came from, then the title. */}
        <div>
          <Link href={`/organiser/sessions/${params?.id}`} className="inline-flex max-w-full items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground min-h-11 sm:min-h-0" data-testid="organiser-session-edit-back">
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="truncate">Back to {session.title}</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight mt-0.5">Edit Session</h1>
        </div>

        {/* ---------- Session Details ---------- */}
        <EditSection icon={CalendarDays} title="Session Details" testId="organiser-session-edit-section-details">
          <Field label="Session Name" required htmlFor="organiser-session-edit-title" error={nameError ? "Enter a session name." : undefined}>
            <Input id="organiser-session-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={nameError} data-testid="organiser-session-edit-title" />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3">
            <Field label="Venue" required htmlFor="organiser-session-edit-venue" error={venueError ? "Enter a venue." : undefined}>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
                <Input id="organiser-session-edit-venue" value={venue} onChange={(e) => setVenue(e.target.value)} className="pl-9" aria-invalid={venueError} data-testid="organiser-session-edit-venue" />
              </div>
            </Field>
            <Field label="City / Timezone" required>
              <Select value={timeZone} onValueChange={setTimeZone}>
                <SelectTrigger aria-label="City / timezone" data-testid="organiser-session-edit-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AU_CITY_TIMEZONES.map((c) => (
                    <SelectItem key={c.timeZone} value={c.timeZone}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Phone: Date, then Start|End side by side, then Courts. Tablet: two columns. Desktop: one row of four. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3">
            <Field label="Date" required htmlFor="organiser-session-edit-date" error={dateError ? "Choose a date." : undefined} className="col-span-2 sm:col-span-1">
              <Input id="organiser-session-edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={dateError} data-testid="organiser-session-edit-date" />
            </Field>
            <Field label="Start Time" required htmlFor="organiser-session-edit-start-time">
              <Input id="organiser-session-edit-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="organiser-session-edit-start-time" />
            </Field>
            <Field label="End Time" htmlFor="organiser-session-edit-end-time">
              <Input id="organiser-session-edit-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="organiser-session-edit-end-time" />
            </Field>
            <Field label="Courts" className="col-span-2 sm:col-span-1">
              <NumberField min={1} value={courtsCount === "" ? NaN : Number(courtsCount)} onChange={(v) => setCourtsCount(String(v))} placeholder="Not set" data-testid="organiser-session-edit-courts" />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-3">
            {usesMatchFormat && (
              <Field label="Format" htmlFor="organiser-session-edit-match-mode">
                <Select value={matchFormat} onValueChange={(v) => setMatchFormat(v as "singles" | "doubles" | "mixed")}>
                  <SelectTrigger id="organiser-session-edit-match-mode" aria-label="Format" data-testid="organiser-session-edit-match-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doubles">Doubles</SelectItem>
                    <SelectItem value="mixed">Mixed Doubles</SelectItem>
                    <SelectItem value="singles">Singles</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Player level" htmlFor="organiser-session-edit-level">
              <Select value={skillLevel || "all"} onValueChange={(v) => setSkillLevel(v === "all" ? "" : v)}>
                <SelectTrigger id="organiser-session-edit-level" aria-label="Player level" data-testid="organiser-session-edit-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </EditSection>

        {/* ---------- Registration ---------- */}
        <EditSection icon={Users} title="Registration" testId="organiser-session-edit-section-registration">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-3">
            <Field label="Registration closes" htmlFor="organiser-session-edit-registration-closes" error={closesError ? "Registration can't close after the session date." : undefined} className="md:col-span-2">
              <div className="flex gap-2">
                <Input id="organiser-session-edit-registration-closes" type="date" value={registrationCloses} max={date || undefined} onChange={(e) => setRegistrationCloses(e.target.value)} className="flex-1 min-w-0" aria-invalid={closesError} data-testid="organiser-session-edit-registration-closes" />
                <Input type="time" aria-label="Registration closes time" value={registrationClosesTime} onChange={(e) => setRegistrationClosesTime(e.target.value)} className="w-32 shrink-0" data-testid="organiser-session-edit-registration-closes-time" />
              </div>
            </Field>
            <Field label="Max Players">
              <NumberField min={1} value={maxParticipants === "" ? NaN : Number(maxParticipants)} onChange={(v) => setMaxParticipants(String(v))} placeholder="No limit" data-testid="organiser-session-edit-max-players" />
            </Field>

            <Field label="Pricing" required>
              {/* Segmented control - the same look as the Create wizard. */}
              <RadioGroup value={pricing} onValueChange={(v) => setPricing(v as "free" | "paid")} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Pricing">
                <label className={SEGMENT}>
                  <RadioGroupItem value="free" className="absolute inset-0 h-full w-full rounded-lg border-0 opacity-0 cursor-pointer" data-testid="organiser-session-edit-pricing-free" />
                  Free
                </label>
                <label className={SEGMENT}>
                  <RadioGroupItem value="paid" className="absolute inset-0 h-full w-full rounded-lg border-0 opacity-0 cursor-pointer" data-testid="organiser-session-edit-pricing-paid" />
                  Paid
                </label>
              </RadioGroup>
            </Field>
            {/* Only a paid session has a price: nothing irrelevant is left on screen for Free. */}
            {pricing === "paid" && (
              <Field label="Price" required error={priceError ? "Enter a price above $0, or choose Free." : undefined}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>$</span>
                  <NumberField min={0} value={price === "" ? NaN : Number(price)} onChange={(v) => setPrice(String(v))} className="pl-7" data-testid="organiser-session-edit-price" />
                </div>
              </Field>
            )}
            <div className="flex items-center justify-between gap-3 md:col-start-3 rounded-xl border border-input px-3 min-h-11 md:pointer-fine:min-h-9 self-end">
              <Label htmlFor="organiser-session-edit-waiting-list" className="text-sm font-medium">Waiting list</Label>
              <Switch id="organiser-session-edit-waiting-list" checked={waitingListEnabled} onCheckedChange={setWaitingListEnabled} data-testid="organiser-session-edit-waiting-list" />
            </div>
          </div>
        </EditSection>

        {/* ---------- Session Information ---------- */}
        <EditSection icon={FileText} title="Session Information" testId="organiser-session-edit-section-information">
          <Field label="Description" htmlFor="organiser-session-edit-description">
            <Textarea id="organiser-session-edit-description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" data-testid="organiser-session-edit-description" />
          </Field>

          <Collapsible open={policiesOpen} onOpenChange={setPoliciesOpen} className="rounded-xl border border-border" data-testid="organiser-session-edit-policies">
            <CollapsibleTrigger
              className="group flex w-full items-center gap-2 px-3 min-h-11 text-left text-sm font-semibold rounded-xl hover:bg-muted/50"
              data-testid="organiser-session-edit-policies-toggle"
            >
              <ChevronRight className="w-4 h-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" aria-hidden />
              <span>Rules &amp; policies</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground" data-testid="organiser-session-edit-policies-status">
                {policiesConfigured ? "Configured" : "Optional"}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 border-t border-border p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Optional. Shown to players on the session page.</p>
              {(Object.keys(POLICY_LABELS) as (keyof SessionPolicies)[]).map((key) => (
                <Field key={key} label={POLICY_LABELS[key]} htmlFor={`organiser-session-edit-policy-${key}`}>
                  <Textarea
                    id={`organiser-session-edit-policy-${key}`}
                    value={policies[key] ?? ""}
                    onChange={(e) => setPolicies((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="min-h-16"
                    data-testid={`organiser-session-edit-policy-${key}`}
                  />
                </Field>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </EditSection>

        {/* Sticky action bar: Save is always in reach on a long form. On a
            phone it sits above the Hub's bottom navigation. */}
        <div className="sticky bottom-16 md:bottom-0 z-10 -mx-4 px-4 py-3 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="min-h-11 md:pointer-fine:min-h-9 px-4" onClick={() => setLocation(`/organiser/sessions/${params?.id}`)} data-testid="organiser-session-edit-cancel">
              Cancel
            </Button>
            <Button size="sm" className="min-h-11 md:pointer-fine:min-h-9 px-5" onClick={handleSave} disabled={saving} data-testid="organiser-session-edit-save">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One segment of a segmented control; an invisible radio over it gets the click and the focus.
const SEGMENT =
  "relative flex min-h-11 md:pointer-fine:min-h-8 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-[[data-state=checked]]:bg-background has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

/** One section card: an icon chip and a small title, the same look as the Create wizard's cards. */
function EditSection({ icon: Icon, title, testId, children }: { icon: ComponentType<{ className?: string }>; title: string; testId: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm" data-testid={testId}>
      <h2 className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
          <Icon className="w-4 h-4" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Small muted label + control + inline error. A required field gets a red asterisk. */
function Field({ label, required, htmlFor, error, className, children }: { label: string; required?: boolean; htmlFor?: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("space-y-1 min-w-0", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

// Inside the Organiser Hub shell (sidebar, phone bar, bottom navigation) like
// every other Hub page; the shell also does the access check
// (OrganiserAccessGate, components/organiser/ui/organiser-layout.tsx).
export default function OrganiserSessionEditPage() {
  return (
    <OrganiserLayout
      testId="organiser-session-edit-page"
      seoTitle="Edit Session | Organiser Hub | TennisConnect"
      seoDescription="Edit your session's details."
      mobileTitle="Edit Session"
    >
      <OrganiserSessionEditPageContent />
    </OrganiserLayout>
  );
}
