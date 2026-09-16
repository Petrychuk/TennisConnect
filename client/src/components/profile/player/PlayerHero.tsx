import { ProfileAvatar } from "../shared/ProfileAvatar";
import { ProfileHeroCard } from "../shared/ProfileHeroCard";

import { PlayerInfo } from "./PlayerInfo";
import { PlayerActions } from "./PlayerActions";

import { ProfileStats } from "../shared/ProfileStats";
import { StatCard } from "../shared/StatCard";
import { getMemberSince, getJoinedMonthLabel } from "@/lib/memberSince";
import { formatSkillLevelUtr } from "@/lib/skillLevel";

import {
  Users,
  Trophy,
  Star,
  Calendar,
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
}: PlayerHeroProps) {
  const tournamentsCount = tournaments.length;
  const wins = tournaments.filter((t) => t.result === "Winner").length;
  const winRateLabel = tournamentsCount > 0 ? `${Math.round((wins / tournamentsCount) * 100)}% win rate` : "No tournaments yet";

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
            value={String(tournamentsCount)}
            label="Tournaments"
            subtitle="View details"
            clickable
          />

          <StatCard
            data-testid="player-stat-wins"
            icon={<Trophy className="w-5 h-5" />}
            value={String(wins)}
            label="Wins"
            subtitle={winRateLabel}
          />

          <StatCard
            data-testid="player-stat-rating"
            icon={<Star className="w-5 h-5" />}
            value={formatSkillLevelUtr(profile.skillLevel)}
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