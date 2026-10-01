import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Users } from "lucide-react";
import { formatInTimeZone } from "@/lib/timezone";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { RECOMMENDATION_REASON_TEXT } from "@/lib/play-status";
import { ActivityStatus } from "./ActivityStatus";
import type { PublicSessionCard as PublicSessionCardData } from "@shared/schema";
import { resolvePartnerBadge } from "@shared/partnerEvents";

function formatLabel(type: string): string {
  const known = SESSION_TYPE_OPTIONS.find((t) => t.key === type)?.label;
  if (known) return known;
  // Externally discovered types not in the option list ("cardio-tennis").
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

export function PlaySessionCard({
  session,
  onView,
  recommendation,
}: {
  session: PublicSessionCardData;
  onView: () => void;
  // Optional - only present when this same card is reused inside
  // "Recommended for You" (spec: reuse ActivityCard, don't build a
  // separate card architecture for recommendations). A normal search
  // result never passes this.
  recommendation?: { score: number; reasons: string[] } | null;
}) {
  const spotsLeft = session.maxParticipants != null ? session.maxParticipants - session.registeredCount : null;
  const showAsFull = session.playStatus === "full" || session.playStatus === "waitlist";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      className="rounded-2xl border border-border overflow-hidden bg-card hover:shadow-md transition-shadow flex flex-col sm:flex-row cursor-pointer"
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
        <ActivityStatus
          status={session.playStatus}
          className="absolute top-2 left-2 text-[11px] font-semibold"
          data-testid={`play-session-card-${session.id}-status`}
        />
      </div>

      <div className="flex-1 min-w-0 p-4 flex flex-col gap-2">
        <h3 className="font-display font-bold text-lg leading-tight" data-testid={`play-session-card-${session.id}-title`}>
          {session.title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          {session.type && (
            <Badge variant="secondary" className="text-xs" data-testid={`play-session-card-${session.id}-format`}>{formatLabel(session.type)}</Badge>
          )}
          <Badge variant="outline" className="text-xs" data-testid={`play-session-card-${session.id}-level`}>{session.skillLevel ?? (session.externalSourceUrl ? "Level not stated" : "All Levels")}</Badge>
          {session.courtsCount != null && <Badge variant="outline" className="text-xs">{session.courtsCount} courts</Badge>}
        </div>

        <p className="text-sm text-muted-foreground">{formatWhen(session)}</p>

        {session.priceSummary && (
          <p className="text-sm text-muted-foreground" data-testid={`play-session-card-${session.id}-price`}>
            {session.priceSummary}
          </p>
        )}

        {session.location && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{session.location}</span>
          </p>
        )}

        <div className="flex items-center gap-1.5 text-sm" data-testid={`play-session-card-${session.id}-players`}>
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

        {recommendation && recommendation.score > 0 && (
          <div
            className="flex items-center gap-1.5 text-sm bg-primary/5 rounded-lg px-2.5 py-1.5 min-w-0"
            data-testid={`play-session-card-${session.id}-match`}
          >
            <span className="font-bold text-primary shrink-0">{recommendation.score}% match</span>
            <span className="text-muted-foreground text-xs truncate min-w-0">
              · {recommendation.reasons.map((r) => RECOMMENDATION_REASON_TEXT[r] ?? r).join(" · ")}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-1 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2 min-w-0" data-testid={`play-session-card-${session.id}-organiser`}>
            <Avatar className="h-6 w-6 shrink-0">
              {session.organizationLogo && <AvatarImage src={session.organizationLogo} alt="" />}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(session.organizationName)}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {(() => {
                const badge = resolvePartnerBadge({ sourceType: session.sourceType, name: session.partnerName ?? session.organizationName });
                if (!badge.label) {
                  return (
                    <>
                      Organised by <span className="text-foreground font-medium">{session.organizationName}</span>
                    </>
                  );
                }
                return (
                  <>
                    <span className="text-primary font-medium">{badge.label === "Partner" ? "TennisConnect Partner ✓" : badge.label}</span> · {badge.name}
                  </>
                );
              })()}
            </span>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            data-testid={`play-session-card-${session.id}-view`}
          >
            View
          </Button>
        </div>
      </div>
    </div>
  );
}
