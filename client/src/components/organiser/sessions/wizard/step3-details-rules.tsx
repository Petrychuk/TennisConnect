import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sliders, Users2, Radio } from "lucide-react";
import type { NewSessionDraft } from "@/lib/organiser-session-wizard-types";

interface Step3DetailsRulesProps {
  draft: NewSessionDraft;
  onChange: <K extends keyof NewSessionDraft>(key: K, value: NewSessionDraft[K]) => void;
}

function ToggleRow({ label, checked, onCheckedChange, testId }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void; testId: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
      <Label className="text-sm">{label}</Label>
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
                className="flex gap-4"
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
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Games to</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.gamesTo}
                  onChange={(e) => onChange("gamesTo", Number(e.target.value))}
                  data-testid="organiser-wizard-games-to"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Number of Rounds</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.roundsCount}
                  onChange={(e) => onChange("roundsCount", Number(e.target.value))}
                  data-testid="organiser-wizard-rounds-count"
                />
              </div>
            </div>
            <ToggleRow label="No-Ad" checked={draft.noAd} onCheckedChange={(v) => onChange("noAd", v)} testId="organiser-wizard-no-ad" />
            <ToggleRow label="Tiebreak" checked={draft.tiebreak} onCheckedChange={(v) => onChange("tiebreak", v)} testId="organiser-wizard-tiebreak" />
          </CardContent>
        </Card>

        <Card className="shadow-sm" data-testid="organiser-wizard-pairing-card">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Users2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Pairing</CardTitle>
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
          <CardTitle className="text-base">Live Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleRow label="QR Check-in" checked={draft.qrCheckIn} onCheckedChange={(v) => onChange("qrCheckIn", v)} testId="organiser-wizard-qr-checkin" />
          <ToggleRow label="Live Scores" checked={draft.liveScores} onCheckedChange={(v) => onChange("liveScores", v)} testId="organiser-wizard-live-scores" />
          <ToggleRow label="Auto Next Round" checked={draft.autoNextRound} onCheckedChange={(v) => onChange("autoNextRound", v)} testId="organiser-wizard-auto-next-round" />
          <ToggleRow label="Publish Results" checked={draft.publishResults} onCheckedChange={(v) => onChange("publishResults", v)} testId="organiser-wizard-publish-results" />
        </CardContent>
      </Card>
    </div>
  );
}
