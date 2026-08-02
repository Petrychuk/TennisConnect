import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sliders, Users2, Radio, HelpCircle, ScrollText, ChevronDown, Plus } from "lucide-react";
import type { NewSessionDraft } from "@/lib/organiser-session-wizard-types";
import { NumberField } from "./number-field";

interface Step3DetailsRulesProps {
  draft: NewSessionDraft;
  onChange: <K extends keyof NewSessionDraft>(key: K, value: NewSessionDraft[K]) => void;
}

function ToggleRow({ label, checked, onCheckedChange, testId, hint }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void; testId: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm">{label}</Label>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground" data-testid={`${testId}-hint`}>
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
    </div>
  );
}

export function Step3DetailsRules({ draft, onChange }: Step3DetailsRulesProps) {
  return (
    <div className="space-y-4" data-testid="organiser-wizard-step3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm" data-testid="organiser-wizard-format-card">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Sliders className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Singles / Doubles</Label>
              <RadioGroup
                value={draft.matchType}
                onValueChange={(v) => onChange("matchType", v as NewSessionDraft["matchType"])}
                className="flex flex-wrap gap-4"
                data-testid="organiser-wizard-match-type"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="singles" data-testid="organiser-wizard-match-type-singles" />
                  Singles
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="doubles" data-testid="organiser-wizard-match-type-doubles" />
                  Doubles
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="mixed" data-testid="organiser-wizard-match-type-mixed" />
                  Mixed Doubles
                </label>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Games to</Label>
                <NumberField
                  min={1}
                  value={draft.gamesTo}
                  onChange={(v) => onChange("gamesTo", v)}
                  data-testid="organiser-wizard-games-to"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Number of Rounds</Label>
                <NumberField
                  min={1}
                  value={draft.roundsCount}
                  onChange={(v) => onChange("roundsCount", v)}
                  data-testid="organiser-wizard-rounds-count"
                />
              </div>
            </div>
            <ToggleRow
              label="No-Ad"
              checked={draft.noAd}
              onCheckedChange={(v) => onChange("noAd", v)}
              testId="organiser-wizard-no-ad"
              hint="No-advantage scoring: at deuce (40-40), the very next point wins the game instead of playing advantage. Keeps matches shorter and more predictable."
            />
            <ToggleRow label="Tiebreak" checked={draft.tiebreak} onCheckedChange={(v) => onChange("tiebreak", v)} testId="organiser-wizard-tiebreak" />
          </CardContent>
        </Card>

        <Card className="shadow-sm" data-testid="organiser-wizard-pairing-card">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Users2 className="w-4 h-4 text-primary" />
            <div>
              <CardTitle className="text-base">Pairing</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 font-normal">Saved to the session summary as guidance — automatic pairing isn't built yet.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow label="Random Partners" checked={draft.randomPartners} onCheckedChange={(v) => onChange("randomPartners", v)} testId="organiser-wizard-random-partners" />
            <ToggleRow label="Avoid Repeat Partners" checked={draft.avoidRepeatPartners} onCheckedChange={(v) => onChange("avoidRepeatPartners", v)} testId="organiser-wizard-avoid-repeat" />
            <ToggleRow label="Balance Waiting List" checked={draft.balanceWaitingList} onCheckedChange={(v) => onChange("balanceWaitingList", v)} testId="organiser-wizard-balance-waiting" />
            <ToggleRow label="Use Player Rating" checked={draft.usePlayerRating} onCheckedChange={(v) => onChange("usePlayerRating", v)} testId="organiser-wizard-use-rating" />
            <ToggleRow label="Allow Guests" checked={draft.allowGuests} onCheckedChange={(v) => onChange("allowGuests", v)} testId="organiser-wizard-allow-guests" />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm" data-testid="organiser-wizard-live-settings-card">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Radio className="w-4 h-4 text-primary" />
          <div>
            <CardTitle className="text-base">Live Settings</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-normal">Preferences for the live session experience — set now, applied once TC Live is available.</p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleRow label="QR Check-in" checked={draft.qrCheckIn} onCheckedChange={(v) => onChange("qrCheckIn", v)} testId="organiser-wizard-qr-checkin" />
          <ToggleRow label="Live Scores" checked={draft.liveScores} onCheckedChange={(v) => onChange("liveScores", v)} testId="organiser-wizard-live-scores" />
          <ToggleRow label="Auto Next Round" checked={draft.autoNextRound} onCheckedChange={(v) => onChange("autoNextRound", v)} testId="organiser-wizard-auto-next-round" />
          <ToggleRow label="Publish Results" checked={draft.publishResults} onCheckedChange={(v) => onChange("publishResults", v)} testId="organiser-wizard-publish-results" />
        </CardContent>
      </Card>

      <RulesAndPoliciesCard draft={draft} onChange={onChange} />
    </div>
  );
}

// Optional - collapsed by default so the step doesn't feel padded out
// for organisers who don't need any of this. Everything here is free
// text (no structured backend fields exist for rules/policies yet),
// folded into the session description on submit alongside the format
// summary, same as the rest of Step 3.
function RulesAndPoliciesCard({ draft, onChange }: Step3DetailsRulesProps) {
  const hasContent = !!(draft.rulesText || draft.refundPolicy || draft.latePolicy || draft.cancellationPolicy);
  const [expanded, setExpanded] = useState(hasContent);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        data-testid="organiser-wizard-rules-policies-expand"
      >
        <Plus className="w-4 h-4" />
        Add rules, refund, late arrival & cancellation policies (optional)
      </button>
    );
  }

  return (
    <Card className="shadow-sm" data-testid="organiser-wizard-rules-policies-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-primary" />
          <div>
            <CardTitle className="text-base">Rules & Policies</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-normal">Optional — shown to players on the session page.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
          data-testid="organiser-wizard-rules-policies-collapse"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Rules</Label>
          <Textarea
            value={draft.rulesText}
            onChange={(e) => onChange("rulesText", e.target.value)}
            placeholder="e.g. Bring your own racquet, arrive 10 minutes early to warm up..."
            className="min-h-20"
            data-testid="organiser-wizard-rules-text"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Refund Policy</Label>
            <Textarea
              value={draft.refundPolicy}
              onChange={(e) => onChange("refundPolicy", e.target.value)}
              placeholder="e.g. Full refund up to 48 hours before the session."
              className="min-h-16"
              data-testid="organiser-wizard-refund-policy"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Late Arrivals</Label>
            <Textarea
              value={draft.latePolicy}
              onChange={(e) => onChange("latePolicy", e.target.value)}
              placeholder="e.g. Your spot may be given to the waiting list after 15 minutes."
              className="min-h-16"
              data-testid="organiser-wizard-late-policy"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm">Cancellations</Label>
            <Textarea
              value={draft.cancellationPolicy}
              onChange={(e) => onChange("cancellationPolicy", e.target.value)}
              placeholder="e.g. Cancel from My Sessions any time before the session starts."
              className="min-h-16"
              data-testid="organiser-wizard-cancellation-policy"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
