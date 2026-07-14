import {
  Grid3x3,
  DoorOpen,
  Trees,
  Lightbulb,
  MousePointerClick,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClubGallery } from "./ClubGallery";
import { ClubCTABanner } from "./ClubCTABanner";
import { ArticleRichContent } from "@/components/articles/ArticleRichContent";
import { getSurfaceLabel, getServiceLabel } from "@/lib/clubVariant";

interface CourtsSectionProps {
  club: any;
  onBookCourt: () => void;
  onViewAllCourts: () => void;
}

export function CourtsSection({
  club,
  onBookCourt,
  onViewAllCourts,
}: CourtsSectionProps) {
  const infoRows = [
    {
      icon: <Grid3x3 className="w-4 h-4" />,
      label: "Hard Courts",
      value: club.courtSurfaces?.length
        ? club.courtSurfaces.map(getSurfaceLabel).join(", ")
        : "Not specified",
    },
    {
      icon: <DoorOpen className="w-4 h-4" />,
      label: "Indoor Courts",
      value: `${club.indoorCourts ?? 0}`,
    },
    {
      icon: <Trees className="w-4 h-4" />,
      label: "Outdoor Courts",
      value: `${club.outdoorCourts ?? 0}`,
    },
    {
      icon: <Lightbulb className="w-4 h-4" />,
      label: "Lighting",
      value: club.hasLighting ? "Yes" : "No",
    },
    {
      icon: <MousePointerClick className="w-4 h-4" />,
      label: "Court Booking",
      value: club.courtBookingAvailable ? "Available" : "Contact to book",
    },
    {
      icon: <Users className="w-4 h-4" />,
      label: "Public Access",
      value: club.publicAccess ? "Yes" : "Members Only",
    },
  ];

  const hasGallery = (club.gallery?.length ?? 0) > 0;

  return (
    <div className="space-y-6" data-testid="club-courts-section-detail">
      {/* Description */}
      <div className="rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="font-display font-bold text-xl mb-3">About</h2>
        <ArticleRichContent
          content={club.description}
          testId="club-description"
        />
      </div>

      {/* Court Information + Gallery */}
      <div className={hasGallery ? "grid md:grid-cols-2 gap-6" : ""}>
        <div
          className="rounded-2xl border bg-card p-5 md:p-6"
          data-testid="club-court-information"
        >
          <h3 className="font-display font-bold text-lg mb-4">
            Court Information
          </h3>
          <div className="space-y-3">
            {infoRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 text-sm py-2 border-b border-border/50 last:border-0"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  {row.icon}
                  {row.label}
                </span>
                <span className="font-semibold text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {hasGallery && (
          <ClubGallery images={club.gallery ?? []} clubName={club.name} />
        )}
      </div>

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

      <ClubCTABanner
        title="Ready to play?"
        subtitle="Book your court online in just a few clicks."
        primaryLabel="Book a Court"
        onPrimaryClick={onBookCourt}
        secondaryLabel="View All Courts"
        onSecondaryClick={onViewAllCourts}
      />
    </div>
  );
}
