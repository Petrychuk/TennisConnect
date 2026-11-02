import { useState } from "react";
import { Users, Repeat, Trophy, Swords, Crown, Settings2, Check, Lightbulb, Award, Shield, Heart, Activity, GraduationCap, Dumbbell, Sparkles, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SESSION_TYPE_OPTIONS, type SessionTypeKey } from "@/lib/organiser-session-wizard-types";
import { SESSION_CATEGORIES, sessionCategoryOf, type SessionCategoryKey } from "@shared/sessionCategories";

interface Step1SessionTypeProps {
  value: SessionTypeKey | null;
  onChange: (value: SessionTypeKey) => void;
}

/*
  Step 1 (Phase 2 Batch 2): pick one of four categories - decided by what
  the event actually contains (shared/sessionCategories.ts) - then a
  format inside it. The format is the session's stored `type`, so the
  later steps, Play filters and existing sessions are unchanged. Picking a
  category preselects its most common format.
*/

const CATEGORY_ICON: Record<SessionCategoryKey, typeof Users> = {
  "social-play": Users,
  competition: Medal,
  "coaching-fitness": Dumbbell,
  other: Sparkles,
};

const FORMAT_ICON: Record<SessionTypeKey, typeof Users> = {
  social: Users,
  americano: Repeat,
  "round-robin": Trophy,
  mexicano: Swords,
  "king-of-the-court": Crown,
  tournament: Award,
  league: Shield,
  "club-championship": Trophy,
  "junior-event": Heart,
  "junior-development": Heart,
  "cardio-tennis": Activity,
  "coaching-clinic": GraduationCap,
  custom: Settings2,
};

const optionFor = (key: string) => SESSION_TYPE_OPTIONS.find((option) => option.key === key);

export function Step1SessionType({ value, onChange }: Step1SessionTypeProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const selectedCategory = value ? sessionCategoryOf(value) : null;

  return (
    <div className="space-y-6" data-testid="organiser-wizard-step1">
      <div>
        <h2 className="text-lg font-bold">What kind of session is it?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Choose what happens at the event. The next steps only ask for what applies.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Session category">
        {SESSION_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICON[category.key];
          const selected = selectedCategory?.key === category.key;
          return (
            <button
              key={category.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (!selected) onChange(category.formats[0] as SessionTypeKey);
              }}
              className={cn(
                "relative text-left rounded-2xl border p-4 min-h-24 transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary bg-primary/5" : "border-border",
              )}
              data-testid={`organiser-wizard-session-category-${category.key}`}
            >
              {selected && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-foreground flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary-text flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 pr-6">
                  <p className="font-bold">{category.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCategory && selectedCategory.formats.length > 1 && (
        <div className="space-y-2" data-testid="organiser-wizard-format-picker">
          <p className="text-sm font-semibold" id="organiser-wizard-format-label">Format</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="organiser-wizard-format-label">
            {selectedCategory.formats.map((key) => {
              const option = optionFor(key);
              if (!option) return null;
              const Icon = FORMAT_ICON[option.key];
              const selected = value === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(option.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3.5 min-h-11 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/40",
                  )}
                  data-testid={`organiser-wizard-type-${option.key}`}
                >
                  <Icon className="w-4 h-4 text-primary-text" />
                  {option.label}
                </button>
              );
            })}
          </div>
          {value && <p className="text-xs text-muted-foreground" data-testid="organiser-wizard-format-details">{optionFor(value)?.details}</p>}
        </div>
      )}

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex flex-col sm:flex-row sm:items-start gap-3">
        <Lightbulb className="w-5 h-5 text-primary-text shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Not sure which one to choose?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Social Play suits most club sessions: players rotate across courts and the scores build a leaderboard.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={() => setInfoOpen(true)} data-testid="organiser-wizard-type-learn-more">
          Learn more
        </Button>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="organiser-wizard-type-info-modal">
          <DialogHeader>
            <DialogTitle>Categories and formats</DialogTitle>
            <DialogDescription>
              The category decides what you set up next. The format is shown to players and used by the Play filters.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto -mx-6 px-6 space-y-5">
            {SESSION_CATEGORIES.map((category) => (
              <section key={category.key} className="space-y-2" data-testid={`organiser-wizard-session-category-info-${category.key}`}>
                <div>
                  <h3 className="font-semibold">{category.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {category.usesLiveRounds
                      ? "Match format and scoring, rounds on courts, and a results leaderboard."
                      : "No match format, rounds or scores - a coach-led session."}
                  </p>
                </div>
                {category.formats.map((key) => {
                  const option = optionFor(key);
                  if (!option) return null;
                  const Icon = FORMAT_ICON[option.key];
                  return (
                    <div key={key} className="flex items-start gap-3 rounded-xl border border-border p-3" data-testid={`organiser-wizard-type-info-${key}`}>
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary-text flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{option.details}</p>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
