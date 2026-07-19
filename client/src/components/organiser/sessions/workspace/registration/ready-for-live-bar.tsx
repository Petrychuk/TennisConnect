import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionReadiness } from "@/lib/organiser-sessions-mock-data";

interface ReadyForLiveBarProps {
  readiness: SessionReadiness;
}

export function ReadyForLiveBar({ readiness }: ReadyForLiveBarProps) {
  const isReady = readiness.percent >= 100;

  return (
    <div className="rounded-2xl border border-border p-4" data-testid="organiser-registration-ready-bar">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-semibold">
          <span className={cn("w-2 h-2 rounded-full", isReady ? "bg-primary" : "bg-muted-foreground")} />
          Ready for Live
        </div>
        <span className={cn("text-sm font-bold", isReady ? "text-primary" : "text-muted-foreground")} data-testid="organiser-registration-ready-percent">
          {readiness.percent}% Ready
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {readiness.items.map((item) => (
          <span
            key={item.id}
            className={cn("flex items-center gap-1.5", item.status === "ready" ? "text-primary" : "text-muted-foreground")}
            data-testid={`organiser-registration-ready-item-${item.id}`}
          >
            {item.status === "ready" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive/80" />}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
