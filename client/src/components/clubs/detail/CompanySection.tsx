import { MapPin, ExternalLink, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClubGallery } from "./ClubGallery";
import { ClubCTABanner } from "./ClubCTABanner";
import { getServiceLabel, getStateLabel } from "@/lib/clubVariant";

interface CompanySectionProps {
  club: any;
  onViewLocations: () => void;
  onContactUs: () => void;
}

export function CompanySection({
  club,
  onViewLocations,
  onContactUs,
}: CompanySectionProps) {
  return (
    <div className="space-y-6" data-testid="club-company-section-detail">
      {/* Network summary */}
      <div
        className="rounded-2xl border bg-card p-5 md:p-6"
        data-testid="club-network-summary"
      >
        <div className="flex items-center gap-2 text-primary mb-2">
          <Building2 className="w-5 h-5" />
          <h2 className="font-display font-bold text-xl">
            {club.numberOfLocations ?? 1} Locations
            {club.state ? ` Across ${getStateLabel(club.state)}` : ""}
          </h2>
        </div>
        <p
          className="text-muted-foreground leading-relaxed whitespace-pre-line"
          data-testid="club-description"
        >
          {club.description}
        </p>
      </div>

      {/* Primary location + map link */}
      <div
        className="rounded-2xl border bg-card overflow-hidden"
        data-testid="club-primary-location"
      >
        <div className="p-5 md:p-6">
          <h3 className="font-display font-bold text-lg mb-3">
            Head Office / Main Location
          </h3>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {[club.address, club.suburb, getStateLabel(club.state)]
                .filter(Boolean)
                .join(", ") || "Address available on request"}
            </span>
          </div>
        </div>

        {club.googleMapsUrl && (
          <a
            href={club.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 bg-muted/50 hover:bg-muted transition-colors px-5 md:px-6 py-4 text-sm font-semibold"
            data-testid="club-google-maps-link"
          >
            Open in Google Maps
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Services */}
      {club.services?.length > 0 && (
        <div
          className="rounded-2xl border bg-card p-5 md:p-6"
          data-testid="club-services"
        >
          <h3 className="font-display font-bold text-lg mb-4">
            What We Offer
          </h3>
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
        title="Explore All Our Locations"
        subtitle="Find the location nearest you and get started today."
        primaryLabel="View All Locations"
        onPrimaryClick={onViewLocations}
        secondaryLabel="Contact Us"
        onSecondaryClick={onContactUs}
      />
    </div>
  );
}
