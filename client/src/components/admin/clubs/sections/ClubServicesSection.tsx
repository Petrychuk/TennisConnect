import type { ClubFormData } from "../ClubForm";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CLUB_SERVICES } from "@shared/constants/clubs";
import type { ClubService } from "@shared/constants/clubs";
interface ClubServicesSectionProps {
  form: ClubFormData;

  updateField: <K extends keyof ClubFormData>(
    key: K,
    value: ClubFormData[K]
  ) => void;
}

export function ClubServicesSection({
  form,
  updateField,
}: ClubServicesSectionProps) {

  // Toggle Service

  const toggleService = (service: ClubService) => {
    const exists = form.services.includes(service);
  
    if (exists) {
      updateField(
        "services",
        form.services.filter(
          (currentService) => currentService !== service
        )
      );
    } else {
      updateField(
        "services",
        [
          ...form.services,
          service,
        ]
      );
    }
  };

  const groups = Array.from(
    new Set(CLUB_SERVICES.map((service) => service.group))
  );

  return (
    <section
      className="space-y-8"
      data-testid="club-services-section"
    >
  {/* Heading */}
    

      <div>
        <h2
          className="text-2xl font-display font-semibold"
          data-testid="club-services-heading"
        >
          Services
        </h2>

        <p
          className="mt-1 text-sm text-muted-foreground"
          data-testid="club-services-description"
        >
          Select all services available at this club or community.
        </p>
      </div>

  {/* Groups */}

      {groups.map((group) => (
        <div
          key={group}
          className="space-y-5"
        >
          <h3 className="text-lg font-semibold">
            {group}
          </h3>

          <div className="grid gap-4 md:grid-cols-2">

            {CLUB_SERVICES
              .filter((service) => service.group === group)
              .map((service) => {

                const checked =
                  form.services.includes(service.value);

                return (
                  <div
                    key={service.value}
                    className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/40"
                    data-testid={`service-${service.value}`}
                  >
                    <Checkbox
                      id={service.value}
                      checked={checked}
                      onCheckedChange={() =>
                        toggleService(service.value as ClubService)
                      }
                    />

                    <Label
                      htmlFor={service.value}
                      className="cursor-pointer"
                    >
                      {service.label}
                    </Label>
                  </div>
                );
              })}

          </div>
        </div>
      ))}
    </section>
  );
}