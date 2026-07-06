import type { ClubFormData } from "../ClubForm";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { HOSTED_COMPETITION_TYPES } from "@shared/constants/clubs";
import type { CompetitionType } from "@shared/constants/clubs";

interface ClubCompetitionSectionProps {
  form: ClubFormData;

  updateField: <
    K extends keyof ClubFormData
  >(
    key: K,
    value: ClubFormData[K]
  ) => void;
}

export function ClubCompetitionSection({
  form,
  updateField,
}: ClubCompetitionSectionProps) {

  const isPremium =
    form.listingType === "premium";

  // Toggle Competition
  
  const toggleCompetition = (
    competition: CompetitionType
  ) => {

    const exists =
      form.hostedCompetitions.includes(
        competition
      );

    if (exists) {

      updateField(
        "hostedCompetitions",
        form.hostedCompetitions.filter(
          (item) =>
            item !== competition
        )
      );

    } else {

      updateField(
        "hostedCompetitions",
        [
          ...form.hostedCompetitions,
          competition,
        ]
      );

    }

  };

  return (

    <section
      className="space-y-8"
      data-testid="club-competition-section"
    >
  
      {/* Heading */}
    
      <div>

        <h2
          className="text-2xl font-display font-semibold"
          data-testid="club-competition-heading"
        >
          Competitions
        </h2>

        <p
          className="mt-1 text-sm text-muted-foreground"
        >
          Tell players what competitions and organised
          tennis activities are available at this club.
        </p>

      </div>

      {/* Hosts Competitions */}
     
      <div
        className="rounded-2xl border p-5"
        data-testid="hosts-competitions-card"
      >

        <div className="flex items-center gap-3">

          <Checkbox
            id="hosts-competitions"
            checked={form.hostsCompetitions}
            onCheckedChange={(checked) =>
              updateField(
                "hostsCompetitions",
                Boolean(checked)
              )
            }
          />

          <Label
            htmlFor="hosts-competitions"
            className="cursor-pointer"
          >
            This club hosts organised competitions
          </Label>

        </div>

        <p className="mt-3 text-sm text-muted-foreground">

          Examples include social tennis, club
          championships, UTR events, leagues and
          tournaments.

        </p>

      </div>
    
      {/* Competition Types */}

      {form.hostsCompetitions && (

    <div
    className="space-y-6"
    data-testid="competition-types"
    >

    <div>

        <h3 className="text-lg font-semibold">
        Competition Types
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">

        Select all competitions available at this club.

        </p>

    </div>

    <div className="grid gap-4 md:grid-cols-2">

        {HOSTED_COMPETITION_TYPES.map((competition) => {

        const checked =
            form.hostedCompetitions.includes(
            competition.value
            );

        return (

            <div
            key={competition.value}
            className="
                flex
                items-center
                gap-3
                rounded-xl
                border
                p-4
                transition-colors
                hover:bg-muted/40
            "
            data-testid={`competition-${competition.value}`}
            >

            <Checkbox
                id={`competition-${competition}`}
                checked={checked}
                onCheckedChange={() =>
                toggleCompetition(
                    competition.value
                )
                }
            />

            <Label
                htmlFor={`competition-${competition}`}
                className="cursor-pointer"
            >
                {competition.label}
            </Label>

            </div>

        );

        })}

    </div>

    {/* Premium Notice */}

    {!isPremium && (

        <div
        className="
            rounded-xl
            border
            border-dashed
            bg-muted/30
            p-4
        "
        data-testid="competition-free-note"
        >

        <p className="text-sm text-muted-foreground">

            Competition information will appear
            on the directory listing. A dedicated
            Competitions section is available on
            Premium club pages.

        </p>

        </div>

    )}

    </div>

    )}
        
        {/* Competition Summary  */}
        
        {form.hostsCompetitions && (

    <div
    className="rounded-2xl border bg-muted/30 p-6"
    data-testid="competition-summary"
    >

    <h3 className="font-semibold">
        Competition Summary
    </h3>

    {form.hostedCompetitions.length > 0 ? (

        <div className="mt-4 flex flex-wrap gap-2">

        {form.hostedCompetitions.map((competition) => {

            const label =
            HOSTED_COMPETITION_TYPES.find(
                (item) =>
                item.value === competition
            )?.label ?? competition;

            return (

            <span
                key={competition}
                className="
                rounded-full
                bg-lime-100
                px-3
                py-1
                text-sm
                font-medium
                text-lime-700
                "
            >
                {label}
            </span>

            );

        })}

        </div>

    ) : (

        <p className="mt-4 text-sm text-muted-foreground">
        No competition types selected.
        </p>

    )}

    </div>

    )}

</section>

);

}