import { Phone, Mail, Facebook, Instagram, MessageCircle } from "lucide-react";

interface ClubContactCardProps {
  club: any;
  personLabel?: string;
}

export function ClubContactCard({
  club,
  personLabel = "Contact Person",
}: ClubContactCardProps) {
  const hasPhone = !!club?.phone;
  const hasEmail = !!club?.email;
  const hasFacebook = !!club?.facebook;
  const hasInstagram = !!club?.instagram;
  const hasSocial = hasFacebook || hasInstagram;

  const showPerson =
    club?.displayContactPerson && !!club?.contactPersonName;

  return (
    <div className="space-y-4" data-testid="club-contact-card">
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="w-4 h-4" />
          </span>
          <h3 className="font-display font-bold text-lg">Contact</h3>
        </div>

        <div className="px-5 pb-5">
          {!hasPhone && !hasEmail && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="club-contact-empty"
            >
              Contact details coming soon.
            </p>
          )}

          <div className="space-y-3">
            {hasPhone && (
              <a
                href={`tel:${club.phone}`}
                className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                data-testid="club-contact-phone"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Phone className="w-4 h-4" />
                </span>
                {club.phone}
              </a>
            )}

            {hasEmail && (
              <a
                href={`mailto:${club.email}`}
                className="flex items-center gap-3 text-sm hover:text-primary transition-colors break-all"
                data-testid="club-contact-email"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="w-4 h-4" />
                </span>
                {club.email}
              </a>
            )}
          </div>

          {hasSocial && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/60">
              {hasFacebook && (
                <a
                  href={club.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
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
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                  data-testid="club-contact-instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {showPerson && (
        <div
          className="rounded-2xl border bg-card p-5"
          data-testid="club-contact-person"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {personLabel}
          </p>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
              {club.contactPersonName?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <p
                className="font-semibold truncate"
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

          {club.contactPersonPhone && (
            <a
              href={`tel:${club.contactPersonPhone}`}
              className="mt-3 flex items-center gap-2 text-sm hover:text-primary transition-colors"
              data-testid="club-contact-person-phone"
            >
              <Phone className="w-3.5 h-3.5" />
              {club.contactPersonPhone}
            </a>
          )}

          {club.contactPersonEmail && (
            <a
              href={`mailto:${club.contactPersonEmail}`}
              className="mt-1.5 flex items-center gap-2 text-sm hover:text-primary transition-colors break-all"
              data-testid="club-contact-person-email"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {club.contactPersonEmail}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
