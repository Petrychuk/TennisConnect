import { CalendarDays, Users, Trophy, HeartHandshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClubGallery } from "./ClubGallery";
import { ClubCTABanner } from "./ClubCTABanner";
import { getServiceLabel, getCompetitionLabel } from "@/lib/clubVariant";

interface CommunitySectionProps {
  club: any;
  onJoin: () => void;
  onViewSchedule: () => void;
}

export function CommunitySection({
  club,
  onJoin,
  onViewSchedule,
}: CommunitySectionProps) {
  const highlights = [
    {
      icon: <Users className="w-4 h-4" />,
      label: "Membership",
      value: club.membershipRequired ? "Members Only" : "Open to All",
    },
    {
      icon: <CalendarDays className="w-4 h-4" />,
      label: "Weekly Sessions",
      value: club.socialTennisDays?.length
        ? `${club.socialTennisDays.length}`
        : "Contact for schedule",
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

  return (
    <div className="space-y-6" data-testid="club-community-section-detail">
      {/* About */}
      <div className="rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="font-display font-bold text-xl mb-3">
          About Our Community
        </h2>
        <p
          className="text-muted-foreground leading-relaxed whitespace-pre-line"
          data-testid="club-description"
        >
          {club.description}
        </p>
      </div>

      {/* Weekly schedule */}
      {club.socialTennisDays?.length > 0 && (
        <div
          className="rounded-2xl border bg-card p-5 md:p-6"
          data-testid="club-social-days"
        >
          <h3 className="font-display font-bold text-lg mb-4">
            Weekly Social Tennis
          </h3>
          <div className="flex flex-wrap gap-2">
            {club.socialTennisDays.map((day: string) => (
              <Badge
                key={day}
                className="px-3 py-1.5 bg-primary/10 text-primary border-primary/20"
              >
                {day}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Community Highlights */}
      <div
        className="rounded-2xl border bg-card p-5 md:p-6"
        data-testid="club-community-highlights"
      >
        <h3 className="font-display font-bold text-lg mb-4">
          Community Highlights
        </h3>
        <div className="grid grid-cols-2 gap-4">
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
      </div>

      {/* Hosted competitions */}
      {club.hostedCompetitions?.length > 0 && (
        <div
          className="rounded-2xl border bg-card p-5 md:p-6"
          data-testid="club-hosted-competitions"
        >
          <h3 className="font-display font-bold text-lg mb-4">
            Events & Competitions
          </h3>
          <div className="flex flex-wrap gap-2">
            {club.hostedCompetitions.map((c: string) => (
              <Badge key={c} variant="secondary" className="px-3 py-1.5">
                {getCompetitionLabel(c)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {club.services?.length > 0 && (
        <div
          className="rounded-2xl border bg-card p-5 md:p-6"
          data-testid="club-services"
        >
          <h3 className="font-display font-bold text-lg mb-4">Services</h3>
          <div className="flex flex-wrap gap-2">
            {club.services.map((s: string) => (
              <Badge key={s} variant="secondary" className="px-3 py-1.5">
                {getServiceLabel(s)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <ClubGallery images={club.gallery ?? []} clubName={club.name} />

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
