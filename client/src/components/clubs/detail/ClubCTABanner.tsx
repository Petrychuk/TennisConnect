import { Button } from "@/components/ui/button";

interface ClubCTABannerProps {
  title: string;
  subtitle: string;
  primaryLabel: string;
  onPrimaryClick: () => void;
  secondaryLabel?: string;
  onSecondaryClick?: () => void;
}

export function ClubCTABanner({
  title,
  subtitle,
  primaryLabel,
  onPrimaryClick,
  secondaryLabel,
  onSecondaryClick,
}: ClubCTABannerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-neutral-900 p-6 md:p-10 text-white"
      data-testid="club-cta-banner"
    >
      {/* Ball accent */}
      <div
        aria-hidden="true"
        className="absolute -right-10 -bottom-10 w-40 h-40 md:w-56 md:h-56 rounded-full bg-[hsl(var(--tennis-ball))]/90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 45%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -right-10 -bottom-10 w-40 h-40 md:w-56 md:h-56 rounded-full border-2 border-black/10"
      />

      <div className="relative z-10 max-w-lg">
        <h3
          className="text-2xl md:text-3xl font-display font-bold mb-2"
          data-testid="club-cta-title"
        >
          {title}
        </h3>
        <p className="text-white/70 mb-6">{subtitle}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onPrimaryClick}
            className="rounded-xl font-bold cursor-pointer"
            data-testid="club-cta-primary"
          >
            {primaryLabel}
          </Button>

          {secondaryLabel && (
            <Button
              onClick={onSecondaryClick}
              variant="outline"
              className="rounded-xl font-bold bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white cursor-pointer"
              data-testid="club-cta-secondary"
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
