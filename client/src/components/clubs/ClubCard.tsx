import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  DollarSign,
  Globe,
  MapPin,
  Phone,
  Star,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClubSaveButton } from "./ClubSaveButton";
import { getClubVariant } from "@/lib/clubVariant";

interface ClubCardProps {
  club: any;
  preview?: boolean;
  disableAnimation?: boolean;
}

export function ClubCard({
  club,
  preview = false,
  disableAnimation = false,
}: ClubCardProps) {

const location =
    [club.suburb, club.state]
      .filter(Boolean)
      .join(", ");

const description =
    club.shortDescription ||
    club.description ||
    "";

const hourlyPrice = club.hourlyPrice ?? "Contact Club";
  const isPremium =
    club.listingType === "premium";

  const detailHref =
    club.slug && club.listingType === "premium"
      ? `/clubs/${club.slug}`
      : null;
    
const hasPhone = !!club.phone;
const hasWebsite = !!club.website;
const hasEmail = !!club.email;

const showCallButton =
      isPremium && hasPhone;

const secondaryAction =
      hasWebsite
        ? {
            href: club.website,
            label: "Visit Website",
            icon: Globe,
            external: true,
          }
        : hasEmail
          ? {
              href: `mailto:${club.email}`,
              label: "Send Email",
              icon: Mail,
              external: false,
            }
          : null;

const actionsCount =
          (isPremium && hasPhone ? 1 : 0) +
          (hasWebsite || hasEmail ? 1 : 0);
        
const buttonClass =
          actionsCount === 1
            ? `
              w-full
              xl:w-auto
              xl:min-w-[230px]
            `
            : "flex-1";

  return (

    <motion.div
      initial={
        disableAnimation
          ? false
          : { opacity: 0, y: 20 }
      }
      whileInView={
        disableAnimation
          ? {}
          : { opacity: 1, y: 0 }
      }
      transition={{
        duration: 0.5,
      }}
      viewport={{
        once: true,
      }}
      className="group relative w-full"
      data-testid="club-card"
    >

      <div
        className="
        flex
        flex-col
        xl:flex-row
        rounded-3xl
        border
        bg-card
        overflow-hidden
        shadow-sm
        hover:shadow-xl
        transition-all
        duration-300
        h-auto
        xl:h-[500px]
        "
      >

        {/* Image */}
        <div
          className="
            relative
            w-full
            xl:w-[34%]
            h-52
            md:h-60
            xl:h-auto
            shrink-0
            overflow-hidden
            bg-muted
          "
        >

          <img
            src={club.image}
            alt={club.name}
            loading="lazy"
            data-testid="club-card-image"
            className="
              w-full
              h-full
              object-cover
              object-center
              transition-transform
              duration-700
              group-hover:scale-105
            "
          />

          {detailHref && (
            <Link
              href={detailHref}
              className="absolute inset-0"
              aria-label={`View ${club.name}`}
              data-testid="club-card-image-link"
            />
          )}

          <div
            className="
              absolute
              top-4
              left-4
              flex
              gap-2
            "
          >
            {club.listingType === "premium" && (

              <Badge
                className="
                  bg-primary
                  text-primary-foreground
                  shadow-sm
                "
                data-testid="club-card-premium-badge"
              >
                <Star className="w-3 h-3 mr-1 fill-current" />
                Premium
              </Badge>

            )}

          </div>

          <div className="absolute top-4 right-4">
            <ClubSaveButton clubId={club.id} isCommunity={getClubVariant(club) === "community"} initialSaved={getClubVariant(club) === "community" ? !!club.isFollowing : !!club.isFavoriting} variant="icon" />
          </div>

          <div
            className="
              absolute
              bottom-0
              left-0
              w-full
              h-1/2
              bg-linear-to-t
              to-transparent
              xl:hidden
            "
          />

        </div>
        {/* Content */}
        <div
          className="
            p-3
            md:p-5
            lg:p-6
            flex
            flex-col
            flex-1
          "
          data-testid="club-card-content"
        >
         <div className="mb-6">

        {/* Location */}
        {location && (

        <div
            className="
            flex
            items-center
            gap-2
            text-primary
            font-bold
            mb-2
            text-sm
            uppercase
            tracking-wide
            "
            data-testid="club-card-location"
        >
            <MapPin className="w-4 h-4" />

            {location}

        </div>

        )}

        {/* Name */}
        {detailHref ? (
          <Link href={detailHref} data-testid="club-card-name-link">
            <h2
            className="
                text-lg
                md:text-xl
                lg:text-2xl
                font-display
                font-bold
                leading-tight
                min-h-[32px]
                md:min-h-[44px]
                mb-2
                hover:text-primary
                transition-colors
                cursor-pointer
            "
            data-testid="club-card-name"
            >

            {club.name}

            </h2>
          </Link>
        ) : (
          <h2
          className="
              text-lg
              md:text-xl
              lg:text-2xl
              font-display
              font-bold
              leading-tight
              min-h-[32px]
              md:min-h-[44px]
              mb-2
          "
          data-testid="club-card-name"
          >

          {club.name}

          </h2>
        )}

        {/* Short description — min-height lives on this wrapper, not on
            the clamped <p> itself. -webkit-line-clamp uses a legacy
            flexbox model to count lines, and a min-height on that same
            element throws its line-counting off: it was rendering a
            partial 5th line and then hard-cutting it at the min-height
            boundary instead of cleanly stopping at line 4 with the "…". */}
        <div className="min-h-[100px]">
        <p
        className="
            text-sm
            xl:text-base
            text-muted-foreground
            leading-relaxed
            line-clamp-4
            overflow-hidden
        "
        data-testid="club-card-description"
        >

        {description}

        </p>
        </div>

        {/* Services */}

        <div
        className="
            mt-4
            pt-2
            mb-2
            border-t
            border-border/50
        "
        >

        <p 
            className="
            text-xs
            font-semibold
            uppercase
            tracking-wide
            text-muted-foreground
            mb-2
            "
        >
            Services
        </p>

        <div
            className="
            flex
            flex-wrap
            gap-1.5
            h-[56px]
            overflow-hidden
            "
            data-testid="club-card-services"
        >

            {club.services?.slice(0, 8).map((service: string) => (

            <Badge
                key={service}
                variant="secondary"
                className="
                h-6
                px-2
                text-[11px]
                "
            >
                {service}
            </Badge>

            ))}

        </div>

        </div>

        {/* Stats */}

        <div
        className="
            grid
            grid-cols-2
            gap-3
            xl:gap-6
            mb-4
            md:mb-6
            py-4
            border-y
            border-border/50
        "
        >

       {/* Hourly Price */}
       <div
  className="flex flex-col items-center"
  data-testid="club-card-price-section"
>
  {/* Icon + Price */}
  <div className="flex items-center gap-2">
    <div
      className="
        w-5 h-5
        rounded-full
        bg-primary/10
        text-primary
        flex
        items-center
        justify-center
      "
    >
      <DollarSign className="w-4 h-4" />
    </div>

    <p
      className="font-bold text-lg xl:text-xl leading-none"
      data-testid="club-card-price"
    >
      {hourlyPrice}
    </p>
  </div>

  {/* Notes */}
  <p
    className="
      mt-2
      text-center
      text-xs
      text-muted-foreground
      leading-tight
      line-clamp-2
      max-w-[160px]
    "
    data-testid="club-card-price-note"
  >
    {club.pricingNotes || "Pricing available on request"}
  </p>
</div>

        {/* Competitions */}
        <div
  className="flex items-start gap-2 xl:gap-3"
  data-testid="club-card-competition-section"
>

  <div
    className="
      w-8
      h-8
      xl:w-10
      xl:h-10
      shrink-0
      rounded-full
      bg-primary/10
      text-primary
      flex
      items-center
      justify-center
      mt-0.5
    "
  >
    <Star className="w-4 h-4 xl:w-5 xl:h-5" />
  </div>

  <div className="leading-tight">

    <p
      className="
        font-bold
        text-base
        xl:text-lg
        leading-none
      "
      data-testid="club-card-competitions"
    >
      {club.hostsCompetitions
        ? "Competitions"
        : "Social Tennis"}
    </p>

    <p
      className="
        mt-1
        text-xs
        text-muted-foreground
      "
    >
      {club.hostsCompetitions
        ? "Available"
        : "Community Club"}
    </p>

  </div>

        </div>

        </div>
    
        {/* Actions */}
        <div
        className="flex gap-2 mt-auto items-center justify-end"
        data-testid="club-card-actions"
        >

        {/* Premium only */}

        {isPremium && hasPhone && (

            <Button
            className="
                flex-1
                h-10
                md:h-12
                text-sm
                md:text-base
                font-bold
                rounded-xl
            "
            asChild
            data-testid="club-card-call-btn"
            >

            <a href={`tel:${club.phone}`}>

                <Phone className="w-4 h-4 mr-2" />
                Call to Book
            </a>
            </Button>
        )}

        {/* Website has priority */}
        {secondaryAction && (
            <Button
            variant="outline"
            className={`
                ${buttonClass}
                h-10
                md:h-12
                text-sm
                md:text-base
                font-bold
                rounded-xl
                hover:bg-secondary/50
            `}
            asChild
            data-testid={
                secondaryAction.label === "Visit Website"
                ? "club-card-website-btn"
                : "club-card-email-btn"
            }
            >

            <a
                href={secondaryAction.href}
                {...(secondaryAction.external
                ? {
                    target: "_blank",
                    rel: "noopener noreferrer",
                    }
                : {})}
            >
                <secondaryAction.icon className="w-4 h-4 mr-2" />
                {secondaryAction.label}
            </a>

            </Button>

            )}

          </div>
        </div>
      </div>
     </div>
    </motion.div>
  );
}
