/*
  Persistence for organiser_subscriptions (one row per user). Kept behind a
  small object so route tests can replace the methods (same pattern as the
  `storage` fakes in server/routes/*.test.ts) without a database.
*/
import { eq } from "drizzle-orm";
import { db } from "../db";
import { organiserSubscriptions } from "@shared/schema";

export interface SubscriptionRecord {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export type SubscriptionPatch = Partial<Omit<SubscriptionRecord, "userId">>;

function toRecord(row: typeof organiserSubscriptions.$inferSelect): SubscriptionRecord {
  return {
    userId: row.userId,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    status: row.status,
    trialEnd: row.trialEnd,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}

export const organiserSubscriptionStore = {
  async get(userId: string): Promise<SubscriptionRecord | undefined> {
    const [row] = await db.select().from(organiserSubscriptions).where(eq(organiserSubscriptions.userId, userId));
    return row ? toRecord(row) : undefined;
  },

  async getByCustomerId(customerId: string): Promise<SubscriptionRecord | undefined> {
    const [row] = await db.select().from(organiserSubscriptions).where(eq(organiserSubscriptions.stripeCustomerId, customerId));
    return row ? toRecord(row) : undefined;
  },

  /** Creates the row or updates only the fields given. Never touches users.is_organizer. */
  async upsert(userId: string, patch: SubscriptionPatch): Promise<SubscriptionRecord> {
    const now = new Date();
    const [row] = await db
      .insert(organiserSubscriptions)
      .values({ userId, ...patch, updatedAt: now })
      .onConflictDoUpdate({ target: organiserSubscriptions.userId, set: { ...patch, updatedAt: now } })
      .returning();
    return toRecord(row);
  },
};
