import { Users, Trophy, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClubGallery } from "./ClubGallery";
import { ClubCTABanner } from "./ClubCTABanner";
import { ClubContactCard } from "./ClubContactCard";
import { ArticleRichContent } from "@/components/articles/ArticleRichContent";
import { getCompetitionLabel, formatLocation } from "@/lib/clubVariant";
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

// TEMPORARY: placeholder sessions so the Upcoming Sessions layout can be
// reviewed before real sessions are added via the admin Sessions section.
// Only used when a club has neither club.sessions nor socialTennisDays set.
// Remove this once you're happy with the layout / have real data everywhere.
const DEMO_SESSIONS: ClubSession[] = [
  {
    id: "demo-1",
    day: "Thursday",
    name: "Thursday Social Hit",
    startTime: "18:30",
    endTime: "20:30",
    price: 18,
    level: "Intermediate",
  },
  {
    id: "demo-2",
    day: "Saturday",
    name: "Saturday Morning Tennis",
    startTime: "09:00",
    endTime: "11:00",
    price: 18,
    level: "All Levels",
  },
];

export function CommunitySection({
  club,
  onJoin,
  onViewSchedule,
}: CommunitySectionProps) {
  const sessions: ClubSession[] = club.sessions?.length
    ? club.sessions
    : club.socialTennisDays?.length
      ? club.socialTennisDays.map(
          (day: string, i: number): ClubSession => ({
            id: `day-${i}`,
            day,
            name: `${day} Social Tennis`,
            startTime: "",
            endTime: "",
            level: "All Levels",
          })
        )
      : DEMO_SESSIONS;

  const hasSessions = sessions.length > 0;
  const hasGallery = (club.gallery?.length ?? 0) > 0;

  return (
    <div className="space-y-6" data-testid="club-community-section-detail">
      {/* Row 1: About + Upcoming Sessions (only if any) + Contact.
          About takes the extra columns when there are no sessions to show.
          When sessions exist, custom column widths give About ~30% more
          room (taken from Sessions) instead of a flat 1:2:1 split. */}
      <div
        className={`grid grid-cols-1 gap-6 lg:gap-2 ${
          hasSessions ? "lg:grid-cols-[1.6fr_1.4fr_1fr]" : "lg:grid-cols-4"
        }`}
      >
        <div
          className={`rounded-2xl border bg-card p-5 md:p-6 ${
            hasSessions ? "" : "lg:col-span-3"
          }`}
        >
          <h2 className="font-display font-bold text-xl mb-3">
            About Our Community
          </h2>
          <ArticleRichContent content={club.description} testId="club-description" compact />

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
            className="rounded-2xl border bg-card p-5 md:p-6"
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

        <div id="club-section-contact">
          <ClubContactCard club={club} personLabel="Community Lead" />
        </div>
      </div>

      {/* Gallery — last, and only shown when there are photos */}
      {hasGallery && (
        <ClubGallery images={club.gallery ?? []} clubName={club.name} location={formatLocation(club)} />
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
