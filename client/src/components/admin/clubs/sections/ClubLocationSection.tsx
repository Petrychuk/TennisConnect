import type { ClubFormData } from "../ClubForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUSTRALIAN_STATES } from "@shared/constants/clubs";
interface ClubLocationSectionProps {
  form: ClubFormData;

  updateField: <K extends keyof ClubFormData>(
    key: K,
    value: ClubFormData[K]
  ) => void;
}

export function ClubLocationSection({
  form,
  updateField,
}: ClubLocationSectionProps) {
  return (
    <section
      className="space-y-8"
      data-testid="club-location-section"
    >
     
      {/* Heading */}
      <div>
        <h2
          className="text-2xl font-display font-semibold"
          data-testid="club-location-heading"
        >
          Location
        </h2>

        <p
          className="mt-1 text-sm text-muted-foreground"
          data-testid="club-location-description"
        >
          Tell players where this club or community is located.
        </p>
      </div>

      {/* State */}

      <div className="space-y-2">
        <Label htmlFor="club-state">
          State *
        </Label>

        <Select
          value={form.state}
          onValueChange={(value) =>
            updateField("state", value)
          }
        >
          <SelectTrigger
            id="club-state"
            data-testid="club-state"
          >
            <SelectValue placeholder="Select state" />
          </SelectTrigger>

          <SelectContent>
            {AUSTRALIAN_STATES.map((state) => (
              <SelectItem
                key={state.value}
                value={state.value}
              >
                {state.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Suburb */}

      <div className="space-y-2">
        <Label htmlFor="club-suburb">
          Suburb *
        </Label>

        <Input
          id="club-suburb"
          data-testid="club-suburb"
          placeholder="e.g. Wolli Creek"
          value={form.suburb}
          onChange={(e) =>
            updateField("suburb", e.target.value)
          }
        />
      </div>

      {/* Premium Fields */}

      {form.listingType === "premium" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="club-address">
              Street Address
            </Label>
            <Input
              id="club-address"
              data-testid="club-address"
              placeholder="e.g. 2 Prince Edward Street"
              value={form.address}
              onChange={(e) =>
                updateField("address", e.target.value)
              }
            />
            <p className="text-xs text-muted-foreground">
              Optional. Displayed on the premium club page.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-google-maps">
              Google Maps URL
            </Label>
            <Input
              id="club-google-maps"
              data-testid="club-google-maps"
              placeholder="https://maps.google.com/..."
              value={form.googleMapsUrl}
              onChange={(e) =>
                updateField(
                  "googleMapsUrl",
                  e.target.value
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Optional. Used for the "Get Directions" button.
            </p>
          </div>
        </>
      )}
    </section>
  );
}