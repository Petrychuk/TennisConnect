import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ClipboardList, DollarSign, Globe, ImagePlus, LayoutGrid, MapPin, Trophy, Type, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/lib/uploadImage";
import { AU_CITY_TIMEZONES } from "@/lib/timezone";
import { getSeasons } from "@/lib/api/organizer-sessions";
import type { NewSessionDraft } from "@/lib/organiser-session-wizard-types";
import { NumberField } from "./number-field";
import { SessionWeatherPreview } from "./session-weather-preview";

interface Step2DateRegistrationProps {
  draft: NewSessionDraft;
  onChange: <K extends keyof NewSessionDraft>(key: K, value: NewSessionDraft[K]) => void;
}

// Same shape as createEmptyDraft's own local helper - just today's date
// as a yyyy-mm-dd string, for the "already passed" comparison below.
function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

// One control height for the whole step: 44px on anything touch (the project's
// tap-target rule, phones and iPads alike), and a denser 36px only from md up
// when the pointer is a mouse (pointer-fine).
const CONTROL = "h-11 md:pointer-fine:h-9";

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1 min-w-0", className)}>
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {children}
    </div>
  );
}

// A leading icon inside a text input or select. The icon is decoration only
// (pointer-events-none) and sits on the control's vertical centre; the control
// gets matching left padding. Date and time inputs are left alone: the browser
// already draws its own picker icon on the right.
function WithIcon({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
      {children}
    </div>
  );
}

// Section card. The content is a container-query grid: two columns only when
// the card itself is wide enough (>= 28rem), whatever the screen width - the
// Registration card is half the page on desktop and full width on a tablet.
const COLUMNS = {
  one: "",
  two: "@md:grid-cols-2",
  six: "@md:grid-cols-2 @2xl:grid-cols-6",
} as const;

function SectionCard({
  icon: Icon,
  title,
  children,
  columns = "two",
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  /** one: always a single column; two: 2 columns from 28rem; six: 2 columns, then a 6-column grid from 42rem */
  columns?: "one" | "two" | "six";
}) {
  return (
    <Card className="shadow-sm @container" data-testid={`organiser-wizard-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center gap-2.5 space-y-0 p-4 pb-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <CardTitle className="text-sm font-semibold leading-none">{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn("grid grid-cols-1 gap-3 p-4 pt-0", COLUMNS[columns])}>{children}</CardContent>
    </Card>
  );
}

// date + time pair, never wrapping, never wider than its card
function DateTimeRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] gap-2">{children}</div>;
}

// One segment of a segmented control (Free | Paid, Public | Members | Invite
// only). The radio is an invisible layer over the whole segment: it gets the click and the focus.
const SEGMENT =
  "relative flex min-h-11 md:pointer-fine:min-h-8 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-[[data-state=checked]]:bg-background has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

export function Step2DateRegistration({ draft, onChange }: Step2DateRegistrationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Only same-format seasons are offered - attaching a Social Tennis
  // session to an Americano season (or vice versa) would mix formats
  // into the same ranking pool, which the whole point of scoping a
  // season to one type is meant to prevent.
  const seasonsQuery = useQuery({
    queryKey: ["/api/organizer/seasons"],
    queryFn: getSeasons,
  });
  const matchingSeasons = (seasonsQuery.data ?? []).filter((s) => s.type === draft.type);

  const handlePhotoSelect = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Image is too large", description: "Please choose a file under 8MB.", variant: "destructive" });
      return;
    }
    // Uploaded to Supabase Storage right away and only the resulting URL
    // is kept in the draft - previously this read the file as a base64
    // data: URL and carried the whole image through session creation's
    // JSON body, which blew past express.json()'s size limit (413) for
    // any real photo.
    setIsUploadingCover(true);
    try {
      const { url } = await uploadImage("session-cover", file);
      onChange("coverImage", url);
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const visibilityHint: Record<NewSessionDraft["visibility"], string> = {
    public: "Anyone can find and join it on Play.",
    members: "Only your club members can join.",
    invite: "Only people you invite can join.",
  };

  return (
    <div className="space-y-3" data-testid="organiser-wizard-step2">
      {/* Cover photo: its own block, as before. */}
      <Card className="shadow-sm" data-testid="organiser-wizard-section-cover-photo">
        <CardContent className="p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
            data-testid="organiser-wizard-cover-photo-input"
          />
          {isUploadingCover ? (
            <div className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground">
              <TennisBallSpinner />
            </div>
          ) : draft.coverImage ? (
            <div className="flex items-center gap-3">
              <img src={draft.coverImage} alt="Session cover" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Cover photo</p>
                <p className="truncate text-xs text-muted-foreground">Shown on the session card and page.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 md:pointer-fine:h-9 md:pointer-fine:w-9"
                aria-label="Remove cover photo"
                onClick={() => onChange("coverImage", null)}
                data-testid="organiser-wizard-cover-photo-remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-16 w-full items-center gap-3 rounded-lg border-2 border-dashed border-border px-3 py-2 text-left text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary-text"
              data-testid="organiser-wizard-cover-photo-trigger"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
                <ImagePlus className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">Upload a cover photo</span>
                <span className="block text-xs">Optional — defaults to a standard court photo</span>
              </span>
            </button>
          )}
        </CardContent>
      </Card>

      <SectionCard icon={CalendarDays} title="Session" columns="six">
        <Field label="Session name" required className="@2xl:col-span-4">
          <WithIcon icon={Type}>
            <Input
              value={draft.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="e.g. Wednesday Social"
              className={cn(CONTROL, "pl-9")}
              data-testid="organiser-wizard-session-name"
            />
          </WithIcon>
        </Field>
        <Field label="Season" className="@2xl:col-span-2">
          <WithIcon icon={Trophy}>
            <Select value={draft.seasonId ?? "none"} onValueChange={(v) => onChange("seasonId", v === "none" ? null : v)}>
              <SelectTrigger aria-label="Season" className={cn(CONTROL, "pl-9")} data-testid="organiser-wizard-session-season">
                <SelectValue placeholder="No season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No season</SelectItem>
                {matchingSeasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WithIcon>
        </Field>
        <Field label="Venue" required className="@2xl:col-span-3">
          <WithIcon icon={MapPin}>
            <Input
              value={draft.venue}
              onChange={(e) => onChange("venue", e.target.value)}
              placeholder="e.g. Lyne Park Tennis Centre"
              className={cn(CONTROL, "pl-9")}
              data-testid="organiser-wizard-session-venue"
            />
          </WithIcon>
        </Field>
        <Field label="City" required className="@2xl:col-span-2">
          <WithIcon icon={Globe}>
            <Select value={draft.timeZone} onValueChange={(v) => onChange("timeZone", v)}>
              <SelectTrigger aria-label="City / timezone" className={cn(CONTROL, "pl-9")} data-testid="organiser-wizard-session-timezone">
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
          </WithIcon>
        </Field>
        <Field label="Courts" required className="@2xl:col-span-1">
          <WithIcon icon={LayoutGrid}>
            <NumberField
              min={1}
              value={draft.courtCount}
              onChange={(v) => onChange("courtCount", v)}
              className={cn(CONTROL, "pl-9")}
              data-testid="organiser-wizard-session-courts"
            />
          </WithIcon>
        </Field>
      </SectionCard>

      <SectionCard icon={CalendarDays} title="Date & Time" columns="one">
        <div className="grid grid-cols-2 gap-3 @md:grid-cols-3">
          <Field label="Date" required className="col-span-2 @md:col-span-1">
            <Input type="date" value={draft.date} onChange={(e) => onChange("date", e.target.value)} className={CONTROL} data-testid="organiser-wizard-date" />
          </Field>
          <Field label="Starts" required>
            <Input type="time" value={draft.startTime} onChange={(e) => onChange("startTime", e.target.value)} className={CONTROL} data-testid="organiser-wizard-start-time" />
          </Field>
          <Field label="Ends" required>
            <Input type="time" value={draft.endTime} onChange={(e) => onChange("endTime", e.target.value)} className={CONTROL} data-testid="organiser-wizard-end-time" />
          </Field>
        </div>
        {draft.date && draft.date < todayInput() && (
          <p className="text-xs text-destructive" data-testid="organiser-wizard-date-past-error">
            That date has already passed.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground md:pointer-fine:min-h-9">
            <input
              type="checkbox"
              checked={!!draft.endDate}
              onChange={(e) => onChange("endDate", e.target.checked ? draft.date : "")}
              className="h-4 w-4 accent-primary"
              data-testid="organiser-wizard-multiday-toggle"
            />
            Runs over several days
          </label>
          <SessionWeatherPreview city={AU_CITY_TIMEZONES.find((c) => c.timeZone === draft.timeZone)?.label ?? ""} date={draft.date} />
        </div>
        {draft.endDate && (
          <Field label="Ends on" className="max-w-full @md:max-w-[14rem]">
            <Input
              type="date"
              value={draft.endDate}
              min={draft.date || undefined}
              onChange={(e) => onChange("endDate", e.target.value)}
              className={CONTROL}
              data-testid="organiser-wizard-end-date"
            />
            {draft.date && draft.endDate < draft.date && (
              <p className="text-xs text-destructive" data-testid="organiser-wizard-end-date-error">
                End date can't be before the start date.
              </p>
            )}
          </Field>
        )}
      </SectionCard>

      {/* Who can come and at what price - side by side on a wide screen. */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <SectionCard icon={ClipboardList} title="Registration" columns="one">
          <Field label="Opens" required>
            <DateTimeRow>
              <Input
                type="date"
                value={draft.registrationOpens}
                onChange={(e) => onChange("registrationOpens", e.target.value)}
                className={CONTROL}
                data-testid="organiser-wizard-registration-opens"
              />
              <Input
                type="time"
                value={draft.registrationOpensTime}
                onChange={(e) => onChange("registrationOpensTime", e.target.value)}
                className={CONTROL}
                data-testid="organiser-wizard-registration-opens-time"
              />
            </DateTimeRow>
          </Field>
          <Field label="Closes" required>
            <DateTimeRow>
              <Input
                type="date"
                value={draft.registrationCloses}
                max={draft.date || undefined}
                onChange={(e) => onChange("registrationCloses", e.target.value)}
                className={CONTROL}
                data-testid="organiser-wizard-registration-closes"
              />
              <Input
                type="time"
                value={draft.registrationClosesTime}
                onChange={(e) => onChange("registrationClosesTime", e.target.value)}
                className={CONTROL}
                data-testid="organiser-wizard-registration-closes-time"
              />
            </DateTimeRow>
            {draft.date && draft.registrationCloses > draft.date && (
              <p className="text-xs text-destructive" data-testid="organiser-wizard-registration-closes-error">
                Registration can't close after the session date.
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max players">
              <WithIcon icon={Users}>
                <NumberField
                  min={1}
                  value={draft.maxPlayers}
                  onChange={(v) => onChange("maxPlayers", v)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-wizard-max-players"
                />
              </WithIcon>
            </Field>
            <Field label="Waiting list">
              <div className={cn(CONTROL, "flex items-center justify-between rounded-md border border-input px-3")}>
                <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                <Switch
                  checked={draft.waitingListEnabled}
                  onCheckedChange={(v) => onChange("waitingListEnabled", v)}
                  aria-label="Waiting List"
                  data-testid="organiser-wizard-waiting-list-toggle"
                />
              </div>
            </Field>
          </div>
          {draft.waitingListEnabled && (
            <Field label="Waiting list spots">
              <WithIcon icon={Users}>
                <NumberField
                  min={1}
                  value={draft.waitingListCapacity ?? NaN}
                  onChange={(v) => onChange("waitingListCapacity", v)}
                  placeholder="Unlimited"
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-wizard-waiting-list-capacity"
                />
              </WithIcon>
              <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground md:pointer-fine:min-h-9">
                <input
                  type="checkbox"
                  checked={draft.waitingListCapacity == null}
                  onChange={(e) => onChange("waitingListCapacity", e.target.checked ? null : 10)}
                  className="h-4 w-4 accent-primary"
                  data-testid="organiser-wizard-waiting-list-unlimited"
                />
                Unlimited
              </label>
            </Field>
          )}
          {/* "Allow Late Registration" was here - never saved and no rule
              behind it (Phase 1 audit 5.1). Registration closes at the time
              set above. */}
        </SectionCard>

        <SectionCard icon={DollarSign} title="Price & Visibility" columns="one">
          {/* Segmented choices: one row each, the explanation only for the one picked. */}
          <RadioGroup
            value={draft.pricing}
            onValueChange={(v) => onChange("pricing", v as NewSessionDraft["pricing"])}
            className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
            aria-label="Pricing"
            data-testid="organiser-wizard-pricing-mode"
          >
            <label className={SEGMENT}>
              <RadioGroupItem value="free" className="absolute inset-0 h-full w-full rounded-lg border-0 opacity-0 cursor-pointer" data-testid="organiser-wizard-pricing-free" />
              Free
            </label>
            <label className={SEGMENT}>
              <RadioGroupItem value="paid" className="absolute inset-0 h-full w-full rounded-lg border-0 opacity-0 cursor-pointer" data-testid="organiser-wizard-pricing-paid" />
              Paid
            </label>
          </RadioGroup>
          {draft.pricing === "paid" && (
            <Field label="Price per player" className="max-w-[12rem]">
              <WithIcon icon={DollarSign}>
                <NumberField
                  min={0}
                  value={draft.price}
                  onChange={(v) => onChange("price", v)}
                  className={cn(CONTROL, "pl-9")}
                  data-testid="organiser-wizard-price"
                />
              </WithIcon>
            </Field>
          )}
          {draft.pricing === "paid" && (
            <p className="text-xs text-muted-foreground" data-testid="organiser-wizard-price-note">
              TennisConnect shows the price but doesn't collect payment - players pay you directly.
            </p>
          )}

          <div className="space-y-1.5 pt-1">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden /> Who can join
            </Label>
            <RadioGroup
              value={draft.visibility}
              onValueChange={(v) => onChange("visibility", v as NewSessionDraft["visibility"])}
              className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
              aria-label="Visibility"
              data-testid="organiser-wizard-visibility"
            >
              <label className={SEGMENT}>
                <RadioGroupItem value="public" className="absolute inset-0 h-full w-full rounded-lg border-0 opacity-0 cursor-pointer" data-testid="organiser-wizard-visibility-public" />
                Public
              </label>
              <label className={SEGMENT}>
                <RadioGroupItem value="members" className="absolute inset-0 h-full w-full rounded-lg border-0 opacity-0 cursor-pointer" data-testid="organiser-wizard-visibility-members" />
                Members
              </label>
              <label className={SEGMENT}>
                <RadioGroupItem value="invite" className="absolute inset-0 h-full w-full rounded-lg border-0 opacity-0 cursor-pointer" data-testid="organiser-wizard-visibility-invite" />
                Invite only
              </label>
            </RadioGroup>
            <p className="text-xs text-muted-foreground" data-testid="organiser-wizard-visibility-hint">{visibilityHint[draft.visibility]}</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
