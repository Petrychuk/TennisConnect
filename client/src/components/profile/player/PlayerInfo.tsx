import { Calendar, Globe, MapPin, BadgeCheck } from "lucide-react";
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
        <div className="space-y-4">

          <Input
            value={profile.name}
            onChange={(e) =>
              setProfile({
                ...profile,
                name: e.target.value,
              })
            }
            className="text-1xl lg:text-2xl font-display font-bold h-14"
            data-testid="player-name"
          />

          <div className="flex flex-col sm:flex-row gap-3">

            <Input
              value={profile.country}
              placeholder="Country"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  country: e.target.value,
                })
              }
              data-testid="player-country"
            />

            <Input
              value={profile.age}
              placeholder="Age"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  age: e.target.value,
                })
              }
              className="sm:w-28"
              data-testid="player-age"
            />

            <Input
              value={profile.location}
              placeholder="Location"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  location: e.target.value,
                })
              }
            />

          </div>

        </div>
      ) : (
        <>

          <h1
            className="
              flex
              items-center
              gap-2
              font-display
              font-semibold
              text-muted-foreground
              text-3xl
              md:text-[38px]
              lg:text-[42px]
              leading-none
            "
          >
            {profile.name}

            <BadgeCheck
              className="
                w-8
                h-8
                text-white
                fill-primary
                shrink-0
              "
            />
          </h1>

          <div className="
              mt-3
              flex
              flex-wrap
              items-center
              gap-x-5
              gap-y-2
              text-muted-foreground
            "
          >
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              {profile.country}
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {profile.age} years old
            </div>

            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {profile.location}
            </div>
          </div>
        </>
      )}
    </div>
  );
}