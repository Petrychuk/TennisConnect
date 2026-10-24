// User-row cascade - the statements that remove user accounts and
// everything that belongs only to them. Shared by
// storage.deleteUserAccounts() (account deletion, admin delete / bulk
// delete) and the Stage 3 E2E run cleanup (server/services/e2eRunCleanup.ts),
// so test cleanup deletes exactly what a real account deletion deletes.
//
// Moved unchanged from storage.deleteUserAccounts(), plus one fix:
// external_activities.reviewed_by is now detached (it was the only
// optional reference to users that was not, so deleting an admin who had
// reviewed a discovery activity failed on a foreign key).
//
// Callers must first deal with what the user OWNS through an organisation
// (organisations, and the sessions/seasons/series/templates/update posts
// created in them) - storage.deleteUserAccounts() blocks owners of
// organisations with sessions and cascades empty ones; the E2E cleanup
// cascades the run's own organisations. Anything still referencing these
// users after that makes the final DELETE fail and the caller's
// transaction roll back: fail closed, nothing half-deleted.
//
// USER_CASCADE_COVERAGE lists every foreign key into users; the unit test
// (server/lib/organizationCascade.test.ts) fails when the schema gains one
// that is not listed.

import { inArray, or } from "drizzle-orm";
import {
  clubFavorites,
  clubFollows,
  coachProfiles,
  communityMemberships,
  emailVerificationTokens,
  externalActivities,
  marketplaceItems,
  matches,
  messages,
  organizationMembers,
  organizerRequests,
  passwordResetTokens,
  payments,
  playerProfiles,
  registrations,
  tennisSessions,
  tournamentHistory,
  users,
} from "@shared/schema";
import type { CascadeExecutor } from "./organizationCascade";

export const USER_CASCADE_COVERAGE: Readonly<Record<string, "delete" | "set-null" | "owner-handled-first">> = {
  "messages.sender_user_id": "delete", // and messages.recipient_id (no FK)
  "tournament_history.user_id": "delete",
  "marketplace_items.user_id": "delete",
  "player_profiles.user_id": "delete",
  "coach_profiles.user_id": "delete",
  "organizer_requests.user_id": "delete",
  "organizer_requests.reviewed_by": "set-null",
  "organization_members.user_id": "delete",
  "registrations.user_id": "delete",
  "club_follows.user_id": "delete",
  "club_favorites.user_id": "delete",
  "community_memberships.user_id": "delete",
  "matches.reported_by": "set-null",
  "matches.confirmed_by": "set-null",
  "sessions.reviewed_by": "set-null",
  "external_activities.reviewed_by": "set-null",
  "payments.user_id": "set-null",
  "password_reset_tokens.user_id": "delete",
  "email_verification_tokens.user_id": "delete",
  // Owned through an organisation: the caller removes (organisation
  // cascade) or refuses (sessions) these BEFORE deleting the users.
  "organizations.owner_id": "owner-handled-first",
  "sessions.created_by": "owner-handled-first",
  "seasons.created_by": "owner-handled-first",
  "series.created_by": "owner-handled-first",
  "session_templates.created_by": "owner-handled-first",
  "session_updates.organizer_id": "owner-handled-first",
};

export async function deleteUserRows(qb: CascadeExecutor, userIds: readonly string[]): Promise<number> {
  const allowedIds = Array.from(new Set(userIds));
  if (allowedIds.length === 0) return 0;

  await qb
    .delete(messages)
    .where(or(inArray(messages.senderUserId, allowedIds), inArray(messages.recipientId, allowedIds)));

  await qb.delete(tournamentHistory).where(inArray(tournamentHistory.userId, allowedIds));
  await qb.delete(marketplaceItems).where(inArray(marketplaceItems.userId, allowedIds));
  await qb.delete(playerProfiles).where(inArray(playerProfiles.userId, allowedIds));
  await qb.delete(coachProfiles).where(inArray(coachProfiles.userId, allowedIds));

  await qb.delete(organizerRequests).where(inArray(organizerRequests.userId, allowedIds));
  await qb
    .update(organizerRequests)
    .set({ reviewedBy: null })
    .where(inArray(organizerRequests.reviewedBy, allowedIds));

  await qb.delete(organizationMembers).where(inArray(organizationMembers.userId, allowedIds));
  await qb.delete(registrations).where(inArray(registrations.userId, allowedIds));
  await qb.delete(clubFollows).where(inArray(clubFollows.userId, allowedIds));
  await qb.delete(clubFavorites).where(inArray(clubFavorites.userId, allowedIds));
  await qb.delete(communityMemberships).where(inArray(communityMemberships.userId, allowedIds));

  await qb.update(matches).set({ reportedBy: null }).where(inArray(matches.reportedBy, allowedIds));
  await qb.update(matches).set({ confirmedBy: null }).where(inArray(matches.confirmedBy, allowedIds));

  await qb
    .update(tennisSessions)
    .set({ reviewedBy: null })
    .where(inArray(tennisSessions.reviewedBy, allowedIds));

  await qb
    .update(externalActivities)
    .set({ reviewedBy: null })
    .where(inArray(externalActivities.reviewedBy, allowedIds));

  await qb.update(payments).set({ userId: null }).where(inArray(payments.userId, allowedIds));

  await qb.delete(passwordResetTokens).where(inArray(passwordResetTokens.userId, allowedIds));
  await qb.delete(emailVerificationTokens).where(inArray(emailVerificationTokens.userId, allowedIds));

  const deleted = await qb.delete(users).where(inArray(users.id, allowedIds)).returning({ id: users.id });
  return deleted.length;
}
