import { ProfileAvatar } from "../shared/ProfileAvatar";
import { ProfileHeroCard } from "../shared/ProfileHeroCard";

import { PlayerInfo } from "./PlayerInfo";
import { PlayerActions } from "./PlayerActions";

import { ProfileStats } from "../shared/ProfileStats";
import { StatCard } from "../shared/StatCard";
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
}

// Statically shared/light card style, matching the redesigned Overview
// cards (border-0, subtle wash) instead of StatCard's own default
// border - overridden here via className only, so coach profiles,
// the organiser dashboard and session-live (StatCard's other callers)
// keep their original look untouched.
const lightCardClass = "border-0 shadow-sm bg-muted/40 hover:bg-muted/60";

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
            data-testid="player-stat-rating"
            icon={<Star className="w-5 h-5" />}
            value={formatSkillLevelUtr(profile.skillLevel)}
            label="Level"
            subtitle={profile.skillLevel || "Not set"}
            className={lightCardClass}
          />

          <StatCard
            data-testid="player-stat-hand"
            icon={<Hand className="w-5 h-5" />}
            value={profile.playingHand || "—"}
            label="Playing hand"
            className={lightCardClass}
          />

          <StatCard
            data-testid="player-stat-distance"
            icon={<MapPin className="w-5 h-5" />}
            value={profile.playRadiusKm ? `${profile.playRadiusKm} km` : "—"}
            label="Preferred distance"
            className={lightCardClass}
          />

          <StatCard
            data-testid="player-stat-availability"
            icon={<CalendarCheck className="w-5 h-5" />}
            value={profile.availabilityStatus || "Not set"}
            label="Available to play"
            className={lightCardClass}
          />

        </ProfileStats>
      }

    />
  );
}