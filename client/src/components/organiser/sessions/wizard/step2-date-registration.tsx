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
import { CalendarDays, ClipboardList, DollarSign, Eye, Globe, ImagePlus, Info, LayoutGrid, MapPin, Trophy, Type, X, type LucideIcon } from "lucide-react";
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

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1 min-w-0", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
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
    <Card className="shadow-sm @container" data-testid={`organiser-wizard-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
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

const OPTION =
  "flex min-h-11 md:pointer-fine:min-h-9 cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 text-sm transition-colors hover:bg-accent/40 has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-primary/5";

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

  return (
    <div className="space-y-3" data-testid="organiser-wizard-step2">
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 text-primary-text" aria-hidden />
        <p>You can always edit session details later — nothing here is final.</p>
      </div>

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

      <SectionCard icon={ClipboardList} title="Session" columns="six">
        <Field label="Session Name" className="@2xl:col-span-3">
          <WithIcon icon={Type}>
            <Input
              value={draft.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="e.g. Wednesday Social Tennis"
              className={cn(CONTROL, "pl-9")}
              data-testid="organiser-wizard-session-name"
            />
          </WithIcon>
        </Field>
        <Field label="Season (Optional)" className="@2xl:col-span-3">
          <WithIcon icon={Trophy}>
            <Select
              value={draft.seasonId ?? "none"}
              onValueChange={(v) => onChange("seasonId", v === "none" ? null : v)}
            >
              <SelectTrigger aria-label="Season" className={cn(CONTROL, "pl-9")} data-testid="organiser-wizard-session-season">
                <SelectValue placeholder="No Season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Season</SelectItem>
                {matchingSeasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WithIcon>
        </Field>
        <Field label="Venue" className="@2xl:col-span-3">
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
        <Field label="City / Timezone" className="@2xl:col-span-2">
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
        <Field label="Court Count" className="@2xl:col-span-1">
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

      <SectionCard icon={CalendarDays} title="Date" columns="one">
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
          <Field label="Date">
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => onChange("date", e.target.value)}
              className={CONTROL}
              data-testid="organiser-wizard-date"
            />
            {draft.date && draft.date < todayInput() && (
              <p className="text-xs text-destructive" data-testid="organiser-wizard-date-past-error">
                That date has already passed.
              </p>
            )}
          </Field>
          <Field label="Start Time">
            <Input
              type="time"
              value={draft.startTime}
              onChange={(e) => onChange("startTime", e.target.value)}
              className={CONTROL}
              data-testid="organiser-wizard-start-time"
            />
          </Field>
          <Field label="End Time">
            <Input
              type="time"
              value={draft.endTime}
              onChange={(e) => onChange("endTime", e.target.value)}
              className={CONTROL}
              data-testid="organiser-wizard-end-time"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm md:pointer-fine:min-h-9">
            <input
              type="checkbox"
              checked={!!draft.endDate}
              onChange={(e) => onChange("endDate", e.target.checked ? draft.date : "")}
              className="h-4 w-4 accent-primary"
              data-testid="organiser-wizard-multiday-toggle"
            />
            This runs over multiple days (e.g. a 2-3 day tournament)
          </label>
          <SessionWeatherPreview
            city={AU_CITY_TIMEZONES.find((c) => c.timeZone === draft.timeZone)?.label ?? ""}
            date={draft.date}
          />
        </div>

        {draft.endDate && (
          <Field label="Ends On" className="max-w-full @md:max-w-[220px]">
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

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <SectionCard icon={ClipboardList} title="Registration">
          <Field label="Opens">
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
          <Field label="Closes">
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
          <Field label="Max Players">
            <NumberField
              min={1}
              value={draft.maxPlayers}
              onChange={(v) => onChange("maxPlayers", v)}
              className={CONTROL}
              data-testid="organiser-wizard-max-players"
            />
          </Field>
          <Field label="Waiting List">
            <div className={cn(CONTROL, "flex items-center justify-between rounded-md border border-input px-3")}>
              <span className="text-sm text-muted-foreground">{draft.waitingListEnabled ? "On" : "Off"}</span>
              <Switch
                checked={draft.waitingListEnabled}
                onCheckedChange={(v) => onChange("waitingListEnabled", v)}
                aria-label="Waiting List"
                data-testid="organiser-wizard-waiting-list-toggle"
              />
            </div>
          </Field>
          {draft.waitingListEnabled && (
            <Field label="Waiting List Spots" className="@md:col-span-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="w-full max-w-[160px]">
                  <NumberField
                    min={1}
                    value={draft.waitingListCapacity ?? NaN}
                    onChange={(v) => onChange("waitingListCapacity", v)}
                    placeholder="Unlimited"
                    className={CONTROL}
                    data-testid="organiser-wizard-waiting-list-capacity"
                  />
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-muted-foreground md:pointer-fine:min-h-9">
                  <input
                    type="checkbox"
                    checked={draft.waitingListCapacity == null}
                    onChange={(e) => onChange("waitingListCapacity", e.target.checked ? null : 10)}
                    className="h-4 w-4 accent-primary"
                    data-testid="organiser-wizard-waiting-list-unlimited"
                  />
                  Unlimited
                </label>
              </div>
            </Field>
          )}
          {/* "Allow Late Registration" was here - never saved and no rule
              behind it (Phase 1 audit 5.1). Registration closes at the time
              set above. */}
        </SectionCard>

        <div className="space-y-3">
          <SectionCard icon={DollarSign} title="Pricing" columns="one">
            <div>
              <RadioGroup
                value={draft.pricing}
                onValueChange={(v) => onChange("pricing", v as NewSessionDraft["pricing"])}
                className="grid grid-cols-2 gap-2"
                data-testid="organiser-wizard-pricing-mode"
              >
                <label className={OPTION}>
                  <RadioGroupItem value="free" data-testid="organiser-wizard-pricing-free" />
                  Free
                </label>
                <label className={OPTION}>
                  <RadioGroupItem value="paid" data-testid="organiser-wizard-pricing-paid" />
                  Paid
                </label>
              </RadioGroup>
            </div>
            {draft.pricing === "paid" && (
              <Field label="Price" className="@md:max-w-[200px]">
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
                TennisConnect shows the price to players but doesn't collect payment. Players pay you directly, the way you usually take payment.
              </p>
            )}
          </SectionCard>

          <SectionCard icon={Eye} title="Visibility" columns="one">
            <div>
              <RadioGroup
                value={draft.visibility}
                onValueChange={(v) => onChange("visibility", v as NewSessionDraft["visibility"])}
                className="grid grid-cols-1 gap-2"
                data-testid="organiser-wizard-visibility"
              >
                <label className={OPTION}>
                  <RadioGroupItem value="public" data-testid="organiser-wizard-visibility-public" />
                  Public — anyone can find and join
                </label>
                <label className={OPTION}>
                  <RadioGroupItem value="members" data-testid="organiser-wizard-visibility-members" />
                  Members Only — only club members
                </label>
                <label className={OPTION}>
                  <RadioGroupItem value="invite" data-testid="organiser-wizard-visibility-invite" />
                  Invite Only — only people you invite
                </label>
              </RadioGroup>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
