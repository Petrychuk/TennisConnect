import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionReadiness } from "@/lib/organiser-sessions-mock-data";

interface SessionReadinessCardProps {
  readiness: SessionReadiness;
  onViewDetails?: () => void;
}

const STATUS_ICON = {
  ready: CheckCircle2,
  warning: AlertTriangle,
  issue: XCircle,
} as const;

// Same primary/muted/destructive tokens as everywhere else — "ready" uses
// primary, "warning" and "issue" both lean on destructive (at different
// opacities) rather than inventing an amber/yellow that isn't in the palette.
const STATUS_STYLE = {
  ready: "text-primary",
  warning: "text-destructive/80",
  issue: "text-destructive",
} as const;

export function SessionReadinessCard({ readiness, onViewDetails }: SessionReadinessCardProps) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (readiness.percent / 100) * circumference;

  return (
    <Card className="shadow-sm" data-testid="organiser-session-readiness-card">
      <CardHeader>
        <CardTitle className="text-base">Live Readiness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold" data-testid="organiser-session-readiness-percent">
                {readiness.percent}%
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Ready</span>
            </div>
          </div>
        </div>

        <ul className="space-y-2">
          {readiness.items.map((item) => {
            const Icon = STATUS_ICON[item.status];
            return (
              <li key={item.id} className="flex items-center gap-2 text-sm" data-testid={`organiser-session-readiness-${item.id}`}>
                <Icon className={cn("w-4 h-4 shrink-0", STATUS_STYLE[item.status])} />
                <span className={item.status === "issue" ? "text-destructive" : undefined}>{item.label}</span>
              </li>
            );
          })}
        </ul>

        <Button variant="outline" className="w-full" onClick={onViewDetails} data-testid="organiser-session-readiness-view-details">
          View Readiness Details
        </Button>
      </CardContent>
    </Card>
  );
}
