import {
  CalendarDays,
  Users,
  Trophy,
  HeartHandshake,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClubGallery } from "./ClubGallery";
import { ClubCTABanner } from "./ClubCTABanner";
import { ClubContactCard } from "./ClubContactCard";
import { FormattedText } from "./FormattedText";
import { getServiceLabel, getCompetitionLabel } from "@/lib/clubVariant";
import type { ClubSession } from "@shared/schema";

interface CommunitySectionProps {
  club: any;
  onJoin: () => void;
  onViewSchedule: () => void;
}

function formatTime(time?: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

const SESSION_ICON_BG = [
  "bg-primary/10 text-primary",
  "bg-orange-500/10 text-orange-600",
  "bg-pink-500/10 text-pink-600",
  "bg-sky-500/10 text-sky-600",
  "bg-purple-500/10 text-purple-600",
];

export function CommunitySection({
  club,
  onJoin,
  onViewSchedule,
}: CommunitySectionProps) {
  const sessions: ClubSession[] = club.sessions?.length
    ? club.sessions
    : (club.socialTennisDays ?? []).map(
        (day: string, i: number): ClubSession => ({
          id: `day-${i}`,
          day,
          name: `${day} Social Tennis`,
          startTime: "",
          endTime: "",
          level: "All Levels",
        })
      );

  const highlights = [
    {
      icon: <Users className="w-4 h-4" />,
      label: "Membership",
      value: club.membershipRequired ? "Members Only" : "Open to All",
    },
    {
      icon: <CalendarDays className="w-4 h-4" />,
      label: "Weekly Sessions",
      value: sessions.length ? `${sessions.length}` : "Contact for schedule",
    },
    {
      icon: <Trophy className="w-4 h-4" />,
      label: "Events",
      value: club.hostsCompetitions ? "Regularly" : "Occasional",
    },
    {
      icon: <HeartHandshake className="w-4 h-4" />,
      label: "Vibe",
      value: "Friendly & Supportive",
    },
  ];

  const hasSessions = sessions.length > 0;
  const hasGallery = (club.gallery?.length ?? 0) > 0;

  return (
    <div className="space-y-6" data-testid="club-community-section-detail">
      {/* Community Highlights — right under the hero */}
      <div
        className="rounded-2xl border bg-card p-5 md:p-6"
        data-testid="club-community-highlights"
      >
        <h3 className="font-display font-bold text-lg mb-4">
          Community Highlights
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {highlights.map((h) => (
            <div key={h.label} className="flex items-start gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                {h.icon}
              </span>
              <div>
                <p className="font-semibold text-sm leading-none">
                  {h.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {h.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {club.hostedCompetitions?.length > 0 && (
          <div className="mt-5 pt-5 border-t border-border/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Events & Competitions
            </p>
            <div className="flex flex-wrap gap-2">
              {club.hostedCompetitions.map((c: string) => (
                <Badge key={c} variant="secondary" className="px-3 py-1.5">
                  {getCompetitionLabel(c)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 1: About + Upcoming Sessions (only if any) + Contact.
          About takes the extra 2 columns when there are no sessions to show. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div
          className={`rounded-2xl border bg-card p-5 md:p-6 ${
            hasSessions ? "lg:col-span-1" : "lg:col-span-3"
          }`}
        >
          <h2 className="font-display font-bold text-xl mb-3">
            About Our Community
          </h2>
          <FormattedText text={club.description} testId="club-description" />

          {club.hostsCompetitions && (
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
                Tournaments & events
              </li>
            </ul>
          )}
        </div>

        {hasSessions && (
          <div
            className="lg:col-span-2 rounded-2xl border bg-card p-5 md:p-6"
            data-testid="club-upcoming-sessions"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">
                Upcoming Sessions
              </h3>
            </div>

            <div className="space-y-2">
              {sessions.slice(0, 7).map((session, i) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                  data-testid={`club-session-item-${i}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      SESSION_ICON_BG[i % SESSION_ICON_BG.length]
                    }`}
                  >
                    <Users className="w-4 h-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {session.name || session.day}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />
                      {session.day}
                      {session.startTime &&
                        ` \u00b7 ${formatTime(session.startTime)}${
                          session.endTime
                            ? ` - ${formatTime(session.endTime)}`
                            : ""
                        }`}
                    </p>
                  </div>

                  {session.level && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {session.level}
                    </Badge>
                  )}

                  {session.price !== undefined &&
                    session.price !== null && (
                      <span className="shrink-0 font-bold text-sm">
                        ${session.price}
                      </span>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="lg:col-span-1" id="club-section-contact">
          <ClubContactCard club={club} personLabel="Community Lead" />
        </div>
      </div>

      {/* Services */}
      <div
        className="rounded-2xl border bg-card p-5 md:p-6"
        data-testid="club-services"
      >
        <h3 className="font-display font-bold text-lg mb-4">Services</h3>
        {club.services?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {club.services.map((s: string) => (
              <Badge key={s} variant="secondary" className="px-3 py-1.5">
                {getServiceLabel(s)}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No services listed yet.
          </p>
        )}
      </div>

      {/* Gallery — last, and only shown when there are photos */}
      {hasGallery && (
        <ClubGallery images={club.gallery ?? []} clubName={club.name} />
      )}

      <ClubCTABanner
        title="Ready to join our community?"
        subtitle="Come play, connect, and have fun with amazing people."
        primaryLabel="Join Today"
        onPrimaryClick={onJoin}
        secondaryLabel="View Schedule"
        onSecondaryClick={onViewSchedule}
      />
    </div>
  );
}
