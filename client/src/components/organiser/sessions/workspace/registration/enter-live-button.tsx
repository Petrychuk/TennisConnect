import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnterLiveButtonProps {
  readinessPercent: number;
  onClick?: () => void;
  className?: string;
}

// Below 100% the button still works (an organiser can always override and
// go live early) but reads as muted/secondary rather than the loud green
// call-to-action it becomes once everything's actually ready.
export function EnterLiveButton({ readinessPercent, onClick, className }: EnterLiveButtonProps) {
  const isReady = readinessPercent >= 100;

  return (
    <Button
      size="lg"
      variant={isReady ? "default" : "outline"}
      onClick={onClick}
      className={cn("font-bold", isReady && "shadow-sm", className)}
      data-testid="organiser-registration-enter-live-button"
    >
      <Play className={cn("w-5 h-5 mr-2", isReady && "fill-current")} />
      {isReady ? "Enter Live Session" : `Enter Live Session (${readinessPercent}% Ready)`}
    </Button>
  );
}
