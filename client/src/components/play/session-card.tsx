import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from "@/lib/timezone";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { PLAY_STATUS_LABEL, PLAY_STATUS_STYLE } from "@/lib/play-status";
import type { PublicSessionCard as PublicSessionCardData } from "@shared/schema";

function formatLabel(type: string): string {
  return SESSION_TYPE_OPTIONS.find((t) => t.key === type)?.label ?? type;
}

function isMultiDay(startAt: string, endAt: string | null, timeZone: string): boolean {
  if (!endAt) return false;
  const startDay = formatInTimeZone(startAt, timeZone, { year: "numeric", month: "numeric", day: "numeric" });
  const endDay = formatInTimeZone(endAt, timeZone, { year: "numeric", month: "numeric", day: "numeric" });
  return startDay !== endDay;
}

function formatWhen(session: PublicSessionCardData): string {
  const { startAt, endAt, timeZone } = session;
  if (isMultiDay(startAt, endAt, timeZone)) {
    const start = formatInTimeZone(startAt, timeZone, { day: "numeric", month: "short" });
    const end = formatInTimeZone(endAt!, timeZone, { day: "numeric", month: "short", year: "numeric" });
    return `${start} – ${end}`;
  }
  const date = formatInTimeZone(startAt, timeZone, { weekday: "short", day: "numeric", month: "short" });
  const startTime = formatInTimeZone(startAt, timeZone, { hour: "numeric", minute: "2-digit" });
  if (!endAt) return `${date} · ${startTime}`;
  const endTime = formatInTimeZone(endAt, timeZone, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${startTime} – ${endTime}`;
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function PlaySessionCard({ session }: { session: PublicSessionCardData }) {
  const spotsLeft = session.maxParticipants != null ? session.maxParticipants - session.registeredCount : null;
  const showAsFull = session.playStatus === "full" || session.playStatus === "waitlist";

  return (
    <div
      className="rounded-2xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow flex flex-col sm:flex-row"
      data-testid={`play-session-card-${session.id}`}
    >
      <div className="relative w-full sm:w-40 h-40 sm:h-auto shrink-0 bg-muted">
        {session.coverImage ? (
          <img src={session.coverImage} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
            <span className="text-3xl">🎾</span>
          </div>
        )}
        <Badge
          className={cn("absolute top-2 left-2 text-[11px] font-semibold", PLAY_STATUS_STYLE[session.playStatus])}
          data-testid={`play-session-card-${session.id}-status`}
        >
          {PLAY_STATUS_LABEL[session.playStatus]}
        </Badge>
      </div>

      <div className="flex-1 min-w-0 p-4 flex flex-col gap-2">
        <h3 className="font-display font-bold text-lg leading-tight" data-testid={`play-session-card-${session.id}-title`}>
          {session.title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">{formatLabel(session.type)}</Badge>
          <Badge variant="outline" className="text-xs">{session.skillLevel ?? "All Levels"}</Badge>
          {session.courtsCount != null && <Badge variant="outline" className="text-xs">{session.courtsCount} courts</Badge>}
        </div>

        <p className="text-sm text-muted-foreground">{formatWhen(session)}</p>

        {session.location && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{session.location}</span>
          </p>
        )}

        <div className="flex items-center gap-1.5 text-sm">
          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {session.maxParticipants != null ? (
            <>
              <span>{session.registeredCount} / {session.maxParticipants} players</span>
              {spotsLeft != null && spotsLeft > 0 && !showAsFull && (
                <span className="text-green-600 dark:text-green-400 font-medium">· {spotsLeft} spots left</span>
              )}
            </>
          ) : (
            <span>{session.registeredCount} players</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-1 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              {session.organizationLogo && <AvatarImage src={session.organizationLogo} alt="" />}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(session.organizationName)}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              Organised by <span className="text-foreground font-medium">{session.organizationName}</span>
            </span>
          </div>
          <Button asChild size="sm" className="shrink-0" data-testid={`play-session-card-${session.id}-view`}>
            <Link href={`/play/${session.id}`}>View</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
