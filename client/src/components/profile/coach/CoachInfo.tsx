import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldCheck, MapPin } from "lucide-react";

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
            >
              <ShieldCheck className="w-3.5 h-3.5 fill-primary/20" />
              Verified Coach
            </Badge>

          </div>

          {/* TITLE */}

          <div
            className="
              mt-3

              flex
              flex-wrap
              items-center

              gap-x-2
              gap-y-1

              text-sm
              md:text-base

              text-muted-foreground
            "
            data-testid="coach-title-display"
          >
            <span className="font-medium">
              Tennis Coach
            </span>

            <span className="hidden sm:inline opacity-50">
              •
            </span>

            <span>{profile.title}</span>

          </div>

          {/* LOCATION */}

          <div
            className="
              mt-3

              flex
              items-center
              gap-1.5

              text-muted-foreground
            "
            data-testid="coach-location-display"
          >
            <MapPin className="w-4 h-4 shrink-0" />
            {profile.location}
          </div>

        </>
      )}
    </div>
  );
}