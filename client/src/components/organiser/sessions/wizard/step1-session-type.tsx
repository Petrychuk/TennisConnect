import { Users, Repeat, Trophy, Swords, Crown, Settings2, Check, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SESSION_TYPE_OPTIONS, type SessionTypeKey } from "@/lib/organiser-session-wizard-types";

interface Step1SessionTypeProps {
  value: SessionTypeKey | null;
  onChange: (value: SessionTypeKey) => void;
}

// One icon per type, all on the same primary-tinted treatment - the
// mockup used a different pastel hue per card, but that's outside the
// project's palette tokens, so the type itself is what differentiates
// each card, not colour.
const TYPE_ICON: Record<SessionTypeKey, typeof Users> = {
  social: Users,
  americano: Repeat,
  "round-robin": Trophy,
  mexicano: Swords,
  "king-of-the-court": Crown,
  custom: Settings2,
};

export function Step1SessionType({ value, onChange }: Step1SessionTypeProps) {
  return (
    <div className="space-y-6" data-testid="organiser-wizard-step1">
      <div>
        <h2 className="text-lg font-bold">What type of session are you creating?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Select the format that best fits your event.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SESSION_TYPE_OPTIONS.map((option) => {
          const Icon = TYPE_ICON[option.key];
          const selected = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              className={cn(
                "relative text-left rounded-2xl border p-4 transition-all hover:border-primary/40",
                selected ? "border-primary bg-primary/5" : "border-border"
              )}
              data-testid={`organiser-wizard-type-${option.key}`}
            >
              {selected && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
              )}
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <p className="font-bold">{option.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              {option.mostPopular && (
                <span className="inline-block mt-2 text-[11px] font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                  Most popular
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Not sure which one to choose?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Social Tennis is perfect for most club sessions. It's fun, inclusive, and keeps everyone moving!
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" data-testid="organiser-wizard-type-learn-more">
          Learn more
        </Button>
      </div>
    </div>
  );
}
