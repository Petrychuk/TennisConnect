import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "./wizard-steps";

interface WizardStepSidebarProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  maxReachedStep: number;
}

export function WizardStepSidebar({ currentStep, onStepClick, maxReachedStep }: WizardStepSidebarProps) {
  return (
    <div className="space-y-0" data-testid="organiser-wizard-step-sidebar">
      {WIZARD_STEPS.map((step, i) => {
        const isDone = step.number < currentStep;
        const isActive = step.number === currentStep;
        const isReachable = step.number <= maxReachedStep;

        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => onStepClick?.(step.number)}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  isDone || isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  isReachable && !isActive && "cursor-pointer"
                )}
                data-testid={`organiser-wizard-step-${step.number}`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : step.number}
              </button>
              {i < WIZARD_STEPS.length - 1 && <div className="w-px flex-1 min-h-8 bg-border my-1" />}
            </div>
            <div className={cn("pb-6", isActive ? "" : "opacity-70")}>
              <p className={cn("text-sm font-semibold", isActive && "text-primary")}>{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
