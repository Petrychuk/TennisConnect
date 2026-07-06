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
  // ===========================================================================
  // Derived State
  // ===========================================================================

  const hasCourtHire =
    form.services.includes("court-hire");

  return (
    <section
      className="space-y-8"
      data-testid="club-pricing-section"
    >
      {/* ====================================================== */}
      {/* Heading */}
      {/* ====================================================== */}

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
          Configure pricing information shown on the club listing.
        </p>

      </div>

      {/* ====================================================== */}
      {/* General Price */}
      {/* ====================================================== */}

      <div className="space-y-2">

        <Label htmlFor="club-price">
          General Price
        </Label>

        <Input
          id="club-price"
          data-testid="club-price"
          placeholder="Free, $15 Social Tennis, $120 Annual Membership..."
          value={form.price}
          onChange={(e) =>
            updateField(
              "price",
              e.target.value
            )
          }
        />

        <p className="text-xs text-muted-foreground">
          Used for memberships, competitions, social tennis,
          academy pricing or any general pricing information.
        </p>

      </div>

      {/* ====================================================== */}
      {/* Court Hire Price */}
      {/* ====================================================== */}

      {hasCourtHire && (

        <div className="space-y-2">

          <Label htmlFor="club-hourly-price">
            Hourly Court Hire Price
          </Label>

          <Input
            id="club-hourly-price"
            data-testid="club-hourly-price"
            type="number"
            min="0"
            step="0.01"
            placeholder="45.00"
            value={form.hourlyPrice}
            onChange={(e) =>
              updateField(
                "hourlyPrice",
                e.target.value
              )
            }
          />

          <p className="text-xs text-muted-foreground">
            Displayed only when Court Hire service is available.
          </p>

        </div>

      )}

      {/* ====================================================== */}
      {/* Pricing Notes */}
      {/* ====================================================== */}

      <div className="space-y-2">

        <Label htmlFor="club-pricing-notes">
          Pricing Notes
        </Label>

        <Textarea
          id="club-pricing-notes"
          data-testid="club-pricing-notes"
          rows={4}
          placeholder="Optional information about memberships, discounts, booking conditions or equipment..."
          value={form.pricingNotes}
          onChange={(e) =>
            updateField(
              "pricingNotes",
              e.target.value
            )
          }
        />

        <p className="text-xs text-muted-foreground">
          Optional. Visible on the premium club page.
        </p>

      </div>

      {/* ====================================================== */}
      {/* Premium Placeholder */}
      {/* ====================================================== */}

      {form.listingType === "premium" && (

        <div
          className="rounded-2xl border border-dashed p-6"
          data-testid="club-premium-pricing-placeholder"
        >

          <h3 className="font-semibold">
            Premium Pricing
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            Additional pricing options such as Membership Required,
            Public Access and Online Booking will be available here.
          </p>

        </div>

      )}

    </section>
  );
}