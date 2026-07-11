import { Crown, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
interface ClubListingTypeProps {
  value: "free" | "premium";
  onChange: (value: "free" | "premium") => void;
}

export function ClubListingType({
  value,
  onChange,
}: ClubListingTypeProps) {
  return (
    <section
      className="space-y-6"
      data-testid="club-listing-section"
    >
      {/* Heading */}
      <div>
        <h2
          className="text-2xl font-display font-semibold"
          data-testid="club-listing-heading"
        >
          Listing Type
        </h2>

        <p
          className="mt-1 text-muted-foreground"
          data-testid="club-listing-description"
        >
          Choose how this club or community will appear on TennisConnect.
        </p>
      </div>

      {/* Cards */}
      <div
        className="grid gap-6 lg:grid-cols-2"
        data-testid="club-listing-options"
      >
      
      {/* FREE */}
      
        <button
          type="button"
          data-testid="club-listing-free"
          onClick={() => onChange("free")}
          className={cn(
            "relative overflow-hidden rounded-3xl border bg-card p-7 text-left transition-all duration-300",
            "hover:-translate-y-1 hover:shadow-xl",
            value === "free"
              ? "scale-[1.02] border-lime-500 shadow-xl"
              : "border-border hover:border-lime-300"
          )}
        >
          <div className="flex items-center gap-4">
            <div
              data-testid="club-listing-free-icon"
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                value === "free"
                  ? "bg-lime-500 text-white"
                  : "bg-muted"
              )}
            >
              <MapPinned className="h-7 w-7" />
            </div>

            <div>
              <h3
                className="text-xl font-semibold"
                data-testid="club-listing-free-title"
              >
                Free Listing
              </h3>

              <p
                className="text-sm text-muted-foreground"
                data-testid="club-listing-free-description"
              >
                Perfect for a basic directory listing.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t pt-5">
            <ul
              className="space-y-3 text-sm"
              data-testid="club-listing-free-features"
            >
              <li>✓ Displayed in Club Directory</li>
              <li>✓ Contact Information</li>
              <li>✓ Services & Court Types</li>
              <li>✓ Website Button</li>
              <li>✓ Mini Club Card</li>
            </ul>
          </div>
        </button>

      {/* PREMIUM */}

        <button
          type="button"
          data-testid="club-listing-premium"
          onClick={() => onChange("premium")}
          className={cn(
            "relative overflow-hidden rounded-3xl border bg-card p-7 text-left transition-all duration-300",
            "hover:-translate-y-1 hover:shadow-xl",
            value === "premium"
              ? "scale-[1.02] border-lime-500 shadow-xl"
              : "border-border hover:border-lime-300"
          )}
        >
          {/* Badge */}
          <div
            className="absolute right-5 top-5 rounded-full bg-lime-500 px-3 py-1 text-xs font-semibold text-white"
            data-testid="club-listing-premium-badge"
          >
            Recommended
          </div>

          <div className="flex items-center gap-4">
            <div
              data-testid="club-listing-premium-icon"
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                value === "premium"
                  ? "bg-lime-500 text-white"
                  : "bg-muted"
              )}
            >
              <Crown className="h-7 w-7" />
            </div>

            <div>
              <h3
                className="text-xl font-semibold"
                data-testid="club-listing-premium-title"
              >
                Premium Listing
              </h3>

              <p
                className="text-sm text-muted-foreground"
                data-testid="club-listing-premium-description"
              >
                Full profile with maximum visibility.
              </p>
            </div>
          </div>

          <div className="mt-6 border-t pt-5">
            <ul
              className="space-y-3 text-sm"
              data-testid="club-listing-premium-features"
            >
              <li>✓ Everything included in Free</li>
              <li>✓ Dedicated Club Page</li>
              <li>✓ Gallery & Cover Image</li>
              <li>✓ SEO Optimisation</li>
              <li>✓ Competitions & Court Details</li>
              <li>✓ Contact Person</li>
              <li>✓ Premium Presentation</li>
            </ul>
          </div>
        </button>
      </div>
    </section>
  );
}