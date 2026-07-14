import {
  Phone,
  Mail,
  ArrowUpRight,
  Facebook,
  Instagram,
  MessageCircle,
  User,
  Sparkles,
} from "lucide-react";

interface ClubContactCardProps {
  club: any;
  personLabel?: string;
}

export function ClubContactCard({
  club,
  personLabel = "Contact Person",
}: ClubContactCardProps) {
  const hasLogo = !!club?.logo;
  const hasPhone = !!club?.phone;
  const hasEmail = !!club?.email;
  const hasWebsite = !!club?.website;
  const hasFacebook = !!club?.facebook;
  const hasInstagram = !!club?.instagram;
  const hasSocial = hasFacebook || hasInstagram;
  const hasContactDetails = hasPhone || hasEmail;

  const showPerson =
    club?.displayContactPerson && !!club?.contactPersonName;

  const hasAnything =
    hasLogo || hasContactDetails || hasSocial || hasWebsite || showPerson;

  if (!hasAnything) {
    return (
      <div
        className="rounded-2xl border bg-card p-5"
        data-testid="club-contact-card"
      >
        <h3 className="font-display font-bold text-lg mb-1">Contacts</h3>
        <p
          className="text-sm text-muted-foreground"
          data-testid="club-contact-empty"
        >
          Contact details coming soon.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border bg-card overflow-hidden"
      data-testid="club-contact-card"
    >
      {/* Provider header — logo / socials / name / description / website */}
      {(hasLogo || hasSocial || hasWebsite) && (
        <div className="p-6 text-center border-b border-border/60">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Your Experience Provider
          </p>

          {hasLogo && (
            <img
              src={club.logo}
              alt={club.name}
              className="h-14 w-auto mx-auto object-contain mb-4"
              data-testid="club-provider-logo"
            />
          )}

          {hasSocial && (
            <div className="flex items-center justify-center gap-2.5 mb-4">
              {hasFacebook && (
                <a
                  href={club.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white hover:opacity-90 transition-opacity"
                  data-testid="club-contact-facebook"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {hasInstagram && (
                <a
                  href={club.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white hover:opacity-90 transition-opacity"
                  data-testid="club-contact-instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
            </div>
          )}

          <p
            className="font-display font-bold text-base leading-snug"
            data-testid="club-provider-name"
          >
            {club.name}
          </p>

          {hasWebsite && (
            <a
              href={club.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              data-testid="club-provider-website"
            >
              Visit Website
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Contact */}
      {hasContactDetails && (
        <div className="p-5 border-b border-border/60">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="w-4 h-4" />
            </span>
            <h3 className="font-display font-bold">Contact</h3>
          </div>

          <div className="space-y-2.5 pl-[42px]">
            {hasPhone && (
              <a
                href={`tel:${club.phone}`}
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                data-testid="club-contact-phone"
              >
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {club.phone}
              </a>
            )}

            {hasEmail && (
              <a
                href={`mailto:${club.email}`}
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors break-all"
                data-testid="club-contact-email"
              >
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {club.email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Community lead / contact person */}
      {showPerson && (
        <div className="p-5" data-testid="club-contact-person">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="w-4 h-4" />
            </span>
            <h3 className="font-display font-bold">{personLabel}</h3>
          </div>

          <div className="flex items-center gap-3 pl-[42px]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {club.contactPersonName?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <p
                className="font-semibold text-sm truncate"
                data-testid="club-contact-person-name"
              >
                {club.contactPersonName}
              </p>
              {club.contactPersonRole && (
                <p className="text-xs text-muted-foreground truncate">
                  {club.contactPersonRole}
                </p>
              )}
            </div>
          </div>

          {(club.contactPersonPhone || club.contactPersonEmail) && (
            <div className="mt-2.5 space-y-1.5 pl-[42px]">
              {club.contactPersonPhone && (
                <a
                  href={`tel:${club.contactPersonPhone}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                  data-testid="club-contact-person-phone"
                >
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {club.contactPersonPhone}
                </a>
              )}

              {club.contactPersonEmail && (
                <a
                  href={`mailto:${club.contactPersonEmail}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors break-all"
                  data-testid="club-contact-person-email"
                >
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {club.contactPersonEmail}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
