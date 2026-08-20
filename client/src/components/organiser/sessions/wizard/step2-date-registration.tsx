import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarDays, ClipboardList, DollarSign, Eye, ImagePlus, Info, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadImage } from "@/lib/uploadImage";
import type { NewSessionDraft } from "@/lib/organiser-session-wizard-types";
import { NumberField } from "./number-field";

interface Step2DateRegistrationProps {
  draft: NewSessionDraft;
  onChange: <K extends keyof NewSessionDraft>(key: K, value: NewSessionDraft[K]) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: typeof CalendarDays; title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm" data-testid={`organiser-wizard-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Icon className="w-4 h-4 text-primary" />
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</CardContent>
    </Card>
  );
}

export function Step2DateRegistration({ draft, onChange }: Step2DateRegistrationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploadingCover, setIsUploadingCover] = useState(false);

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
    <div className="space-y-4" data-testid="organiser-wizard-step2">
      <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5 text-sm text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p>You can always edit session details later — nothing here is final.</p>
      </div>

      <Card className="shadow-sm" data-testid="organiser-wizard-section-cover-photo">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <ImagePlus className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Cover Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
            data-testid="organiser-wizard-cover-photo-input"
          />
          {isUploadingCover ? (
            <div className="w-full h-32 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : draft.coverImage ? (
            <div className="relative rounded-xl overflow-hidden h-40">
              <img src={draft.coverImage} alt="Session cover" className="absolute inset-0 w-full h-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => onChange("coverImage", null)}
                data-testid="organiser-wizard-cover-photo-remove"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              data-testid="organiser-wizard-cover-photo-trigger"
            >
              <ImagePlus className="w-6 h-6" />
              <span className="text-sm font-medium">Upload a cover photo</span>
              <span className="text-xs">Optional — defaults to a standard court photo</span>
            </button>
          )}
        </CardContent>
      </Card>

      <SectionCard icon={ClipboardList} title="Session">
        <Field label="Session Name">
          <Input
            value={draft.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g. Wednesday Social Tennis"
            data-testid="organiser-wizard-session-name"
          />
        </Field>
        <Field label="Season (Optional)">
          <Input
            value={draft.season}
            onChange={(e) => onChange("season", e.target.value)}
            placeholder="e.g. Winter 2027"
            data-testid="organiser-wizard-session-season"
          />
        </Field>
        <Field label="Venue">
          <Input
            value={draft.venue}
            onChange={(e) => onChange("venue", e.target.value)}
            data-testid="organiser-wizard-session-venue"
          />
        </Field>
        <Field label="Court Count">
          <NumberField
            min={1}
            value={draft.courtCount}
            onChange={(v) => onChange("courtCount", v)}
            data-testid="organiser-wizard-session-courts"
          />
        </Field>
      </SectionCard>

      <SectionCard icon={CalendarDays} title="Date">
        <Field label="Date">
          <Input
            type="date"
            value={draft.date}
            onChange={(e) => onChange("date", e.target.value)}
            data-testid="organiser-wizard-date"
          />
        </Field>
        <div />
        <Field label="Start Time">
          <Input
            type="time"
            value={draft.startTime}
            onChange={(e) => onChange("startTime", e.target.value)}
            data-testid="organiser-wizard-start-time"
          />
        </Field>
        <Field label="End Time">
          <Input
            type="time"
            value={draft.endTime}
            onChange={(e) => onChange("endTime", e.target.value)}
            data-testid="organiser-wizard-end-time"
          />
        </Field>
      </SectionCard>

      <SectionCard icon={ClipboardList} title="Registration">
        <Field label="Opens">
          <Input
            type="date"
            value={draft.registrationOpens}
            onChange={(e) => onChange("registrationOpens", e.target.value)}
            data-testid="organiser-wizard-registration-opens"
          />
        </Field>
        <Field label="Closes">
          <Input
            type="date"
            value={draft.registrationCloses}
            max={draft.date || undefined}
            onChange={(e) => onChange("registrationCloses", e.target.value)}
            data-testid="organiser-wizard-registration-closes"
          />
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
            data-testid="organiser-wizard-max-players"
          />
        </Field>
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
          <Label className="text-sm">Waiting List</Label>
          <Switch
            checked={draft.waitingListEnabled}
            onCheckedChange={(v) => onChange("waitingListEnabled", v)}
            data-testid="organiser-wizard-waiting-list-toggle"
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 sm:col-span-2">
          <Label className="text-sm">Allow Late Registration</Label>
          <Switch
            checked={draft.allowLateRegistration}
            onCheckedChange={(v) => onChange("allowLateRegistration", v)}
            data-testid="organiser-wizard-late-registration-toggle"
          />
        </div>
      </SectionCard>

      <SectionCard icon={DollarSign} title="Pricing">
        <div className="sm:col-span-2">
          <RadioGroup
            value={draft.pricing}
            onValueChange={(v) => onChange("pricing", v as NewSessionDraft["pricing"])}
            className="flex gap-4"
            data-testid="organiser-wizard-pricing-mode"
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="free" data-testid="organiser-wizard-pricing-free" />
              Free
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="paid" data-testid="organiser-wizard-pricing-paid" />
              Paid
            </label>
          </RadioGroup>
        </div>
        {draft.pricing === "paid" && (
          <Field label="Price">
            <NumberField
              min={0}
              value={draft.price}
              onChange={(v) => onChange("price", v)}
              data-testid="organiser-wizard-price"
            />
          </Field>
        )}
      </SectionCard>

      <SectionCard icon={Eye} title="Visibility">
        <div className="sm:col-span-2">
          <RadioGroup
            value={draft.visibility}
            onValueChange={(v) => onChange("visibility", v as NewSessionDraft["visibility"])}
            className="space-y-2"
            data-testid="organiser-wizard-visibility"
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="public" data-testid="organiser-wizard-visibility-public" />
              Public — anyone can find and join
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="members" data-testid="organiser-wizard-visibility-members" />
              Members Only — only club members
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="invite" data-testid="organiser-wizard-visibility-invite" />
              Invite Only — only people you invite
            </label>
          </RadioGroup>
        </div>
      </SectionCard>
    </div>
  );
}
