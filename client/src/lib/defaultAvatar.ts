import defaultAvatarImage from "/assets/images/default-avatar.svg";

// One shared placeholder for players/coaches who haven't uploaded a
// photo yet (or whose photo is still awaiting admin approval). Used
// everywhere an avatar can be missing - listing cards, profile hero,
// invite/message dialogs, etc - so a "no photo" account never renders
// as a broken <img src=""> or an empty/transparent box, and looks the
// same wherever it shows up.
export const DEFAULT_AVATAR_URL = defaultAvatarImage;

/**
 * Resolves a possibly-missing avatar URL to something always safe to
 * put directly in an <img src>. Treats "", null and undefined the
 * same way - all of them mean "no photo yet".
 */
export function resolveAvatarUrl(avatar?: string | null): string {
  return avatar && avatar.trim().length > 0 ? avatar : DEFAULT_AVATAR_URL;
}
