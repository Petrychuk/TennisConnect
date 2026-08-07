import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

interface SetScore {
  mine: string;
  theirs: string;
}

interface SetScoreBuilderProps {
  /** The current free-text result string (e.g. "6-4, 6-3") - parsed back into set rows whenever it doesn't match what this component last produced itself, so switching away and back (or loading an existing entry to edit) keeps the sets in sync. */
  value: string;
  onChange: (value: string) => void;
}

const MAX_SETS = 5;

function parseSets(value: string): SetScore[] {
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const sets: SetScore[] = [];
  for (const part of parts) {
    const match = part.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (!match) return []; // not a clean set-score string - let the free text stay as-is instead
    sets.push({ mine: match[1], theirs: match[2] });
  }
  return sets;
}

export function looksLikeSetScore(value: string): boolean {
  if (!value.trim()) return true; // empty defaults to sets mode
  return parseSets(value).length > 0;
}

function serializeSets(sets: SetScore[]): string {
  return sets
    .filter((s) => s.mine !== "" || s.theirs !== "")
    .map((s) => `${s.mine || "0"}-${s.theirs || "0"}`)
    .join(", ");
}

// Tennis is scored per set, not as one number - "Won 6-4, 6-3" is what
// a result actually looks like, not a single free-text guess. Renders
// as dynamic rows (My games / Opponent games per set) that serialize
// into the exact same free-text result field the schema already has,
// so this is purely a friendlier way to fill it in, not a new data
// shape.
export function SetScoreBuilder({ value, onChange }: SetScoreBuilderProps) {
  const [sets, setSets] = useState<SetScore[]>(() => {
    const parsed = parseSets(value);
    return parsed.length > 0 ? parsed : [{ mine: "", theirs: "" }];
  });

  // Re-sync from an external change (e.g. opening this dialog to edit
  // an existing entry) as long as it still looks like a set score -
  // free text that doesn't parse as sets is left alone rather than
  // silently discarded.
  useEffect(() => {
    const parsed = parseSets(value);
    if (parsed.length > 0 && serializeSets(parsed) !== serializeSets(sets)) {
      setSets(parsed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const updateSet = (index: number, field: keyof SetScore, val: string) => {
    const next = sets.map((s, i) => (i === index ? { ...s, [field]: val.replace(/\D/g, "").slice(0, 2) } : s));
    setSets(next);
    onChange(serializeSets(next));
  };

  const addSet = () => {
    if (sets.length >= MAX_SETS) return;
    setSets((prev) => [...prev, { mine: "", theirs: "" }]);
  };

  const removeSet = (index: number) => {
    const next = sets.filter((_, i) => i !== index);
    const withAtLeastOne = next.length > 0 ? next : [{ mine: "", theirs: "" }];
    setSets(withAtLeastOne);
    onChange(serializeSets(withAtLeastOne));
  };

  return (
    <div className="space-y-2" data-testid="set-score-builder">
      {sets.map((set, i) => (
        <div key={i} className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-12 shrink-0">Set {i + 1}</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={set.mine}
            onChange={(e) => updateSet(i, "mine", e.target.value)}
            placeholder="6"
            className="w-14 text-center"
            data-testid={`set-score-mine-${i}`}
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="text"
            inputMode="numeric"
            value={set.theirs}
            onChange={(e) => updateSet(i, "theirs", e.target.value)}
            placeholder="4"
            className="w-14 text-center"
            data-testid={`set-score-theirs-${i}`}
          />
          {sets.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => removeSet(i)}
              data-testid={`set-score-remove-${i}`}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
      {sets.length < MAX_SETS && (
        <Button type="button" variant="outline" size="sm" onClick={addSet} data-testid="set-score-add">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Set
        </Button>
      )}
    </div>
  );
}
