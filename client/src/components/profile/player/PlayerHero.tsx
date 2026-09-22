import { ProfileAvatar } from "../shared/ProfileAvatar";
import { ProfileHeroCard } from "../shared/ProfileHeroCard";

import { PlayerInfo } from "./PlayerInfo";
import { PlayerActions } from "./PlayerActions";

import { formatSkillLevelUtr } from "@/lib/skillLevel";

import {
  Star,
  Hand,
  MapPin,
  CalendarCheck,
} from "lucide-react";

interface PlayerHeroProps {
  profile: any;
  tournaments: { result?: string | null }[];

  isEditing: boolean;
  isOwnProfile: boolean;

  setProfile: (profile: any) => void;

  onAvatarEdit: () => void;

  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onMessageClick?: () => void;
}

export function PlayerHero({
  profile,
  tournaments,
  isEditing,
  isOwnProfile,
  setProfile,
  onAvatarEdit,
  onEdit,
  onSave,
  onCancel,
  onMessageClick,
}: PlayerHeroProps) {
  // Redesigned stat row: no individual card boxes at all (the previous
  // StatCard-based version read as 4 floating translucent boxes that
  // didn't match the rest of the page) - just icon+value+label groups,
  // separated by a hairline divider instead. 2x2 on mobile (rows
  // divided), one line on sm+ (columns divided) - same info, no card
  // shell either way.
  const stats = [
    {
      testId: "player-stat-rating",
      icon: <Star className="w-4 h-4" />,
      value: formatSkillLevelUtr(profile.skillLevel),
      label: "Level",
    },
    {
      testId: "player-stat-hand",
      icon: <Hand className="w-4 h-4" />,
      value: profile.playingHand || "—",
      label: "Playing hand",
    },
    {
      testId: "player-stat-distance",
      icon: <MapPin className="w-4 h-4" />,
      value: profile.playRadiusKm ? `${profile.playRadiusKm} km` : "—",
      label: "Preferred distance",
    },
    {
      testId: "player-stat-availability",
      icon: <CalendarCheck className="w-4 h-4" />,
      value: profile.availabilityStatus || "Not set",
      label: "Available to play",
    },
  ];

  return (
    <ProfileHeroCard
      cardBackgroundClassName="bg-card/80 border-0 shadow-none"

      avatar={
        <ProfileAvatar
          
          avatar={profile.avatar}
          name={profile.name}
          isOwner={isOwnProfile}
          onEdit={onAvatarEdit}
        />
      }

      header={
        <PlayerInfo
            profile={profile}
            isEditing={isEditing}
            setProfile={setProfile}
        />
    }

      actions={
        <PlayerActions
          isOwnProfile={isOwnProfile}
          isEditing={isEditing}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
          onMessageClick={onMessageClick}
        />
      }

      stats={
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/30 -mx-1">
          {stats.map((stat) => (
            <div
              key={stat.testId}
              data-testid={stat.testId}
              className="flex items-center gap-2 py-2.5 px-1 sm:px-4 sm:first:pl-1 min-w-0"
            >
              <span className="text-primary shrink-0">{stat.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      }

    />
  );
}