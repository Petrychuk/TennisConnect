import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, CheckCircle2, Clock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockSession } from "@/lib/organiser-hub-mock-data";
import { formatInTimeZone } from "@/lib/timezone";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";

interface LiveTodayCardProps {
  session: MockSession | null;
  className?: string;
  onEnterLive?: () => void;
}

// This is the one card allowed to be big and photographic — everything
// else on the page stays quiet by comparison.
export function LiveTodayCard({ session, className, onEnterLive }: LiveTodayCardProps) {
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow min-h-[280px] flex flex-col justify-end text-primary-foreground",
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
      <div className="absolute inset-0 bg-linear-to-t from-foreground/85 via-foreground/40 to-foreground/10" />

      <div className="relative p-5 sm:p-6 space-y-4">
        <Badge className="bg-primary text-primary-foreground w-fit gap-1.5" data-testid="organiser-live-today-badge">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
          </span>
          LIVE TODAY
        </Badge>

        <div>
          <h3 className="text-xl sm:text-2xl font-display font-bold">{session.title}</h3>
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
