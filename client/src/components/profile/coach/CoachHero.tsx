import { ProfileAvatar } from "../shared/ProfileAvatar";
import { ProfileHeroCard } from "../shared/ProfileHeroCard";

import { CoachInfo } from "./CoachInfo";
import { CoachActions } from "./CoachActions";
import { CoachStats } from "./CoachStats";

interface CoachHeroProps {
  profile: any;

  isEditing: boolean;
  isOwnProfile: boolean;
  isAuthenticated: boolean;

  setProfile: (profile: any) => void;

  onAvatarEdit: () => void;

  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onContact: () => void;
}

export function CoachHero({
  profile,
  isEditing,
  isOwnProfile,
  isAuthenticated,
  setProfile,
  onAvatarEdit,
  onEdit,
  onSave,
  onCancel,
  onContact,
}: CoachHeroProps) {
  return (
    <ProfileHeroCard
      cardBackgroundClassName="bg-background/40"
      avatar={
        <ProfileAvatar
          avatar={profile.avatar}
          name={profile.name}
          isOwner={isOwnProfile}
          onEdit={onAvatarEdit}
        />
      }

      header={
        <CoachInfo
          profile={profile}
          isEditing={isEditing}
          setProfile={setProfile}
        />
      }

      actions={
        <CoachActions
          isOwner={isOwnProfile}
          isEditing={isEditing}
          isAuthenticated={isAuthenticated}
          onEdit={onEdit}
          onSave={onSave}
          onCancel={onCancel}
          onContact={onContact}
        />
      }

      stats={
        <CoachStats profile={profile} />
      }
    />
  );
}