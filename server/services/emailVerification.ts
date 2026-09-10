// Token issuing/checking for email verification. Shared by
// /api/auth/register (issues on signup), /api/auth/resend-verification
// (issues again on request), and, in non-production environments only,
// the test hook E2E relies on to get past verification without a real
// inbox (see server/routes/testHooks.ts).
//
// Mirrors the password-reset token pattern (server/routes.ts,
// passwordResetTokens) - random bytes, expiry column, single-use `used`
// flag - except the token itself is never stored: only a sha256 hash of
// it is, so a database leak alone can't be replayed as a working
// verification link. The 15-minute skew tolerance a UI form has to
// forgive doesn't apply here (nothing is user-typed), so this doesn't
// need bcrypt/scrypt's deliberate slowness - a fast, deterministic hash
// is what makes the exact-match lookup below possible at all.

import crypto from "crypto";
import { db } from "../db";
import { emailVerificationTokens, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a new verification token for a user and invalidates any
 * previous unused ones - a user requesting "resend" three times
 * shouldn't leave three different links all still valid; only the
 * newest should work.
 */
export async function issueVerificationToken(
  userId: string,
  options?: { ttlMs?: number }
): Promise<{ token: string; expiresAt: Date }> {
  await db
    .update(emailVerificationTokens)
    .set({ used: true })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        eq(emailVerificationTokens.used, false)
      )
    );

  const token = crypto.randomBytes(32).toString("hex");
  const ttlMs = options?.ttlMs ?? VERIFICATION_TOKEN_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export type VerifyEmailTokenResult =
  | { status: "ok"; userId: string }
  | { status: "invalid" }
  | { status: "expired" };

/**
 * Looks up a raw token (as received in the verification link) and, if
 * it's a currently-valid single-use token, marks it used and marks the
 * owning user's email verified. Distinguishes "invalid" (unknown token,
 * or already used) from "expired" (real token, just too old) purely for
 * the frontend's UI copy - neither branch reveals anything about
 * whether a given email address has an account (the token itself
 * already proves the caller had access to a specific verification
 * link, so this isn't an enumeration surface the way "does this email
 * exist" would be).
 */
export async function verifyEmailToken(
  rawToken: string
): Promise<VerifyEmailTokenResult> {
  const tokenHash = hashToken(rawToken);

  const [record] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash));

  if (!record || record.used) {
    return { status: "invalid" };
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    return { status: "expired" };
  }

  await db
    .update(emailVerificationTokens)
    .set({ used: true })
    .where(eq(emailVerificationTokens.id, record.id));

  await db
    .update(users)
    .set({ emailVerified: true, emailVerifiedAt: new Date() })
    .where(eq(users.id, record.userId));

  return { status: "ok", userId: record.userId };
}
