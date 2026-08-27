import { ShieldCheck } from "lucide-react";
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
      avatar={
        <ProfileAvatar
          avatar={profile.avatar}
          name={profile.name}
          isOwner={isOwnProfile}
          onEdit={onAvatarEdit}
          fallbackVariant="solid"
          badge={
            profile.isCertified ? (
              <span title={profile.certificationDetails || "Certified Coach"} data-testid="coach-certified-badge" className="inline-flex">
                <ShieldCheck className="w-5 h-5 lg:w-8 lg:h-8" />
              </span>
            ) : undefined
          }
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