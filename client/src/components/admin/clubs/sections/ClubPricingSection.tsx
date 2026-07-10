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

      {/* Premium Placeholder */}

      {form.listingType === "premium" && (
        <div
          className="rounded-2xl border border-dashed p-6"
          data-testid="club-premium-pricing-placeholder"
        >
          <h3 className="font-semibold">
            Premium Pricing
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            Additional pricing options such as memberships,
            online booking and pricing tables will be available
            for Premium listings.
          </p>
        </div>
      )}
    </section>
  );
}