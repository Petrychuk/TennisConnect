// Real SeedStore (server/seeds/e2e/seeder.ts) backed by Drizzle.
//
// Every write is keyed by a natural key (email, slug, org+title, ...) and is
// only reached after planSeed() found no conflicts. Updates additionally
// re-check ownership in the WHERE clause (isTestUser / fixture marker), so
// even a race with a real signup cannot overwrite a non-test record.
//
// Written directly to the tables - never through registration, messaging
// or payment flows - so no email is sent and Stripe is never called.

import { and, eq } from "drizzle-orm";
import {
  clubFollows,
  clubs,
  coachProfiles,
  communityMemberships,
  matches,
  messages,
  organizationMembers,
  organizations,
  playerProfiles,
  registrations,
  seasons,
  series,
  sessionRounds,
  tennisSessions,
  tournaments,
  users,
} from "@shared/schema";
import { db } from "../../db";
import { pairConversationId } from "../../lib/conversationId";
import { FIXTURE_CONTACT_EMAIL } from "./fixtures";
import type { ExistingMarked, ExistingUser, SeedStore, UserWrite } from "./seeder";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function userRow(row: { id: string; email: string; slug: string; isTestUser: boolean | null } | undefined): ExistingUser | undefined {
  return row ? { id: row.id, email: row.email, slug: row.slug, isTestUser: row.isTestUser === true } : undefined;
}

export function createDrizzleSeedStore(qb: Executor): SeedStore {
  const userColumns = { id: users.id, email: users.email, slug: users.slug, isTestUser: users.isTestUser };

  return {
    // ---------- Reads ----------

    async findUserByEmail(email) {
      const [row] = await qb.select(userColumns).from(users).where(eq(users.email, email));
      return userRow(row);
    },
    async findUserBySlug(slug) {
      const [row] = await qb.select(userColumns).from(users).where(eq(users.slug, slug));
      return userRow(row);
    },
    async findUserById(id) {
      const [row] = await qb.select(userColumns).from(users).where(eq(users.id, id));
      return userRow(row);
    },
    async findOrganizationBySlug(slug) {
      const [row] = await qb
        .select({ id: organizations.id, email: organizations.email, ownerId: organizations.ownerId })
        .from(organizations)
        .where(eq(organizations.slug, slug));
      return row;
    },
    async findClubBySlug(slug): Promise<ExistingMarked | undefined> {
      const [row] = await qb.select({ id: clubs.id, email: clubs.email }).from(clubs).where(eq(clubs.slug, slug));
      return row;
    },
    async findTournamentBySlug(slug): Promise<ExistingMarked | undefined> {
      const [row] = await qb.select({ id: tournaments.id, email: tournaments.email }).from(tournaments).where(eq(tournaments.slug, slug));
      return row;
    },

    // ---------- Users ----------

    async createTestUser(user: UserWrite) {
      if (!user.passwordHash) throw new Error("[e2e-seed] createTestUser needs a password hash");
      const [row] = await qb
        .insert(users)
        .values({
          email: user.email,
          password: user.passwordHash,
          name: user.name,
          role: user.role,
          slug: user.slug,
          isOrganizer: user.isOrganizer,
          isAdmin: user.isAdmin,
          isHidden: user.isHidden,
          isTestUser: true,
          isApproved: true,
          profileCompleted: true,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: "active",
        })
        .returning({ id: users.id });
      return row.id;
    },

    async updateTestUser(id, user: UserWrite) {
      const updated = await qb
        .update(users)
        .set({
          name: user.name,
          role: user.role,
          slug: user.slug,
          isOrganizer: user.isOrganizer,
          isAdmin: user.isAdmin,
          isHidden: user.isHidden,
          isApproved: true,
          profileCompleted: true,
          emailVerified: true,
          status: "active",
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...(user.passwordHash ? { password: user.passwordHash } : {}),
        })
        // Ownership re-checked at write time: only ever an existing TEST user
        // with exactly this fixture email.
        .where(and(eq(users.id, id), eq(users.email, user.email), eq(users.isTestUser, true)))
        .returning({ id: users.id });
      if (updated.length !== 1) throw new Error(`[e2e-seed] ${user.email} changed since planning - aborting`);
    },

    async upsertPlayerProfile(userId, profile) {
      const values = { ...profile, isDraft: false };
      const [existing] = await qb.select({ id: playerProfiles.id }).from(playerProfiles).where(eq(playerProfiles.userId, userId));
      if (existing) {
        await qb.update(playerProfiles).set(values).where(eq(playerProfiles.id, existing.id));
        return false;
      }
      await qb.insert(playerProfiles).values({ ...values, userId });
      return true;
    },

    async upsertCoachProfile(userId, profile) {
      const values = { ...profile, isDraft: false };
      const [existing] = await qb.select({ id: coachProfiles.id }).from(coachProfiles).where(eq(coachProfiles.userId, userId));
      if (existing) {
        await qb.update(coachProfiles).set(values).where(eq(coachProfiles.id, existing.id));
        return false;
      }
      await qb.insert(coachProfiles).values({ ...values, userId });
      return true;
    },

    // ---------- Organisation + community ----------

    async upsertOrganization(existingId, org, ownerId) {
      const values = {
        slug: org.slug,
        name: org.name,
        description: org.description,
        email: org.email,
        ownerId,
        type: org.type,
        status: org.status,
        listingType: "free",
        updatedAt: new Date(),
      };
      if (existingId) {
        const updated = await qb
          .update(organizations)
          .set(values)
          .where(and(eq(organizations.id, existingId), eq(organizations.email, FIXTURE_CONTACT_EMAIL)))
          .returning({ id: organizations.id });
        if (updated.length !== 1) throw new Error(`[e2e-seed] organisation ${org.slug} changed since planning - aborting`);
        return { id: existingId, created: false };
      }
      const [row] = await qb.insert(organizations).values(values).returning({ id: organizations.id });
      return { id: row.id, created: true };
    },

    async ensureOrganizationOwner(organizationId, userId) {
      const [existing] = await qb
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId)));
      if (existing) {
        await qb.update(organizationMembers).set({ role: "owner" }).where(eq(organizationMembers.id, existing.id));
        return false;
      }
      await qb.insert(organizationMembers).values({ organizationId, userId, role: "owner" });
      return true;
    },

    async ensureCommunityMembership(organizationId, userId, status) {
      const [existing] = await qb
        .select({ id: communityMemberships.id })
        .from(communityMemberships)
        .where(and(eq(communityMemberships.organizationId, organizationId), eq(communityMemberships.userId, userId)));
      if (existing) {
        await qb.update(communityMemberships).set({ status }).where(eq(communityMemberships.id, existing.id));
        return false;
      }
      await qb.insert(communityMemberships).values({ organizationId, userId, status });
      return true;
    },

    // ---------- Clubs ----------

    async upsertClub(existingId, club) {
      const values = { ...club, listingType: "free", updatedAt: new Date() };
      if (existingId) {
        const updated = await qb
          .update(clubs)
          .set(values)
          .where(and(eq(clubs.id, existingId), eq(clubs.email, FIXTURE_CONTACT_EMAIL)))
          .returning({ id: clubs.id });
        if (updated.length !== 1) throw new Error(`[e2e-seed] club ${club.slug} changed since planning - aborting`);
        return { id: existingId, created: false };
      }
      const [row] = await qb.insert(clubs).values(values).returning({ id: clubs.id });
      return { id: row.id, created: true };
    },

    async ensureClubFollow(userId, clubId) {
      const [existing] = await qb
        .select({ id: clubFollows.id })
        .from(clubFollows)
        .where(and(eq(clubFollows.userId, userId), eq(clubFollows.clubId, clubId)));
      if (existing) return false;
      await qb.insert(clubFollows).values({ userId, clubId });
      return true;
    },

    // ---------- Tournaments ----------

    async upsertTournament(existingId, tournament) {
      if (existingId) {
        const updated = await qb
          .update(tournaments)
          .set(tournament)
          .where(and(eq(tournaments.id, existingId), eq(tournaments.email, FIXTURE_CONTACT_EMAIL)))
          .returning({ id: tournaments.id });
        if (updated.length !== 1) throw new Error(`[e2e-seed] tournament ${tournament.slug} changed since planning - aborting`);
        return { id: existingId, created: false };
      }
      const [row] = await qb.insert(tournaments).values(tournament).returning({ id: tournaments.id });
      return { id: row.id, created: true };
    },

    // ---------- Organiser Hub (all under the fixture organisation) ----------

    async ensureSeason(organizationId, createdBy, season) {
      const [existing] = await qb
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.organizationId, organizationId), eq(seasons.name, season.name)));
      const values = { ...season, organizationId, createdBy, updatedAt: new Date() };
      if (existing) {
        await qb.update(seasons).set(values).where(eq(seasons.id, existing.id));
        return { id: existing.id, created: false };
      }
      const [row] = await qb.insert(seasons).values(values).returning({ id: seasons.id });
      return { id: row.id, created: true };
    },

    async ensureSeries(organizationId, seasonId, createdBy, item) {
      const [existing] = await qb
        .select({ id: series.id })
        .from(series)
        .where(and(eq(series.organizationId, organizationId), eq(series.seasonId, seasonId), eq(series.name, item.name)));
      const values = { ...item, organizationId, seasonId, createdBy, updatedAt: new Date() };
      if (existing) {
        await qb.update(series).set(values).where(eq(series.id, existing.id));
        return { id: existing.id, created: false };
      }
      const [row] = await qb.insert(series).values(values).returning({ id: series.id });
      return { id: row.id, created: true };
    },

    async upsertSession(organizationId, createdBy, session, seasonId, seriesId) {
      const values = {
        organizationId,
        createdBy,
        title: session.title,
        description: session.description,
        type: session.type,
        status: session.status,
        startAt: session.startAt,
        endAt: session.endAt,
        location: session.location,
        latitude: session.latitude,
        longitude: session.longitude,
        timeZone: session.timeZone,
        maxParticipants: session.maxParticipants,
        waitingListEnabled: session.waitingListEnabled,
        waitingListCapacity: session.waitingListCapacity,
        skillLevel: session.skillLevel,
        visibility: "public",
        courtsCount: session.courtsCount,
        matchMode: session.matchMode,
        seasonId,
        seriesId,
        updatedAt: new Date(),
      };
      const [existing] = await qb
        .select({ id: tennisSessions.id })
        .from(tennisSessions)
        .where(and(eq(tennisSessions.organizationId, organizationId), eq(tennisSessions.title, session.title)));
      if (existing) {
        await qb.update(tennisSessions).set(values).where(eq(tennisSessions.id, existing.id));
        return { id: existing.id, created: false };
      }
      const [row] = await qb.insert(tennisSessions).values(values).returning({ id: tennisSessions.id });
      return { id: row.id, created: true };
    },

    async ensureRegistration(sessionId, userId, status, checkedInAt) {
      const [existing] = await qb
        .select({ id: registrations.id })
        .from(registrations)
        .where(and(eq(registrations.sessionId, sessionId), eq(registrations.userId, userId)));
      if (existing) {
        await qb.update(registrations).set({ status, checkedInAt }).where(eq(registrations.id, existing.id));
        return false;
      }
      await qb.insert(registrations).values({ sessionId, userId, status, checkedInAt });
      return true;
    },

    async ensureRound(sessionId, roundNumber, completedAt) {
      const [existing] = await qb
        .select({ id: sessionRounds.id })
        .from(sessionRounds)
        .where(and(eq(sessionRounds.sessionId, sessionId), eq(sessionRounds.roundNumber, roundNumber)));
      if (existing) {
        await qb.update(sessionRounds).set({ status: "completed", completedAt }).where(eq(sessionRounds.id, existing.id));
        return { id: existing.id, created: false };
      }
      const [row] = await qb
        .insert(sessionRounds)
        .values({ sessionId, roundNumber, status: "completed", completedAt })
        .returning({ id: sessionRounds.id });
      return { id: row.id, created: true };
    },

    async ensureMatch(sessionId, roundId, match) {
      const values = {
        teamAIds: match.teamAIds,
        teamBIds: match.teamBIds,
        teamAGames: match.teamAGames,
        teamBGames: match.teamBGames,
        status: "confirmed",
        confirmedAt: match.confirmedAt,
      };
      const [existing] = await qb
        .select({ id: matches.id })
        .from(matches)
        .where(and(eq(matches.roundId, roundId), eq(matches.courtLabel, match.courtLabel)));
      if (existing) {
        await qb.update(matches).set(values).where(eq(matches.id, existing.id));
        return false;
      }
      await qb.insert(matches).values({ ...values, sessionId, roundId, courtLabel: match.courtLabel });
      return true;
    },

    // ---------- Messages ----------

    async ensureMessage(message) {
      const conversationId = pairConversationId(message.senderId, message.recipientId);
      const [existing] = await qb
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.senderUserId, message.senderId),
            eq(messages.content, message.content)
          )
        );
      if (existing) return false;
      await qb.insert(messages).values({
        conversationId,
        recipientId: message.recipientId,
        recipientType: message.recipientType,
        senderUserId: message.senderId,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        subject: message.subject,
        content: message.content,
        isRead: false,
      });
      return true;
    },
  };
}
