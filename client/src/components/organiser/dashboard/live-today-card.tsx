import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, CheckCircle2, Clock, Play, Hourglass, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountdownTimer } from "./countdown-timer";
import type { MockSession, LiveSessionState, CourtState } from "@/lib/organiser-hub-mock-data";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.png";

interface LiveTodayCardProps {
  session: MockSession | null;
  liveState?: LiveSessionState;
  className?: string;
  onEnterLive?: () => void;
}

const COURT_ICON: Record<CourtState, typeof CheckCircle2> = {
  ready: CheckCircle2,
  playing: Play,
  pending: Hourglass,
};

// Ready = done and waiting, playing = in progress right now, pending =
// hasn't started. Deliberately no colour-per-status beyond primary/muted —
// the point is glanceable state, not a traffic-light palette we don't have.
const COURT_STYLE: Record<CourtState, string> = {
  ready: "bg-primary/15 text-primary-foreground",
  playing: "bg-primary text-primary-foreground",
  pending: "bg-primary-foreground/10 text-primary-foreground/60",
};

// This is the one card allowed to be big and photographic — everything
// else on the page stays quiet by comparison. It's also the card built to
// grow into TC Live: once `liveState.connectedPlayers` is a real number
// coming off a live socket instead of undefined mock data, the headline
// below switches itself from "LIVE NOW" to "TC LIVE" with a connected-
// player count, no restructuring needed elsewhere.
export function LiveTodayCard({ session, liveState, className, onEnterLive }: LiveTodayCardProps) {
  if (!session) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-card shadow-sm p-8 flex flex-col items-center justify-center text-center gap-2",
          className
        )}
        data-testid="organiser-live-today-card-empty"
      >
        <Clock className="w-6 h-6 text-muted-foreground" />
        <p className="font-semibold">Nothing live right now</p>
        <p className="text-sm text-muted-foreground">Your next session will show up here on the day.</p>
      </div>
    );
  }

  const isTcLive = liveState?.connectedPlayers !== undefined;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-end text-primary-foreground",
        className
      )}
      data-testid="organiser-live-today-card"
    >
      <img
        src={courtImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-t from-foreground/90 via-foreground/50 to-foreground/20" />

      <div className="relative p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary text-primary-foreground w-fit gap-1.5" data-testid="organiser-live-today-badge">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
            </span>
            {isTcLive ? "TC LIVE" : "LIVE NOW"}
          </Badge>

          {liveState && (
            <Badge variant="secondary" className="w-fit" data-testid="organiser-live-today-round">
              Round {liveState.roundCurrent} / {liveState.roundTotal}
            </Badge>
          )}

          {isTcLive && (
            <Badge variant="secondary" className="w-fit gap-1" data-testid="organiser-live-today-connected">
              <Users className="w-3 h-3" />
              {liveState!.connectedPlayers} Connected
            </Badge>
          )}
        </div>

        <div>
          <h3 className="text-xl sm:text-2xl font-display font-bold">{session.title}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-foreground/85 mt-1">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {session.location}
            </span>
            {liveState && (
              <span className="flex items-center gap-1.5" data-testid="organiser-live-today-round-countdown">
                <Timer className="w-3.5 h-3.5" />
                Round ends in <CountdownTimer target={liveState.roundEndsAt} className="font-semibold" />
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-md">
          <div>
            <p className="text-lg font-bold flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {session.registeredCount}
            </p>
            <p className="text-xs text-primary-foreground/75">Registered</p>
          </div>
          <div>
            <p className="text-lg font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {session.checkedInCount}
            </p>
            <p className="text-xs text-primary-foreground/75">Checked In</p>
          </div>
          <div>
            <p className="text-lg font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {session.waitingCount}
            </p>
            <p className="text-xs text-primary-foreground/75">Waiting List</p>
          </div>
        </div>

        {liveState && liveState.courts.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="organiser-live-today-courts">
            {liveState.courts.map((court) => {
              const Icon = COURT_ICON[court.state];
              return (
                <div
                  key={court.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                    COURT_STYLE[court.state]
                  )}
                  data-testid={`organiser-live-today-court-${court.id}`}
                  title={court.state}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {court.label}
                </div>
              );
            })}
          </div>
        )}

        <Button
          size="lg"
          className="w-full text-base font-bold h-14"
          onClick={onEnterLive}
          data-testid="organiser-live-today-enter-button"
        >
          <Play className="w-5 h-5 mr-2 fill-current" />
          {isTcLive ? "Enter TC Live" : "Enter Live Control"}
        </Button>
      </div>
    </div>
  );
}
