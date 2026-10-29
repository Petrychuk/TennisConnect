// Test support only - minimal row builders for database integration tests.
// Every builder fills just the NOT NULL columns without defaults.

import { randomBytes } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import {
  communityMemberships,
  externalActivities,
  marketplaceItems,
  matches,
  messages,
  organizationMembers,
  organizations,
  organizerRequests,
  playerProfiles,
  registrations,
  seasons,
  series,
  sessionRounds,
  sessionTemplates,
  sessionUpdates,
  tennisSessions,
  tournamentHistory,
  users,
} from "@shared/schema";

type Db = NodePgDatabase<typeof schema>;
const tag = () => randomBytes(4).toString("hex");

export function makeFixtures(db: Db) {
  return {
    async user(email: string, extra: Partial<typeof users.$inferInsert> = {}) {
      const [row] = await db
        .insert(users)
        .values({ email, password: "x", name: email.split("@")[0], role: "player", slug: `${email.split("@")[0]}-${tag()}`, ...extra })
        .returning();
      return row;
    },
    async organization(ownerId: string, name = `Org ${tag()}`) {
      const [row] = await db.insert(organizations).values({ slug: `org-${tag()}`, name, ownerId }).returning();
      return row;
    },
    async season(organizationId: string, createdBy: string) {
      const [row] = await db
        .insert(seasons)
        .values({ organizationId, createdBy, name: `Season ${tag()}`, type: "social", startDate: "2026-01-01", endDate: "2026-12-31" })
        .returning();
      return row;
    },
    async series(organizationId: string, seasonId: string, createdBy: string) {
      const [row] = await db
        .insert(series)
        .values({ organizationId, seasonId, createdBy, name: `Series ${tag()}`, format: "social" })
        .returning();
      return row;
    },
    async template(organizationId: string, createdBy: string) {
      const [row] = await db.insert(sessionTemplates).values({ organizationId, createdBy, name: `Template ${tag()}` }).returning();
      return row;
    },
    async session(organizationId: string, createdBy: string, extra: Partial<typeof tennisSessions.$inferInsert> = {}) {
      const [row] = await db
        .insert(tennisSessions)
        .values({ organizationId, createdBy, title: `Session ${tag()}`, startAt: new Date("2026-06-01T08:00:00Z"), ...extra })
        .returning();
      return row;
    },
    async sessionUpdate(sessionId: string, organizerId: string) {
      const [row] = await db.insert(sessionUpdates).values({ sessionId, organizerId, message: "update", sentTo: 1 }).returning();
      return row;
    },
    async registration(sessionId: string, userId: string) {
      const [row] = await db.insert(registrations).values({ sessionId, userId }).returning();
      return row;
    },
    async round(sessionId: string, roundNumber = 1) {
      const [row] = await db.insert(sessionRounds).values({ sessionId, roundNumber }).returning();
      return row;
    },
    async match(sessionId: string, roundId: string, teamA: string[], teamB: string[]) {
      const [row] = await db
        .insert(matches)
        .values({ sessionId, roundId, courtLabel: "Court 1", teamAIds: teamA, teamBIds: teamB })
        .returning();
      return row;
    },
    async communityMember(organizationId: string, userId: string) {
      const [row] = await db.insert(communityMemberships).values({ organizationId, userId }).returning();
      return row;
    },
    async orgMember(organizationId: string, userId: string) {
      const [row] = await db.insert(organizationMembers).values({ organizationId, userId }).returning();
      return row;
    },
    async message(senderUserId: string, recipientId: string, extra: Partial<typeof messages.$inferInsert> = {}) {
      const [row] = await db
        .insert(messages)
        .values({ senderUserId, recipientId, recipientType: "player", senderName: "S", senderEmail: "s@tennisconnect.test", content: `hi ${tag()}`, ...extra })
        .returning();
      return row;
    },
    async externalActivity(extra: Partial<typeof externalActivities.$inferInsert> = {}) {
      const [row] = await db
        .insert(externalActivities)
        .values({ title: `Activity ${tag()}`, sourceName: "src", sourceUrl: `https://example.invalid/${tag()}`, confidence: "high", ...extra })
        .returning();
      return row;
    },
    async tournamentHistory(userId: string, extra: Partial<typeof tournamentHistory.$inferInsert> = {}) {
      const [row] = await db
        .insert(tournamentHistory)
        .values({ userId, name: "Cup", location: "Sydney", date: "2026-01-01", ...extra })
        .returning();
      return row;
    },
    async playerProfile(userId: string, extra: Partial<typeof playerProfiles.$inferInsert> = {}) {
      const [row] = await db.insert(playerProfiles).values({ userId, location: "Sydney", skillLevel: "Intermediate", ...extra }).returning();
      return row;
    },
    async marketplaceItem(userId: string, extra: Partial<typeof marketplaceItems.$inferInsert> = {}) {
      const [row] = await db
        .insert(marketplaceItems)
        .values({ userId, title: "Racquet", price: "10", condition: "good", location: "Sydney", sellerName: "S", ...extra })
        .returning();
      return row;
    },
    async organizerRequest(userId: string, reviewedBy?: string) {
      const [row] = await db.insert(organizerRequests).values({ userId, reviewedBy }).returning();
      return row;
    },
  };
}
