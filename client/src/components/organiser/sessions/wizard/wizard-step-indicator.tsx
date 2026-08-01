import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "./wizard-steps";

interface WizardStepIndicatorProps {
  currentStep: number;
  maxReachedStep?: number;
  onStepClick?: (step: number) => void;
}

export function WizardStepIndicator({ currentStep, maxReachedStep = currentStep, onStepClick }: WizardStepIndicatorProps) {
  return (
    <div className="flex items-start justify-between max-w-md mx-auto" data-testid="organiser-wizard-step-indicator">
      {WIZARD_STEPS.map((step, i) => {
        const isDone = step.number < currentStep;
        const isActive = step.number === currentStep;
        const isClickable = step.number <= maxReachedStep && !!onStepClick;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.number)}
                disabled={!isClickable}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  isClickable ? "cursor-pointer" : "cursor-default",
                  isDone || isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
                data-testid={`organiser-wizard-step-indicator-${step.number}`}
              >
                {isDone ? <Check className="w-4 h-4" /> : step.number}
              </button>
              <span className={cn("text-[11px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
                {step.title.split(" ")[0]}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={cn("h-px flex-1 mx-1 mb-4", isDone ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
