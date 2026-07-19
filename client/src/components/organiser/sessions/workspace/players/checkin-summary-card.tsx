import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface CheckInSummaryCardProps {
  players: SessionPlayer[];
  className?: string;
}

export function CheckInSummaryCard({ players, className }: CheckInSummaryCardProps) {
  const registered = players.filter((p) => p.status === "registered");
  const checkedIn = registered.filter((p) => p.checkedIn).length;
  const notCheckedIn = registered.length - checkedIn;
  const percent = registered.length > 0 ? Math.round((checkedIn / registered.length) * 100) : 0;

  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <Card className={className} data-testid="organiser-checkin-summary-card">
      <CardHeader>
        <CardTitle className="text-base">Check-in Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
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
            <span className="text-xl font-bold" data-testid="organiser-checkin-summary-percent">{checkedIn}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Checked In</span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2" data-testid="organiser-checkin-summary-checkedin">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>{checkedIn} Checked In ({percent}%)</span>
          </div>
          <div className="flex items-center gap-2" data-testid="organiser-checkin-summary-not-checkedin">
            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{notCheckedIn} Not Checked In ({100 - percent}%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
