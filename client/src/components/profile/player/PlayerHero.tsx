import { ProfileAvatar } from "../shared/ProfileAvatar";
import { ProfileHeroCard } from "../shared/ProfileHeroCard";

import { PlayerInfo } from "./PlayerInfo";
import { PlayerActions } from "./PlayerActions";

import { ProfileStats } from "../shared/ProfileStats";
import { StatCard } from "../shared/StatCard";
import { getMemberSince, getJoinedMonthLabel } from "@/lib/memberSince";

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
  onCancel: () => void;
}

export function PlayerHero({
  profile,
  isEditing,
  isOwnProfile,
  setProfile,
  onAvatarEdit,
  onEdit,
  onSave,
  onCancel,
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
          onCancel={onCancel}
        />
      }

      stats={
        <ProfileStats>

          <StatCard
            data-testid="player-stat-tournaments"
            icon={<Users className="w-5 h-5" />}
            value="12"
            label="Tournaments"
            subtitle="View details"
            clickable
          />

          <StatCard
            data-testid="player-stat-wins"
            icon={<Trophy className="w-5 h-5" />}
            value="8"
            label="Wins"
            subtitle="67% win rate"
          />

          <StatCard
            data-testid="player-stat-rating"
            icon={<Star className="w-5 h-5" />}
            value="3.7"
            label="UTR Rating"
            subtitle="View history"
            clickable
          />

          <StatCard
            data-testid="player-stat-member"
            icon={<Calendar className="w-5 h-5" />}
            value={getMemberSince(profile.createdAt)}
            label={getJoinedMonthLabel(profile.createdAt)}
          />

        </ProfileStats>
      }

    />
  );
}