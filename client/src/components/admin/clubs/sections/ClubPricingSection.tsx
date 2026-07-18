import type { ClubFormData } from "../ClubForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
interface ClubPricingSectionProps {
  form: ClubFormData;
  updateField: <K extends keyof ClubFormData>(
    key: K,
    value: ClubFormData[K]
  ) => void;
}

export function ClubPricingSection({
  form,
  updateField,
}: ClubPricingSectionProps) {
  return (
    <section
      className="space-y-8"
      data-testid="club-pricing-section"
    >
      {/* Heading */}

      <div>
        <h2
          className="text-2xl font-display font-semibold"
          data-testid="club-pricing-heading"
        >
          Pricing
        </h2>

        <p
          className="mt-1 text-sm text-muted-foreground"
          data-testid="club-pricing-description"
        >
          Configure the price displayed on the club listing.
        </p>
      </div>

      {/* Price */}

      <div className="space-y-2">

        <Label htmlFor="club-hourly-price">
          Price
        </Label>

        <Input
          id="club-hourly-price"
          data-testid="club-hourly-price"
          type="number"
          min="0"
          step="0.01"
          placeholder="42"
          value={form.hourlyPrice}
          onChange={(e) =>
            updateField("hourlyPrice", e.target.value)
          }
        />

        <p className="text-xs text-muted-foreground">
          Enter the price only (for example: 42).
        </p>

      </div>
      {/* Price Description */}

      <div className="space-y-2">

        <Label htmlFor="club-pricing-notes">
          Price Description
        </Label>

        <Textarea
          id="club-pricing-notes"
          data-testid="club-pricing-notes"
          rows={3}
          placeholder="e.g. Court Hire, Social Tennis Session, Casual Entry, Annual Membership..."
          value={form.pricingNotes}
          onChange={(e) =>
            updateField(
              "pricingNotes",
              e.target.value
            )
          }
        />

        <p className="text-xs text-muted-foreground">
          This text appears directly below the price on the club card.
        </p>

      </div>

      {/* Premium CTA */}

      {form.listingType === "premium" && (
        <div
          className="rounded-2xl border p-6 space-y-5"
          data-testid="club-premium-cta-section"
        >
          <div>
            <h3 className="font-semibold">
              Premium Page Call-to-Action
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              Customise the main button on the club's premium page
              (for example "Book a Court" or "Join Community"). Leave
              blank to use the default label for this listing's type.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="club-cta-text">
              Button Label
            </Label>

            <Input
              id="club-cta-text"
              data-testid="club-cta-text"
              placeholder="e.g. Book a Court"
              value={form.ctaText}
              onChange={(e) =>
                updateField("ctaText", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="club-cta-url">
              Button Link
            </Label>

            <Input
              id="club-cta-url"
              data-testid="club-cta-url"
              type="url"
              placeholder="https://your-booking-system.com"
              value={form.ctaUrl}
              onChange={(e) =>
                updateField("ctaUrl", e.target.value)
              }
            />

            <p className="text-xs text-muted-foreground">
              If set, the button opens this link in a new tab. If left
              blank, it scrolls the visitor to the Contact section
              instead.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}