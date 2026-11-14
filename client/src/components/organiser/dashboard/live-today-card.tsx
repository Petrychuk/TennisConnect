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

// No panel behind the text: white text in the bottom-left corner of the photo,
// with a soft shadow (text and icons) so it stays readable on light photos too.
const PANEL = "relative self-start m-3 sm:m-4 space-y-2 text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.65)] [&_svg]:drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]";
const MUTED = "text-white/90";
const FAINT = "text-white/80";
const CHIP = "text-white bg-white/20 hover:bg-white/30";

// Same height on every state and, on desktop, the same height as the
// Upcoming Sessions card with three sessions in it - so the two sit level.
const FRAME = "relative overflow-hidden rounded-2xl shadow-sm min-h-[260px] xl:h-[340px] flex flex-col justify-end";

// This is the one card allowed to be big and photographic - everything
// else on the page stays quiet by comparison.
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
  const msUntilNext = nextUpcoming ? new Date(nextUpcoming.startAt).getTime() - Date.now() : null;
  const startingSoon = !!nextUpcoming && msUntilNext !== null && msUntilNext > 0 && msUntilNext <= 24 * 60 * 60 * 1000;

  // State C - a session is actually live.
  if (session) {
    return (
      <div className={cn(FRAME, className)} data-testid="organiser-live-today-card">
        <img src={session.coverImage || courtImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />

        <div className={cn(PANEL, "max-w-xl")}>
          <Badge className="bg-primary text-foreground w-fit gap-1.5" data-testid="organiser-live-today-badge">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
            </span>
            LIVE TODAY
          </Badge>

          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold">{session.title}</h2>
            <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-1", MUTED)}>
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

          <div className="grid grid-cols-3 gap-2 max-w-sm">
            <div>
              <p className="text-base font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {session.registeredCount}
              </p>
              <p className={cn("text-xs", FAINT)}>Registered</p>
            </div>
            <div>
              <p className="text-base font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {session.checkedInCount}
              </p>
              <p className={cn("text-xs", FAINT)}>Checked In</p>
            </div>
            <div>
              <p className="text-base font-bold flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {session.waitingCount}
              </p>
              <p className={cn("text-xs", FAINT)}>Waiting List</p>
            </div>
          </div>

          {/* No onEnterLive = TC Live isn't available here (Production):
              open the session instead of a "coming soon" page. */}
          {onEnterLive ? (
            <Button
              size="default"
              className="w-full sm:w-auto"
              onClick={onEnterLive}
              data-testid="organiser-live-today-enter-button"
            >
              <Play className="w-4 h-4 mr-2" />
              Enter Live Session
            </Button>
          ) : onOpenSession && (
            <Button
              size="default"
              className="w-full sm:w-auto"
              onClick={() => onOpenSession(session.id)}
              data-testid="organiser-live-today-open-button"
            >
              Open Session
            </Button>
          )}
        </div>
      </div>
    );
  }

  // State B - starting soon, not live yet.
  if (startingSoon && nextUpcoming) {
    return (
      <div className={cn(FRAME, className)} data-testid="organiser-live-today-card-soon">
        <img src={nextUpcoming.coverImage || courtImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />

        <div className={cn(PANEL, "max-w-xl")}>
          <Badge variant="secondary" className="w-fit gap-1.5" data-testid="organiser-live-today-badge-soon">
            <Clock className="w-3 h-3" />
            Starts in {formatCountdown(nextUpcoming.startAt)}
          </Badge>

          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold">{nextUpcoming.title}</h2>
            <p className={cn("text-sm mt-1", MUTED)}>
              {nextUpcoming.registeredCount} registered
              {nextUpcoming.checkedInCount > 0 ? ` · ${nextUpcoming.checkedInCount} checked in` : ""}
              {nextUpcoming.location ? ` · ${nextUpcoming.location}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="default"
              onClick={() => onManageCheckIn?.(nextUpcoming.id)}
              data-testid="organiser-live-today-manage-checkin"
            >
              Manage Check-in
            </Button>
            <Button
              size="default"
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
    <div className={cn(FRAME, className)} data-testid="organiser-live-today-card-empty">
      <img src={noLiveSessionImage} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />

      <div className={cn(PANEL, "max-w-sm flex flex-col items-start gap-1")}>
        <Clock className="w-5 h-5" />
        <p className="font-semibold text-base">Nothing live right now</p>
        <p className={cn("text-xs sm:text-sm", MUTED)}>Your next session will show up here on the day.</p>
        {nextUpcoming && (
          <button
            type="button"
            onClick={() => onOpenSession?.(nextUpcoming.id)}
            className={cn("mt-1 flex items-center gap-1.5 text-sm transition-colors rounded-full px-3 py-1.5", CHIP)}
            data-testid="organiser-live-today-next-teaser"
          >
            Next: {nextUpcoming.title} ·{" "}
            {formatInTimeZone(nextUpcoming.startAt, nextUpcoming.timeZone, { weekday: "short", hour: "numeric", minute: "2-digit" })}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
