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
  getServiceLabel,
} from "@/lib/clubVariant";
import { ClubFollowButton } from "./ClubFollowButton";

interface QuickFact {
  icon: React.ReactNode;
  value: string;
  label: string;
  iconBg?: string;
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

  // community — descriptive highlights (not services, those already
  // show in the Join Session checklist), each with its own colour so
  // the row reads as distinct highlight chips
  const sessionCount = club.sessions?.length || club.socialTennisDays?.length || 0;

  return [
    {
      icon: <Users className="w-4 h-4 md:w-5 md:h-5" />,
      value: club.membershipRequired ? "Members Only" : "Open to All",
      label: "Community",
      iconBg: "bg-pink-100 text-pink-600",
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />,
      value: "All Levels",
      label: "Welcome",
      iconBg: "bg-lime-100 text-lime-700",
    },
    {
      icon: <HeartHandshake className="w-4 h-4 md:w-5 md:h-5" />,
      value: "Social Play",
      label: "Focus",
      iconBg: "bg-sky-100 text-sky-600",
    },
    {
      icon: <CalendarDays className="w-4 h-4 md:w-5 md:h-5" />,
      value: sessionCount > 0 ? `${sessionCount} Sessions` : "Weekly Sessions",
      label: "Multiple Days",
      iconBg: "bg-orange-100 text-orange-600",
    },
    {
      icon: <HeartHandshake className="w-4 h-4 md:w-5 md:h-5" />,
      value: "Supportive",
      label: "Environment",
      iconBg: "bg-purple-100 text-purple-600",
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

  const defaultCtaLabel =
    variant === "courts"
      ? "Book a Court"
      : variant === "company"
        ? "View All Locations"
        : "Join Session";

  const ctaLabel = club.ctaText || defaultCtaLabel;

  const ctaHandler = club.ctaUrl
    ? () => window.open(club.ctaUrl, "_blank", "noopener,noreferrer")
    : onPrimaryAction;

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
            onClick={ctaHandler}
            data-testid="club-action-primary"
          >
            {ctaLabel}
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
            onClick={ctaHandler}
            data-testid="club-action-primary"
          >
            {ctaLabel}
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
  const nextSession = club.sessions?.[0];
  const firstDay = club.socialTennisDays?.[0];
  const hasSchedule = !!nextSession || !!firstDay;
  const sessionPrice =
    nextSession?.price !== undefined && nextSession?.price !== null
      ? `$${nextSession.price}`
      : price;

  return (
    <div
      className="rounded-2xl border bg-background shadow-xl p-5"
      data-testid="club-action-card-community"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {hasSchedule ? "Next Social Session" : "Join the Community"}
      </p>

      {nextSession ? (
        <p
          className="mt-1 text-xl font-display font-bold"
          data-testid="club-action-next-session"
        >
          {nextSession.name || nextSession.day}
        </p>
      ) : firstDay ? (
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

      {hasSchedule && sessionPrice && (
        <p className="mb-4">
          <span
            className="text-2xl font-display font-bold"
            data-testid="club-action-price"
          >
            {sessionPrice}
          </span>
          <span className="text-sm text-muted-foreground"> per session</span>
        </p>
      )}

      <ul className="space-y-2 mb-5 mt-3 text-sm" data-testid="club-action-checklist">
        {club.services?.length > 0 ? (
          club.services.map((s: string) => (
            <li key={s} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              {getServiceLabel(s)}
            </li>
          ))
        ) : (
          <>
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
          </>
        )}
      </ul>

      <div className="flex flex-col gap-2">
        <Button
          className="w-full rounded-xl font-bold cursor-pointer"
          onClick={ctaHandler}
          data-testid="club-action-primary"
        >
          {ctaLabel}
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

  const VariantBadge = (
    <div
      className="inline-flex items-center gap-2 rounded-full bg-black/55 backdrop-blur-sm px-3 py-1.5 mb-3 w-fit"
      data-testid="club-variant-badge"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide text-primary">
        {CLUB_VARIANT_LABELS[variant]}
      </span>
    </div>
  );

  const NameBlockLight = (
    <div className="max-w-full lg:max-w-[42%]">
      {VariantBadge}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
        <h1
          className="text-white text-xl sm:text-2xl md:text-3xl lg:text-5xl font-display font-bold leading-tight drop-shadow-sm wrap-break-word"
          data-testid="club-detail-name"
        >
          {club.name}
        </h1>

        {club.verified && (
          <Badge
            className="rounded-full border-white/20 bg-white/15 text-white backdrop-blur-sm px-3 py-1 font-semibold flex items-center gap-1.5"
            data-testid="club-verified-badge"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified {variant === "community" ? "Community" : "Club"}
          </Badge>
        )}
      </div>

      {rating && (
        <div
          className="flex items-center gap-1.5 text-sm mb-2 text-white/90"
          data-testid="club-detail-rating"
        >
          <Star className="w-4 h-4 fill-primary text-primary" />
          <span className="font-semibold">{rating.toFixed(1)}</span>
          <span className="text-white/70">reviews</span>
        </div>
      )}

      {location && (
        <div
          className="flex items-center gap-1.5 text-white/80 mb-4"
          data-testid="club-detail-location"
        >
          <MapPin className="w-4 h-4 shrink-0 text-primary" />
          {club.address ? `${club.address}, ` : ""}
          {location}
        </div>
      )}

      {club.shortDescription && (
        <p
          className="text-white/85 leading-relaxed mb-5"
          data-testid="club-detail-short-description"
        >
          {club.shortDescription}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ClubFollowButton
          clubId={club.id}
          initialFollowing={!!club.isFollowing}
          initialFollowersCount={club.followersCount ?? 0}
          light
        />
        {club.phone && (
          <Button
            variant="outline"
            size="icon"
            asChild
            className="rounded-xl shrink-0 cursor-pointer bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
            data-testid="club-hero-call-btn"
          >
            <a href={`tel:${club.phone}`}>
              <Phone className="w-4 h-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );

  const NameBlockCard = (
    <div className="rounded-2xl border bg-background shadow-xl p-5">
      {VariantBadge}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h1
          className="text-xl sm:text-2xl font-display font-bold leading-tight wrap-break-word"
          data-testid="club-detail-name-mobile"
        >
          {club.name}
        </h1>

        {club.verified && (
          <Badge
            className="rounded-full border-primary/20 bg-primary/10 text-primary px-3 py-1 font-semibold flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 fill-primary/20" />
            Verified {variant === "community" ? "Community" : "Club"}
          </Badge>
        )}
      </div>

      {rating && (
        <div className="flex items-center gap-1.5 text-sm mb-2">
          <Star className="w-4 h-4 fill-primary text-primary" />
          <span className="font-semibold">{rating.toFixed(1)}</span>
          <span className="text-muted-foreground">reviews</span>
        </div>
      )}

      {location && (
        <div className="flex items-center gap-1.5 text-muted-foreground mb-4">
          <MapPin className="w-4 h-4 shrink-0 text-primary" />
          {club.address ? `${club.address}, ` : ""}
          {location}
        </div>
      )}

      {club.shortDescription && (
        <p className="text-muted-foreground leading-relaxed mb-5">
          {club.shortDescription}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ClubFollowButton
          clubId={club.id}
          initialFollowing={!!club.isFollowing}
          initialFollowersCount={club.followersCount ?? 0}
        />
        {club.phone && (
          <Button
            variant="outline"
            size="icon"
            asChild
            className="rounded-xl shrink-0 cursor-pointer"
          >
            <a href={`tel:${club.phone}`}>
              <Phone className="w-4 h-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <section data-testid="club-detail-hero">
      {/* Cover, with breadcrumbs + badge overlaid directly on the photo. On
          desktop the name/description block and the action card also live
          on the photo (roughly half width each); on mobile/tablet they
          stack as solid cards below it instead, name first. */}
      <div className="relative">
        <div className="relative h-56 sm:h-64 lg:h-[560px] w-full overflow-hidden bg-muted">
          <img
            src={club.cover || club.image}
            alt={club.name}
            className="w-full h-full object-cover"
            data-testid="club-detail-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/5 to-black/25" />

          <div className="absolute inset-0 container mx-auto px-4 flex flex-col">
            <nav
              className="flex items-center gap-1.5 pt-4 md:pt-6 text-xs md:text-sm text-white/80 overflow-x-auto whitespace-nowrap scrollbar-hide"
              data-testid="club-breadcrumbs"
            >
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <Link
                href="/clubs"
                className="hover:text-white transition-colors"
              >
                Club Communities
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <span className="text-white font-medium truncate">
                {club.name}
              </span>
            </nav>

            {/* Desktop: name block overlaid on the photo, bottom-left */}
            <div className="hidden lg:block mt-auto pb-8">
              {NameBlockLight}
            </div>
          </div>

          {/* Action card floats over the cover on desktop */}
          <div
            className="hidden lg:block absolute right-6 top-6 w-[340px] z-20"
            data-testid="club-action-card-floating"
          >
            <ActionCard
              club={club}
              variant={variant}
              onPrimaryAction={onPrimaryAction}
              onSecondaryAction={onSecondaryAction}
            />
          </div>
        </div>

        <div className="container mx-auto px-4">
          {/* Mobile/tablet: name card first, then the action card below it */}
          <div className="lg:hidden -mt-10 sm:-mt-12 relative z-20 space-y-4 mb-4">
            {NameBlockCard}
            <ActionCard
              club={club}
              variant={variant}
              onPrimaryAction={onPrimaryAction}
              onSecondaryAction={onSecondaryAction}
            />
          </div>

          {/* Quick facts */}
          <div
            className="mt-4 md:mt-6 pb-3 grid grid-cols-3 gap-2 md:gap-3 lg:flex lg:flex-nowrap"
            data-testid="club-quick-facts"
          >
            {quickFacts.map((fact, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-3 md:p-4 lg:flex-1 lg:min-w-0 flex items-center gap-2.5"
                data-testid={`club-quick-fact-${i}`}
              >
                <span
                  className={`flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg ${
                    fact.iconBg ?? "bg-primary/10 text-primary"
                  }`}
                >
                  {fact.icon}
                </span>
                <div className="min-w-0 text-left">
                  <p className="font-bold text-sm md:text-base leading-none truncate">
                    {fact.value}
                  </p>
                  <p className="mt-1 text-[10px] md:text-xs uppercase tracking-wide text-muted-foreground truncate">
                    {fact.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
