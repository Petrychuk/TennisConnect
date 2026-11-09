import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sliders, Users2, HelpCircle, ScrollText, ChevronDown, Plus, Info } from "lucide-react";
import { SESSION_LEVEL_OPTIONS, type NewSessionDraft } from "@/lib/organiser-session-wizard-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sessionCategoryOf } from "@shared/sessionCategories";
import { useLiveAvailable } from "@/lib/use-live-available";
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
              <button type="button" aria-label={`More about ${label}`} className="text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`${testId}-hint`}>
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-60 text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
    </div>
  );
}

export function Step3DetailsRules({ draft, onChange }: Step3DetailsRulesProps) {
  // Only what applies to the chosen category (shared/sessionCategories.ts).
  const category = sessionCategoryOf(draft.type);
  // Rounds, scores and pairing happen in TC Live, which each site switches on
  // with TC_LIVE_ENABLED - the notes say so instead of promising something
  // that isn't there. (No session yet here, so "internal" counts as off.)
  const liveAvailable = useLiveAvailable();
  return (
    <div className="space-y-4" data-testid="organiser-wizard-step3" data-category={category.key}>
      {/* Who the session is for - every type, coaching included. Shown on Play
          (card, quick view, session page) and used by its level filter. */}
      <Card className="shadow-sm" data-testid="organiser-wizard-level-card">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:w-40 shrink-0">
            <Users2 className="w-4 h-4 text-primary-text" />
            <Label htmlFor="organiser-wizard-level" className="text-sm font-semibold">Player level</Label>
          </div>
          <Select value={draft.skillLevel || "all"} onValueChange={(v) => onChange("skillLevel", v === "all" ? "" : v)}>
            <SelectTrigger id="organiser-wizard-level" className="sm:max-w-xs" data-testid="organiser-wizard-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_LEVEL_OPTIONS.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value || "all"}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      {!category.usesMatchFormat && (
        <Card className="shadow-sm" data-testid="organiser-wizard-coaching-note">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <Info className="w-4 h-4 text-primary-text shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              {category.label} sessions are coach-led: there's no match format, rounds or scores to set.
              Add anything players should know below.
            </p>
          </CardContent>
        </Card>
      )}
      {category.key === "competition" && (
        <Card className="shadow-sm" data-testid="organiser-wizard-competition-note">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <Info className="w-4 h-4 text-primary-text shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              {liveAvailable
                ? "Results are recorded per match in Live (games won) and build the session leaderboard and series rankings."
                : "Recording match results needs Live, which isn't available on this site yet - players can still register and be checked in."}{" "}
              Seeded draws and knockout brackets aren't available yet.
            </p>
          </CardContent>
        </Card>
      )}
      {category.usesMatchFormat && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm" data-testid="organiser-wizard-format-card">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Sliders className="w-4 h-4 text-primary-text" />
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
            {draft.matchType !== "mixed" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Category</Label>
                <RadioGroup
                  value={draft.category}
                  onValueChange={(v) => onChange("category", v as NewSessionDraft["category"])}
                  className="flex flex-wrap gap-4"
                  data-testid="organiser-wizard-category"
                >
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="open" data-testid="organiser-wizard-category-open" />
                    Open
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="mens" data-testid="organiser-wizard-category-mens" />
                    Men's
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="womens" data-testid="organiser-wizard-category-womens" />
                    Women's
                  </label>
                </RadioGroup>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Games per Round</Label>
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

        {/* Pairing and Live preferences used to be nine toggles here that
            were never saved or used (Phase 1 audit 5.1). What the engine
            really does is fixed, so it is described instead - the same
            behaviour as server/services/liveEngine.ts planRound(). */}
        <Card className="shadow-sm" data-testid="organiser-wizard-pairing-card">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Users2 className="w-4 h-4 text-primary-text" />
            <CardTitle className="text-base">Pairing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground" data-testid="organiser-wizard-pairing-note">
            <p>
              {liveAvailable
                ? "Pairings are made for you when you generate each round in Live:"
                : "When Live is available, pairings are made for you each round:"}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>players are shuffled every round;</li>
              <li>repeat partners and opponents are avoided where possible;</li>
              <li>if there are more players than court spots, rests are shared evenly.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
      )}

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
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary-text transition-colors"
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
          <ScrollText className="w-4 h-4 text-primary-text" />
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
