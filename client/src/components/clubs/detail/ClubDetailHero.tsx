import { Link } from "wouter";
import {
  ChevronRight,
  Star,
  MapPin,
  ShieldCheck,
  Phone,
  Grid3x3,
  Lightbulb,
  MousePointerClick,
  Users,
  GraduationCap,
  Trophy,
  CheckCircle2,
  CalendarDays,
  HeartHandshake,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClubVariant,
  CLUB_VARIANT_LABELS,
  formatLocation,
  formatHourlyPrice,
  getSurfaceLabel,
} from "@/lib/clubVariant";

interface QuickFact {
  icon: React.ReactNode;
  value: string;
  label: string;
}

interface ClubDetailHeroProps {
  club: any;
  variant: ClubVariant;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

function getQuickFacts(club: any, variant: ClubVariant): QuickFact[] {
  const totalCourts =
    (Number(club.indoorCourts) || 0) + (Number(club.outdoorCourts) || 0);

  if (variant === "courts") {
    return [
      {
        icon: <Grid3x3 className="w-4 h-4 md:w-5 md:h-5" />,
        value: totalCourts > 0 ? `${totalCourts}` : "—",
        label: "Courts",
      },
      {
        icon: <ShieldCheck className="w-4 h-4 md:w-5 md:h-5" />,
        value: club.courtSurfaces?.[0]
          ? getSurfaceLabel(club.courtSurfaces[0])
          : "—",
        label: "Surface",
      },
      {
        icon: <Lightbulb className="w-4 h-4 md:w-5 md:h-5" />,
        value: club.hasLighting ? "Yes" : "No",
        label: "Night Lighting",
      },
      {
        icon: <MousePointerClick className="w-4 h-4 md:w-5 md:h-5" />,
        value: club.courtBookingAvailable ? "Yes" : "No",
        label: "Online Booking",
      },
      {
        icon: <Users className="w-4 h-4 md:w-5 md:h-5" />,
        value: club.publicAccess ? "Yes" : "Members",
        label: "Public Access",
      },
    ];
  }

  if (variant === "company") {
    return [
      {
        icon: <MapPin className="w-4 h-4 md:w-5 md:h-5" />,
        value: `${club.numberOfLocations ?? 1}`,
        label: "Locations",
      },
      {
        icon: <Grid3x3 className="w-4 h-4 md:w-5 md:h-5" />,
        value: totalCourts > 0 ? `${totalCourts}+` : "—",
        label: "Courts",
      },
      {
        icon: <GraduationCap className="w-4 h-4 md:w-5 md:h-5" />,
        value: club.hasCoaching ? "Yes" : "No",
        label: "Coaching",
      },
      {
        icon: <Users className="w-4 h-4 md:w-5 md:h-5" />,
        value: club.hasCommunity ? "Yes" : "No",
        label: "Social Tennis",
      },
      {
        icon: <Trophy className="w-4 h-4 md:w-5 md:h-5" />,
        value: club.hostsCompetitions ? "Yes" : "No",
        label: "Tournaments",
      },
    ];
  }

  // community
  return [
    {
      icon: <Users className="w-4 h-4 md:w-5 md:h-5" />,
      value: club.membershipRequired ? "Members" : "All Levels",
      label: "Welcome",
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />,
      value: "Open",
      label: "All Levels",
    },
    {
      icon: <HeartHandshake className="w-4 h-4 md:w-5 md:h-5" />,
      value: "Friendly",
      label: "Social Play",
    },
    {
      icon: <CalendarDays className="w-4 h-4 md:w-5 md:h-5" />,
      value: club.socialTennisDays?.length
        ? `${club.socialTennisDays.length}`
        : "—",
      label: "Weekly Sessions",
    },
    {
      icon: <HeartHandshake className="w-4 h-4 md:w-5 md:h-5" />,
      value: "Supportive",
      label: "Environment",
    },
  ];
}

function ActionCard({
  club,
  variant,
  onPrimaryAction,
  onSecondaryAction,
}: {
  club: any;
  variant: ClubVariant;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}) {
  const price = formatHourlyPrice(club);

  if (variant === "courts") {
    return (
      <div
        className="rounded-2xl border bg-background shadow-xl p-5"
        data-testid="club-action-card-courts"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Court Hire
        </p>
        {price ? (
          <p className="mt-1 mb-4">
            <span className="text-xs text-muted-foreground">From </span>
            <span
              className="text-3xl font-display font-bold"
              data-testid="club-action-price"
            >
              {price}
            </span>
            <span className="text-sm text-muted-foreground"> per hour</span>
          </p>
        ) : (
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Contact for pricing
          </p>
        )}

        <ul className="space-y-2 mb-5 text-sm">
          {club.courtBookingAvailable && (
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              Online booking
            </li>
          )}
          {club.hasLighting && (
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              Night lighting available
            </li>
          )}
          {club.courtSurfaces?.[0] && (
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              {getSurfaceLabel(club.courtSurfaces[0])} surface
            </li>
          )}
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            {club.publicAccess ? "Public access" : "Members only"}
          </li>
        </ul>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full rounded-xl font-bold cursor-pointer"
            onClick={onPrimaryAction}
            data-testid="club-action-primary"
          >
            Book a Court
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl font-bold cursor-pointer"
              onClick={onSecondaryAction}
              data-testid="club-action-secondary"
            >
              View Prices
            </Button>
            {club.phone && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl shrink-0 cursor-pointer"
                asChild
                data-testid="club-action-call"
              >
                <a href={`tel:${club.phone}`}>
                  <Phone className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "company") {
    return (
      <div
        className="rounded-2xl border bg-background shadow-xl p-5"
        data-testid="club-action-card-company"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Our Network
        </p>
        <p
          className="mt-1 mb-4 text-xl font-display font-bold leading-snug"
          data-testid="club-action-network-summary"
        >
          {club.numberOfLocations ?? 1} Locations
          {club.state ? ` Across ${club.state}` : ""}
        </p>

        <ul className="space-y-2 mb-5 text-sm">
          {club.hasCoaching && (
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              Coaching programs
            </li>
          )}
          {club.hasCommunity && (
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              Social tennis
            </li>
          )}
          {club.hostsCompetitions && (
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              Tournaments & events
            </li>
          )}
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            Member benefits
          </li>
        </ul>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full rounded-xl font-bold cursor-pointer"
            onClick={onPrimaryAction}
            data-testid="club-action-primary"
          >
            View All Locations
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl font-bold cursor-pointer"
            onClick={onSecondaryAction}
            data-testid="club-action-secondary"
          >
            Contact Us
          </Button>
        </div>
      </div>
    );
  }

  // community
  const firstDay = club.socialTennisDays?.[0];

  return (
    <div
      className="rounded-2xl border bg-background shadow-xl p-5"
      data-testid="club-action-card-community"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {firstDay ? "Next Social Session" : "Join the Community"}
      </p>

      {firstDay ? (
        <p
          className="mt-1 text-xl font-display font-bold"
          data-testid="club-action-next-session"
        >
          {firstDay}
        </p>
      ) : (
        <p className="mt-1 mb-1 text-sm text-muted-foreground">
          Contact us for the current schedule
        </p>
      )}

      {price && (
        <p className="mb-4">
          <span
            className="text-2xl font-display font-bold"
            data-testid="club-action-price"
          >
            {price}
          </span>
          <span className="text-sm text-muted-foreground"> per session</span>
        </p>
      )}

      <ul className="space-y-2 mb-5 mt-3 text-sm">
        <li className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          {club.membershipRequired ? "Members welcome" : "All levels welcome"}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          Social & friendly play
        </li>
        {club.hostsCompetitions && (
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            Tournaments & events
          </li>
        )}
      </ul>

      <div className="flex flex-col gap-2">
        <Button
          className="w-full rounded-xl font-bold cursor-pointer"
          onClick={onPrimaryAction}
          data-testid="club-action-primary"
        >
          Join Community
        </Button>
        <Button
          variant="outline"
          className="w-full rounded-xl font-bold cursor-pointer"
          onClick={onSecondaryAction}
          data-testid="club-action-secondary"
        >
          Learn More
        </Button>
      </div>
    </div>
  );
}

export function ClubDetailHero({
  club,
  variant,
  onPrimaryAction,
  onSecondaryAction,
}: ClubDetailHeroProps) {
  const location = formatLocation(club);
  const rating = club.rating ? Number(club.rating) : null;
  const quickFacts = getQuickFacts(club, variant);

  return (
    <section data-testid="club-detail-hero">
      {/* Breadcrumb */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <nav
            className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap scrollbar-hide"
            data-testid="club-breadcrumbs"
          >
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <Link
              href="/clubs"
              className="hover:text-primary transition-colors"
            >
              Club Communities
            </Link>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-foreground font-medium truncate">
              {club.name}
            </span>
          </nav>
        </div>
      </div>

      {/* Cover */}
      <div className="relative">
        <div className="relative h-56 sm:h-72 md:h-80 lg:h-[420px] w-full overflow-hidden bg-muted">
          <img
            src={club.cover || club.image}
            alt={club.name}
            className="w-full h-full object-cover"
            data-testid="club-detail-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/20" />

          <Badge
            className="absolute left-4 top-4 md:left-6 md:top-6 bg-primary text-primary-foreground font-bold uppercase tracking-wide text-[10px] md:text-xs shadow-md"
            data-testid="club-variant-badge"
          >
            {CLUB_VARIANT_LABELS[variant]}
          </Badge>
        </div>

        <div className="container mx-auto px-4">
          <div className="relative -mt-14 sm:-mt-16 md:-mt-20 z-10 grid lg:grid-cols-[1fr_360px] gap-4 lg:gap-6 items-start">
            {/* Info card */}
            <div className="rounded-2xl border bg-background shadow-xl p-5 md:p-8">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                <h1
                  className="text-2xl md:text-4xl font-display font-bold leading-tight"
                  data-testid="club-detail-name"
                >
                  {club.name}
                </h1>

                {club.verified && (
                  <Badge
                    className="rounded-full border-primary/20 bg-primary/10 text-primary px-3 py-1 font-semibold flex items-center gap-1.5"
                    data-testid="club-verified-badge"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 fill-primary/20" />
                    Verified{" "}
                    {variant === "community" ? "Community" : "Club"}
                  </Badge>
                )}
              </div>

              {rating && (
                <div
                  className="flex items-center gap-1.5 text-sm mb-2"
                  data-testid="club-detail-rating"
                >
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  <span className="font-semibold">{rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">reviews</span>
                </div>
              )}

              {location && (
                <div
                  className="flex items-center gap-1.5 text-muted-foreground mb-4"
                  data-testid="club-detail-location"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  {club.address ? `${club.address}, ` : ""}
                  {location}
                </div>
              )}

              {club.shortDescription && (
                <p
                  className="text-muted-foreground leading-relaxed"
                  data-testid="club-detail-short-description"
                >
                  {club.shortDescription}
                </p>
              )}
            </div>

            {/* Action card - floats beside info card on desktop, stacks below on mobile/tablet */}
            <ActionCard
              club={club}
              variant={variant}
              onPrimaryAction={onPrimaryAction}
              onSecondaryAction={onSecondaryAction}
            />
          </div>

          {/* Quick facts */}
          <div
            className="mt-4 md:mt-6 pb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3"
            data-testid="club-quick-facts"
          >
            {quickFacts.map((fact, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-3 md:p-4 text-center"
                data-testid={`club-quick-fact-${i}`}
              >
                <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
                  {fact.icon}
                </div>
                <p className="font-bold text-sm md:text-base leading-none">
                  {fact.value}
                </p>
                <p className="mt-1 text-[10px] md:text-xs uppercase tracking-wide text-muted-foreground">
                  {fact.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
