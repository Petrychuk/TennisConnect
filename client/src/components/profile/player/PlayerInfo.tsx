import {
  Calendar,
  Globe,
  MapPin,
  BadgeCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface PlayerInfoProps {
  profile: any;
  isEditing: boolean;
  setProfile: (profile: any) => void;
}

export function PlayerInfo({
  profile,
  isEditing,
  setProfile,
}: PlayerInfoProps) {
  return (
    <div className="flex-1 min-w-0">

      {isEditing ? (
        <div className="space-y-5">

          {/* NAME */}
          <div className="space-y-2">

            <p className="text-xs font-medium tracking-wider">
              Name
            </p>

            <Input
              value={profile.name}
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

                text-xl
                md:text-2xl

                font-display
                font-semibold

                px-0

                border-0
                border-b
                rounded-none
                shadow-none

                focus-visible:ring-0
                focus-visible:border-primary
              "
              data-testid="player-name"
            />

          </div>

          {/* COUNTRY + AGE + LOCATION */}

          <div className="flex flex-col md:flex-row gap-6">

            {/* COUNTRY */}

            <div className="flex-1 space-y-2">

              <p className="text-xs font-medium tracking-wider text-muted-foreground">
                Country
              </p>

              <Input
                value={profile.country}
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
                  focus-visible:border-primary
                "
                data-testid="player-country"
              />

            </div>

            {/* AGE */}

            <div className="w-full md:w-28 space-y-2">

              <p className="text-xs font-medium tracking-wider text-muted-foreground">
                Age
              </p>

              <Input
                value={profile.age}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    age: e.target.value,
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
                data-testid="player-age"
              />

            </div>

            {/* LOCATION */}

            <div className="w-full md:w-56 space-y-2">

              <p className="text-xs font-medium tracking-wider text-muted-foreground">
                Location
              </p>

              <Input
                value={profile.location}
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
                  focus-visible:border-primary
                "
                data-testid="player-location"
              />

            </div>

          </div>

        </div>
      ) : (
        <>
          {/* NAME */}

          <h1
            className="
              flex
              flex-wrap
              items-center
              gap-2

              font-display
              font-semibold

              text-3xl
              md:text-[38px]
              lg:text-[42px]

              leading-none
            "
            data-testid="player-name-display"
          >
            {profile.name}

            <BadgeCheck
              className="
                w-7
                h-7

                text-white
                fill-primary

                shrink-0
              "
            />
          </h1>

          {/* INFO */}

          <div
            className="
              mt-3

              flex
              flex-wrap
              items-center

              gap-x-5
              gap-y-2

              text-sm
              md:text-base

              text-muted-foreground
            "
          >

            <div className="flex items-center gap-1.5"
                data-testid="player-country-display"
            >
              <Globe className="w-4 h-4 shrink-0" />
              {profile.country}
            </div>

            <div className="flex items-center gap-1.5"
                 data-testid="player-age-display">
              <Calendar className="w-4 h-4 shrink-0" />
              {profile.age} years old
            </div>

            <div className="flex items-center gap-1.5"
                 data-testid="player-location-display">
              <MapPin className="w-4 h-4 shrink-0" />
              {profile.location}
            </div>

          </div>

        </>
      )}

    </div>
  );
}