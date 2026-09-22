import {
  Globe,
  MapPin,
  BadgeCheck,
  CalendarDays,
  UserRound,
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
        <div className="space-y-2.5 md:space-y-5">

          {/* NAME */}
          <div className="space-y-1 md:space-y-2">

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

          {/* COUNTRY + LOCATION */}

          <div className="flex flex-col md:flex-row gap-3 md:gap-6">

            {/* COUNTRY */}

            <div className="flex-1 space-y-1 md:space-y-2">

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

            {/* LOCATION */}

            <div className="w-full md:w-56 space-y-1 md:space-y-2">

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

          {/* AGE + SEX + PLAYING HAND + AVAILABILITY - self-declared,
              all optional, shown in the same edit block as everything
              else in this hero card. */}
          <div className="grid grid-cols-2 md:grid-cols-[0.7fr_0.9fr_1fr_1.5fr] gap-3 md:gap-4">
            <div className="space-y-1 md:space-y-2">
              <p className="text-xs font-medium tracking-wider text-muted-foreground">Age (optional)</p>
              <Input
                type="number"
                min={13}
                max={120}
                value={profile.age || ""}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                className="h-11 w-full border-0 border-b rounded-none px-0 shadow-none text-base focus-visible:ring-0 focus-visible:border-primary"
                data-testid="player-age-input"
              />
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-xs font-medium tracking-wider text-muted-foreground">Sex (optional)</p>
              <select
                value={profile.sex || ""}
                onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                className="h-11 w-full border-0 border-b rounded-none bg-transparent px-0 text-base focus-visible:outline-none focus-visible:border-primary"
                data-testid="player-sex-input"
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-xs font-medium tracking-wider text-muted-foreground">Playing hand</p>
              <select
                value={profile.playingHand || ""}
                onChange={(e) => setProfile({ ...profile, playingHand: e.target.value })}
                className="h-11 w-full border-0 border-b rounded-none bg-transparent px-0 text-base focus-visible:outline-none focus-visible:border-primary"
                data-testid="player-hand-input"
              >
                <option value="">Not set</option>
                <option value="Right">Right</option>
                <option value="Left">Left</option>
              </select>
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-xs font-medium tracking-wider text-muted-foreground">Available to play</p>
              <select
                value={profile.availabilityStatus || ""}
                onChange={(e) => setProfile({ ...profile, availabilityStatus: e.target.value })}
                className="h-11 w-full border-0 border-b rounded-none bg-transparent px-0 text-base focus-visible:outline-none focus-visible:border-primary"
                data-testid="player-availability-status-input"
              >
                <option value="">Not set</option>
                <option value="Available this week">Available this week</option>
                <option value="Available this month">Available this month</option>
                <option value="Not currently available">Not currently available</option>
              </select>
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
              flex-col
              sm:flex-row
              sm:flex-wrap
              sm:items-center

              gap-x-5
              gap-y-1.5

              text-sm
              md:text-base

              text-foreground/70
            "
          >

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <div className="flex items-center gap-1.5"
                  data-testid="player-country-display"
              >
                <Globe className="w-4 h-4 shrink-0" />
                {profile.country}
              </div>

              <div className="flex items-center gap-1.5"
                   data-testid="player-location-display">
                <MapPin className="w-4 h-4 shrink-0" />
                {profile.location}
              </div>
            </div>

            {(profile.age || profile.sex) && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                {profile.age && (
                  <div className="flex items-center gap-1.5" data-testid="player-age-display">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    {profile.age} yrs
                  </div>
                )}

                {profile.sex && (
                  <div className="flex items-center gap-1.5" data-testid="player-sex-display">
                    <UserRound className="w-4 h-4 shrink-0" />
                    {profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)}
                  </div>
                )}
              </div>
            )}

          </div>

        </>
      )}

    </div>
  );
}