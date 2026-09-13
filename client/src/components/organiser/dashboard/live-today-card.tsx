import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, CheckCircle2, Clock, Play, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession } from "@/lib/organiser-hub-mock-data";
import { formatInTimeZone } from "@/lib/timezone";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";
import noLiveSessionImage from "/assets/images/no_live_session_court_bench.webp";

interface LiveTodayCardProps {
  session: MockSession | null;
  // The soonest published/upcoming session, if any - used for State A's
  // "Next: ..." teaser and to decide whether State B (starting soon)
  // applies at all.
  nextUpcoming?: MockSession | null;
  className?: string;
  onEnterLive?: () => void;
  onManageCheckIn?: (sessionId: string) => void;
  onOpenSession?: (sessionId: string) => void;
}

function formatCountdown(startAt: string): string {
  const ms = new Date(startAt).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// This is the one card allowed to be big and photographic — everything
// else on the page stays quiet by comparison. Same photographic
// treatment across all three states (noLiveSessionImage when nothing's
// happening, session.coverImage/courtImage once something is) - swaps
// automatically as `session`/`nextUpcoming` change, no extra logic
// needed for the transitions between them.
//
// Three states, matching the spec's NOW/starting-soon/live hierarchy:
//   A - nothing live, nothing starting soon (still shows a "Next: ..."
//       teaser if something's upcoming, so the organiser isn't left
//       wondering)
//   B - nothing live yet, but the next published session starts within
//       24h - a countdown plus Manage Check-in / Open Session, so the
//       organiser can prep before it's actually time to go live
//   C - a session is actually live - full stats plus Enter Live Session
export function LiveTodayCard({ session, nextUpcoming, className, onEnterLive, onManageCheckIn, onOpenSession }: LiveTodayCardProps) {
  if (session) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow min-h-[280px] flex flex-col justify-end text-primary-foreground",
          className
        )}
        data-testid="organiser-live-today-card"
      >
        <img
          src={session.coverImage || courtImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-foreground/85 via-foreground/40 to-foreground/10" />

        <div className="relative p-5 sm:p-6 space-y-4">
          <Badge className="bg-primary text-foreground w-fit gap-1.5" data-testid="organiser-live-today-badge">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
            </span>
            LIVE TODAY
          </Badge>

          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold">{session.title}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-foreground/85 mt-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatInTimeZone(session.startAt, session.timeZone, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {session.location}
              </span>
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
                <Calendar className="w-4 h-4" />
                {session.waitingCount}
              </p>
              <p className="text-xs text-primary-foreground/75">Waiting List</p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={onEnterLive}
            data-testid="organiser-live-today-enter-button"
          >
            <Play className="w-4 h-4 mr-2" />
            Enter Live Session
          </Button>
        </div>
      </div>
    );
  }

  const msUntilNext = nextUpcoming ? new Date(nextUpcoming.startAt).getTime() - Date.now() : null;
  const startingSoon = nextUpcoming && msUntilNext !== null && msUntilNext > 0 && msUntilNext <= 24 * 60 * 60 * 1000;

  // State B - starting soon, not live yet.
  if (startingSoon && nextUpcoming) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow min-h-[280px] flex flex-col justify-end text-primary-foreground",
          className
        )}
        data-testid="organiser-live-today-card-soon"
      >
        <img
          src={nextUpcoming.coverImage || courtImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-foreground/85 via-foreground/40 to-foreground/10" />

        <div className="relative p-5 sm:p-6 space-y-4">
          <Badge variant="secondary" className="w-fit gap-1.5" data-testid="organiser-live-today-badge-soon">
            <Clock className="w-3 h-3" />
            Starts in {formatCountdown(nextUpcoming.startAt)}
          </Badge>

          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold">{nextUpcoming.title}</h2>
            <p className="text-sm text-primary-foreground/85 mt-1">
              {nextUpcoming.registeredCount} registered
              {nextUpcoming.checkedInCount > 0 ? ` · ${nextUpcoming.checkedInCount} checked in` : ""}
              {nextUpcoming.location ? ` · ${nextUpcoming.location}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              onClick={() => onManageCheckIn?.(nextUpcoming.id)}
              data-testid="organiser-live-today-manage-checkin"
            >
              Manage Check-in
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onOpenSession?.(nextUpcoming.id)}
              data-testid="organiser-live-today-open-session"
            >
              Open Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // State A - nothing live, nothing starting soon.
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-sm min-h-[280px] flex flex-col items-center justify-center text-center gap-2",
        className
      )}
      data-testid="organiser-live-today-card-empty"
    >
      <img
        src={noLiveSessionImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-t from-foreground/85 via-foreground/50 to-foreground/20" />
      <Clock className="relative w-6 h-6 text-primary" />
      <p className="relative font-semibold text-primary">Nothing live right now</p>
      <p className="relative text-sm text-primary/80">Your next session will show up here on the day.</p>
      {nextUpcoming && (
        <button
          type="button"
          onClick={() => onOpenSession?.(nextUpcoming.id)}
          className="relative mt-2 flex items-center gap-1.5 text-sm text-primary-foreground bg-primary/20 hover:bg-primary/30 transition-colors rounded-full px-3 py-1.5"
          data-testid="organiser-live-today-next-teaser"
        >
          Next: {nextUpcoming.title} ·{" "}
          {formatInTimeZone(nextUpcoming.startAt, nextUpcoming.timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
