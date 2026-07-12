import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface CookieConsentBannerProps {
  onAcceptAll: () => void;
  onRejectOptional: () => void;
  onOpenSettings: () => void;
}

export function CookieConsentBanner({
  onAcceptAll,
  onRejectOptional,
  onOpenSettings,
}: CookieConsentBannerProps) {

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-100 p-3 md:p-4"
      role="region"
      aria-label="Cookie consent"
      data-testid="cookie-consent-banner"
    >
      <div
        className="
          mx-auto
          max-w-5xl
          rounded-2xl
          border
          border-border/60
          bg-background/95
          backdrop-blur-lg
          shadow-2xl
          p-5
          md:p-6
        "
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="flex gap-3 md:gap-4 flex-1">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Cookie className="w-5 h-5" />
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              We use cookies to improve your experience, analyze website traffic, personalize
              content, and support our marketing efforts. You can choose which cookies to allow.
              Read our{" "}
              <Link href="/cookie-policy" className="underline hover:text-primary">
                Cookie Policy
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={onOpenSettings}
              className="cursor-pointer whitespace-nowrap"
              data-testid="cookie-banner-settings-button"
            >
              Cookie Settings
            </Button>

            <Button
              variant="outline"
              onClick={onRejectOptional}
              className="cursor-pointer whitespace-nowrap"
              data-testid="cookie-banner-reject-button"
            >
              Reject Optional
            </Button>

            <Button
              onClick={onAcceptAll}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold cursor-pointer whitespace-nowrap"
              data-testid="cookie-banner-accept-button"
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
