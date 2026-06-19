import { Globe, ExternalLink } from "lucide-react";

interface TravelProviderCardProps {
  providerName?: string;
  providerLogo?: string;
  providerWebsite?: string;
}

export function TravelProviderCard({
  providerName,
  providerLogo,
  providerWebsite,
}: TravelProviderCardProps) {
  if (!providerName) return null;

  return (
    <div
      className="
        bg-white
        rounded-3xl
        border
        border-border
        shadow-sm
        p-6
        text-center
      "
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-5">
        Your Experience Provider
      </p>

      {providerLogo ? (
        <div className="flex justify-center mb-4">
          <img
            src={providerLogo}
            alt={providerName}
            className="h-24 w-auto object-contain"
          />
        </div>
      ) : (
        <div
          className="
            w-20
            h-20
            rounded-full
            bg-primary/10
            flex
            items-center
            justify-center
            mx-auto
            mb-4
          "
        >
          <Globe className="h-8 w-8 text-primary" />
        </div>
      )}

      <h3 className="font-display text-lg font-bold mb-2">
        {providerName}
      </h3>

      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        Premium tennis experiences across Australia and beyond.
      </p>

      {providerWebsite && (
        <a
          href={providerWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="
            inline-flex
            items-center
            gap-2
            text-primary
            font-medium
            hover:underline
          "
        >
          Visit Website
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}