import { ProfileAvatar } from "../shared/ProfileAvatar";
import { ProfileHeroCard } from "../shared/ProfileHeroCard";

import { PlayerInfo } from "./PlayerInfo";
import { PlayerActions } from "./PlayerActions";

import { ProfileStats } from "../shared/ProfileStats";
import { StatCard } from "../shared/StatCard";

import {
  Users,
  Trophy,
  Star,
  Calendar,
} from "lucide-react";

interface PlayerHeroProps {
  profile: any;

  isEditing: boolean;
  isOwnProfile: boolean;

  setProfile: (profile: any) => void;

  onAvatarEdit: () => void;

  onEdit: () => void;
  onSave: () => void;
}

export function PlayerHero({
  profile,
  isEditing,
  isOwnProfile,
  setProfile,
  onAvatarEdit,
  onEdit,
  onSave,
}: PlayerHeroProps) {
  return (
    <ProfileHeroCard

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
        />
      }

      stats={
        <ProfileStats>

          <StatCard
            icon={<Users className="w-5 h-5" />}
            value="12"
            label="Tournaments"
            subtitle="View details"
            clickable
          />

          <StatCard
            icon={<Trophy className="w-5 h-5" />}
            value="8"
            label="Wins"
            subtitle="67% win rate"
          />

          <StatCard
            icon={<Star className="w-5 h-5" />}
            value="3.7"
            label="UTR Rating"
            subtitle="View history"
            clickable
          />

          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            value="6 m"
            label="Member"
            subtitle="December 2025"
          />

        </ProfileStats>
      }

    />
  );
}