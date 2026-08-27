import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldCheck, MapPin, Globe } from "lucide-react";

interface CoachInfoProps {
  profile: any;
  isEditing: boolean;
  setProfile: (profile: any) => void;
}

export function CoachInfo({
  profile,
  isEditing,
  setProfile,
}: CoachInfoProps) {
  return (
    <div className="flex-1 min-w-0">

      {isEditing ? (
        <div className="space-y-5">

          {/* NAME */}
          <div className="space-y-2">

            <div className="flex flex-wrap items-center gap-3">

              <p className="text-xs font-medium tracking-wider">
                Name
              </p>
            </div>

            <Input
              value={profile.name}
              placeholder="Coach Name"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  name: e.target.value,
                })
              }
              className="
              h-12
              md:h-13
              w-full
              md:max-w-[500px]
              text-1xl
              md:text-2xl
              text-base
              font-display
              px-0
              border-0
              border-b
              rounded-none
              shadow-none
              focus-visible:ring-0
              focus-visible:border-primary
              "
              data-testid="coach-name"
            />

          </div>

          <div className="flex flex-col md:flex-row gap-6">

          {/* TITLE */}
          <div className="flex-1 space-y-2">

            <p className="text-xs font-medium tracking-wider text-muted-foreground">
              Professional Title
            </p>

            <Input
              value={profile.title}
              placeholder="Professional Title"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  title: e.target.value,
                })
              }
              className="
                h-11
                w-full
                border-0
                border-b
                rounded-none
                px-0
                shadow-none
                text-base
                focus-visible:ring-0
                focus-visible:border-primary
              "
              data-testid="coach-title"
            />

          </div>

          {/* LOCATION */}
          <div className="md:w-56 space-y-2">

            <p className="text-xs font-medium tracking-wider text-muted-foreground">
              Location
            </p>

            <Input
              value={profile.location}
              placeholder="Location"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  location: e.target.value,
                })
              }
              className="
                h-11
                w-full

                border-0
                border-b
                rounded-none

                px-0
                shadow-none

                text-base

                focus-visible:ring-0
                focus-visible:border-primary"
                data-testid="coach-location"
            />

          </div>

          {/* COUNTRY */}
          <div className="md:w-48 space-y-2">

            <p className="text-xs font-medium tracking-wider text-muted-foreground">
              Country
            </p>

            <Input
              value={profile.country ?? ""}
              placeholder="Country"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  country: e.target.value,
                })
              }
              className="
                h-11
                w-full

                border-0
                border-b
                rounded-none

                px-0
                shadow-none

                text-base

                focus-visible:ring-0
                focus-visible:border-primary"
                data-testid="coach-country"
            />

          </div>
          </div>

          {/* CERTIFICATION - self-declared, not verified against any
              accrediting body (e.g. Tennis Australia/NCAS) - see the
              read-only badge below, which used to say "Verified Coach"
              unconditionally regardless of this. */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={!!profile.isCertified}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    isCertified: e.target.checked,
                  })
                }
                className="accent-primary"
                data-testid="coach-is-certified"
              />
              Certified / Accredited Coach
            </label>
            {profile.isCertified && (
              <Input
                value={profile.certificationDetails ?? ""}
                placeholder="e.g. Tennis Australia Level 1"
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    certificationDetails: e.target.value,
                  })
                }
                className="
                  h-10
                  max-w-sm
                  border-0
                  border-b
                  rounded-none
                  px-0
                  shadow-none
                  text-sm
                  focus-visible:ring-0
                  focus-visible:border-primary
                "
                data-testid="coach-certification-details"
              />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* NAME */}

          <div className="flex flex-wrap items-center gap-3">

            <h1
              className="
                font-display
                font-semibold
                text-3xl
                md:text-[38px]
                lg:text-[42px]
                leading-none
              "
              data-testid="coach-name-display"
            >
              {profile.name}
            </h1>

            {profile.isCertified && (
              <Badge
                className="
                  rounded-full

                  border-primary/20
                  bg-primary/10
                  text-primary

                  px-3
                  py-1

                  font-semibold

                  flex
                  items-center
                  gap-1.5
                "
                title={profile.certificationDetails || undefined}
                data-testid="coach-certified-badge"
              >
                <ShieldCheck className="w-3.5 h-3.5 fill-primary/20" />
                {/* Icon-only on mobile, icon+text from sm: up - was
                    briefly moved onto the avatar entirely, moved back
                    here per explicit feedback after seeing that on a
                    real page. */}
                <span className="hidden sm:inline">Certified Coach</span>
              </Badge>
            )}

          </div>

          {/* TITLE */}

          <div
            className="
              mt-3

              text-sm
              md:text-base

              text-muted-foreground
            "
            data-testid="coach-title-display"
          >
            {profile.title}
          </div>

          {/* LOCATION + COUNTRY */}

          <div
            className="
              mt-3

              flex
              flex-wrap
              items-center
              gap-x-4
              gap-y-1

              text-muted-foreground
            "
          >
            <div className="flex items-center gap-1.5" data-testid="coach-location-display">
              <MapPin className="w-4 h-4 shrink-0" />
              {profile.location}
            </div>

            {profile.country && (
              <div className="flex items-center gap-1.5" data-testid="coach-country-display">
                <Globe className="w-4 h-4 shrink-0" />
                {profile.country}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}