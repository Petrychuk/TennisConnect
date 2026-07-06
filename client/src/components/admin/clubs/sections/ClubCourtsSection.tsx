import type { ClubFormData } from "../ClubForm";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COURT_SURFACES } from "@shared/constants/clubs";
import type { CourtSurface } from "@shared/constants/clubs";
  
  interface ClubCourtsSectionProps {
    form: ClubFormData;
  
    updateField: <
      K extends keyof ClubFormData
    >(
      key: K,
      value: ClubFormData[K]
    ) => void;
  }
  
  export function ClubCourtsSection({
    form,
    updateField,
  }: ClubCourtsSectionProps) {
  
  
// Toggle Court Surface
  
    const toggleSurface = (
      surface: CourtSurface
    ) => {
  
      const exists =
        form.courtSurfaces.includes(surface);
  
      if (exists) {
  
        updateField(
          "courtSurfaces",
          form.courtSurfaces.filter(
            (item) => item !== surface
          )
        );
  
        return;
      }
  
      updateField(
        "courtSurfaces",
        [
          ...form.courtSurfaces,
          surface,
        ]
      );
    }; 

// Derived State

    const hasCourtSurfaces =
      form.courtSurfaces.length > 0;
  
    return (
      <section
        className="space-y-8"
        data-testid="club-courts-section"
      >
  
        {/* ====================================================== */}
        {/* Heading */}
        {/* ====================================================== */}
  
        <div>
  
          <h2
            className="text-2xl font-display font-semibold"
            data-testid="club-courts-heading"
          >
            Court Information
          </h2>
  
          <p
            className="mt-1 text-sm text-muted-foreground"
            data-testid="club-courts-description"
          >
            Configure available court types and
            facilities.
          </p>
  
        </div>
  
        {/* ====================================================== */}
        {/* Court Surfaces */}
        {/* ====================================================== */}
  
        <div className="space-y-5">
  
          <div>
  
            <Label>
              Court Surfaces
            </Label>
  
            <p className="mt-1 text-xs text-muted-foreground">
              Select every surface available.
            </p>
  
          </div>
  
          <div className="grid gap-4 md:grid-cols-2">
  
            {COURT_SURFACES.map(
              (surface) => {
  
                const checked =
                  form.courtSurfaces.includes(
                    surface.value as CourtSurface
                  );
  
                return (
  
                  <div
                    key={surface.value}
                    className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted/40 transition-colors"
                    data-testid={`court-surface-${surface.value}`}
                  >
  
                    <Checkbox
                      id={surface.value}
                      checked={checked}
                      onCheckedChange={() =>
                        toggleSurface(
                          surface.value as CourtSurface
                        )
                      }
                    />
  
                    <Label
                      htmlFor={surface.value}
                      className="cursor-pointer"
                    >
                      {surface.label}
                    </Label>
  
                  </div>
  
                );
              }
            )}
  
          </div>
  
        </div>

              {/* ====================================================== */}
      {/* Court Details */}
      {/* ====================================================== */}

      {hasCourtSurfaces && (

<>

  <div className="grid gap-6 md:grid-cols-2">

    {/* Indoor Courts */}

    <div className="space-y-2">

      <Label htmlFor="indoor-courts">
        Indoor Courts
      </Label>

      <Input
        id="indoor-courts"
        data-testid="indoor-courts"
        type="number"
        min="0"
        placeholder="0"
        value={form.indoorCourts}
        onChange={(e) =>
          updateField(
            "indoorCourts",
            e.target.value
          )
        }
      />

    </div>

    {/* Outdoor Courts */}

    <div className="space-y-2">

      <Label htmlFor="outdoor-courts">
        Outdoor Courts
      </Label>

      <Input
        id="outdoor-courts"
        data-testid="outdoor-courts"
        type="number"
        min="0"
        placeholder="0"
        value={form.outdoorCourts}
        onChange={(e) =>
          updateField(
            "outdoorCourts",
            e.target.value
          )
        }
      />

    </div>

  </div>

  {/* ====================================================== */}
  {/* Lighting */}
  {/* ====================================================== */}

  <div
    className="flex items-center gap-3 rounded-xl border p-4"
    data-testid="lighting-option"
  >

    <Checkbox
      id="has-lighting"
      checked={form.hasLighting}
      onCheckedChange={(checked) =>
        updateField(
          "hasLighting",
          Boolean(checked)
        )
      }
    />

    <Label
      htmlFor="has-lighting"
      className="cursor-pointer"
    >
      Night Lighting Available
    </Label>

  </div>

  {/* ====================================================== */}
  {/* Multiple Locations */}
  {/* ====================================================== */}

  <div
    className="flex items-center gap-3 rounded-xl border p-4"
    data-testid="multiple-locations-option"
  >

    <Checkbox
      id="multiple-locations"
      checked={form.hasMultipleLocations}
      onCheckedChange={(checked) =>
        updateField(
          "hasMultipleLocations",
          Boolean(checked)
        )
      }
    />

    <Label
      htmlFor="multiple-locations"
      className="cursor-pointer"
    >
      This club has multiple locations
    </Label>

  </div>

    {form.hasMultipleLocations && (

        <div className="space-y-2">

        <Label htmlFor="number-of-locations">
            Number of Locations
        </Label>

        <Input
            id="number-of-locations"
            data-testid="number-of-locations"
            type="number"
            min="2"
            placeholder="2"
            value={form.numberOfLocations}
            onChange={(e) =>
            updateField(
                "numberOfLocations",
                e.target.value
            )
            }
        />

        </div>

    )}

          {/* ====================================================== */}
          {/* Court Summary */}
          {/* ====================================================== */}

          <div
            className="rounded-2xl border bg-muted/30 p-6"
            data-testid="court-summary"
          >

            <h3 className="font-semibold">
              Court Summary
            </h3>

            <div className="mt-4 flex flex-wrap gap-2">

              {form.courtSurfaces.map((surface) => {

                const label =
                  COURT_SURFACES.find(
                    (item) =>
                      item.value === surface
                  )?.label;

                return (

                  <span
                    key={surface}
                    className="rounded-full bg-lime-100 px-3 py-1 text-sm font-medium text-lime-700"
                  >
                    {label}
                  </span>

                );

              })}

            </div>

            <div className="mt-6 space-y-2 text-sm text-muted-foreground">

              <p>

                Indoor Courts:
                {" "}
                <strong className="text-foreground">
                  {form.indoorCourts || 0}
                </strong>

              </p>

              <p>

                Outdoor Courts:
                {" "}
                <strong className="text-foreground">
                  {form.outdoorCourts || 0}
                </strong>

              </p>

              <p>

                Lighting:
                {" "}
                <strong className="text-foreground">
                  {form.hasLighting
                    ? "Available"
                    : "Not Available"}
                </strong>

              </p>

              <p>

                Locations:
                {" "}
                <strong className="text-foreground">

                  {form.hasMultipleLocations
                    ? form.numberOfLocations
                    : 1}

                </strong>

              </p>

            </div>

          </div>

        </>

      )}

    </section>

  );

}