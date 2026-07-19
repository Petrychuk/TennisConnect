import { Card, CardContent } from "@/components/ui/card";
import { Clock, Users, CheckCircle2, LayoutGrid } from "lucide-react";
import { CountdownTimer } from "./countdown-timer";
import type { TodaysFocus } from "@/lib/organiser-hub-mock-data";

interface TodaysFocusCardProps {
  focus: TodaysFocus | null;
  className?: string;
}

// Deliberately the first card on the page (see organiser-dashboard.tsx) -
// an organiser opening the Hub shouldn't have to hunt for what's
// happening today, it should just be sitting right there.
export function TodaysFocusCard({ focus, className }: TodaysFocusCardProps) {
  if (!focus) {
    return (
      <Card className={className} data-testid="organiser-todays-focus-empty">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Nothing scheduled for today.
        </CardContent>
      </Card>
    );
  }

  const hasStarted = new Date(focus.startAt).getTime() <= Date.now();

  return (
    <Card className={className} data-testid="organiser-todays-focus-card">
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Today's Focus</p>
          <h3 className="font-display text-lg font-bold truncate">{focus.title}</h3>
          {hasStarted ? (
            <p className="text-xs text-muted-foreground mt-0.5">Started at {new Date(focus.startAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              Starts in
              <CountdownTimer target={focus.startAt} className="font-semibold text-foreground" data-testid="organiser-todays-focus-countdown" />
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 md:ml-auto">
          <div className="flex items-center gap-2" data-testid="organiser-todays-focus-start">
            <Clock className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-tight">
                {new Date(focus.startAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-[11px] text-muted-foreground">Starts</p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="organiser-todays-focus-registered">
            <Users className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-tight">{focus.registeredCount}</p>
              <p className="text-[11px] text-muted-foreground">Registered</p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="organiser-todays-focus-checkedin">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-tight">{focus.checkedInCount}</p>
              <p className="text-[11px] text-muted-foreground">Checked In</p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="organiser-todays-focus-weather">
            <span className="text-base leading-none" aria-hidden="true">{focus.weatherEmoji}</span>
            <div>
              <p className="text-sm font-bold leading-tight">{focus.weatherLabel}</p>
              <p className="text-[11px] text-muted-foreground">Weather</p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="organiser-todays-focus-courts">
            <LayoutGrid className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold leading-tight">{focus.courtsReady}/{focus.courtsTotal}</p>
              <p className="text-[11px] text-muted-foreground">Courts Ready</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
