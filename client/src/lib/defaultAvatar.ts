import defaultAvatarImage from "/assets/images/default-avatar.webp";

// One shared placeholder for players/coaches who haven't uploaded a
// photo yet (or whose photo is still awaiting admin approval). Used
// everywhere an avatar can be missing - listing cards, profile hero,
// invite/message dialogs, etc - so a "no photo" account never renders
// as a broken <img src=""> or an empty/transparent box, and looks the
// same wherever it shows up. Cropped from the TennisConnect logo mark
// itself (silhouette + ball, wordmark trimmed off) rather than a
// redrawn approximation, so it matches the brand asset exactly.
export const DEFAULT_AVATAR_URL = defaultAvatarImage;

// Accessible alt text for the placeholder. Deliberately not the
// person's name: this image isn't a photo of them, and a screen
// reader announcing "photo of Jane Smith" over a generic silhouette
// would be actively misleading.
export const DEFAULT_AVATAR_ALT = "Default profile photo";

/**
 * Resolves a possibly-missing avatar URL to something always safe to
 * put directly in an <img src>. Treats "", null and undefined the
 * same way - all of them mean "no photo yet".
 */
export function resolveAvatarUrl(avatar?: string | null): string {
  return avatar && avatar.trim().length > 0 ? avatar : DEFAULT_AVATAR_URL;
}

/**
 * Picks the right alt text for an avatar <img>: the person's name
 * when there's a real photo, or the generic placeholder label when
 * falling back to the default image.
 */
export function resolveAvatarAlt(
  avatar: string | null | undefined,
  name: string
): string {
  return avatar && avatar.trim().length > 0 ? name : DEFAULT_AVATAR_ALT;
}
