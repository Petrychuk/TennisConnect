import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeasonProgressCardProps {
  seasonLabel: string;
  sessionsRun: number;
  sessionsGoal: number;
  playersEngaged: number;
  daysRemaining: number;
  className?: string;
}

export function SeasonProgressCard({
  seasonLabel,
  sessionsRun,
  sessionsGoal,
  playersEngaged,
  daysRemaining,
  className,
}: SeasonProgressCardProps) {
  const pct = Math.min(100, Math.round((sessionsRun / sessionsGoal) * 100));

  // Ring geometry
  const size = 112;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Card className={cn(className)} data-testid="organiser-hub-season-progress-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-4 h-4 text-primary" />
          {seasonLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={stroke}
            />
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
            <span className="text-2xl font-bold" data-testid="organiser-hub-season-progress-pct">
              {pct}%
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {sessionsRun}/{sessionsGoal} sessions
            </span>
          </div>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-muted/40 py-2">
            <div className="flex items-center justify-center gap-1 text-sm font-bold">
              <Users className="w-3.5 h-3.5 text-primary" />
              {playersEngaged}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Players</p>
          </div>
          <div className="rounded-lg bg-muted/40 py-2">
            <div className="flex items-center justify-center gap-1 text-sm font-bold">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {daysRemaining}d
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Remaining</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
