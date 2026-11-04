// Account deletion rules, shared by the server (storage.deleteUserAccounts,
// the admin delete routes) and the admin Users tab. Pure: no database, so
// the rules are unit-tested (shared/userDeletion.test.ts).
//
// The business rule is unchanged and is never bypassed here:
//   - an account that owns an organisation with ANY session under it (draft,
//     published, cancelled or finished - registrations and results hang off
//     sessions) is not deleted;
//   - an account that created sessions is not deleted;
//   - an organisation with no sessions is removed together with its owner.
// What this adds is precise accounting: every requested id ends up in exactly
// one of `deleted` / `failed`, duplicates count once, and an id that no
// longer exists is reported as such instead of being counted as deleted.

export type DeletionFailureCode =
  | "self"
  | "not_found"
  | "owns_organization_with_sessions"
  | "created_sessions"
  | "error";

export interface DeletionFailure {
  id: string;
  code: DeletionFailureCode;
  /** Human-readable reason. Self-service wording from storage; the admin routes replace it with adminDeletionMessage(). */
  message: string;
  organization?: { id: string; name: string } | null;
  sessionCount?: number;
}

export interface DeletionResult {
  deleted: string[];
  failed: DeletionFailure[];
}

/** Self-service wording (DELETE /api/me/account), unchanged. */
export const SELF_SERVICE_DELETION_MESSAGES = {
  owns_organization_with_sessions:
    "You own an organization with active sessions - these need to be cancelled or reassigned, or ownership transferred, before deleting your account",
  created_sessions: "You've created sessions - these need to be cancelled or reassigned before deleting your account",
  not_found: "User not found",
  self: "You cannot delete yourself",
  error: "Failed to delete user",
} as const satisfies Record<DeletionFailureCode, string>;

export interface DeletionPlanInput {
  requestedIds: readonly string[];
  /** Which of the requested ids exist as users right now. */
  existingIds: Iterable<string>;
  ownedOrganizations: readonly { id: string; name: string; ownerId: string }[];
  /** organisation id -> number of sessions under it (any status). */
  sessionCountByOrganization: ReadonlyMap<string, number>;
  /** user id -> number of sessions that user created (any status). */
  createdSessionCountByUser: ReadonlyMap<string, number>;
  /** The acting admin, never deleted through these routes. */
  selfId?: string | null;
}

/** What storage.getUserDeletionFacts() reads for a set of accounts. */
export interface UserDeletionFacts {
  ownedOrganizations: { id: string; name: string; ownerId: string }[];
  sessionCountByOrganization: Map<string, number>;
  createdSessionCountByUser: Map<string, number>;
}

export interface DeletionPlan {
  /** Unique, existing, eligible ids, in request order. */
  allowedIds: string[];
  failed: DeletionFailure[];
  /** Session-less organisations owned by someone in allowedIds - removed in the same transaction. */
  emptyOrganizationIdsToCascade: string[];
}

/** Unique non-empty string ids, first occurrence order kept. */
export function uniqueIds(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || id.trim() === "" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function planUserDeletion(input: DeletionPlanInput): DeletionPlan {
  const requested = uniqueIds(input.requestedIds);
  const existing = new Set(input.existingIds);
  const orgsByOwner = new Map<string, { id: string; name: string; ownerId: string }[]>();
  for (const org of input.ownedOrganizations) {
    const list = orgsByOwner.get(org.ownerId) ?? [];
    list.push(org);
    orgsByOwner.set(org.ownerId, list);
  }

  const allowedIds: string[] = [];
  const failed: DeletionFailure[] = [];

  for (const id of requested) {
    if (input.selfId && id === input.selfId) {
      failed.push({ id, code: "self", message: SELF_SERVICE_DELETION_MESSAGES.self });
      continue;
    }
    if (!existing.has(id)) {
      failed.push({ id, code: "not_found", message: SELF_SERVICE_DELETION_MESSAGES.not_found });
      continue;
    }
    const orgsWithSessions = (orgsByOwner.get(id) ?? []).filter((o) => (input.sessionCountByOrganization.get(o.id) ?? 0) > 0);
    if (orgsWithSessions.length > 0) {
      const first = orgsWithSessions[0];
      failed.push({
        id,
        code: "owns_organization_with_sessions",
        message: SELF_SERVICE_DELETION_MESSAGES.owns_organization_with_sessions,
        organization: { id: first.id, name: first.name },
        sessionCount: orgsWithSessions.reduce((sum, o) => sum + (input.sessionCountByOrganization.get(o.id) ?? 0), 0),
      });
      continue;
    }
    const created = input.createdSessionCountByUser.get(id) ?? 0;
    if (created > 0) {
      failed.push({ id, code: "created_sessions", message: SELF_SERVICE_DELETION_MESSAGES.created_sessions, sessionCount: created });
      continue;
    }
    allowedIds.push(id);
  }

  const allowed = new Set(allowedIds);
  const emptyOrganizationIdsToCascade = input.ownedOrganizations
    .filter((o) => allowed.has(o.ownerId) && (input.sessionCountByOrganization.get(o.id) ?? 0) === 0)
    .map((o) => o.id);

  return { allowedIds, failed, emptyOrganizationIdsToCascade };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What an admin is told, with the safe way forward. */
export function adminDeletionMessage(failure: Pick<DeletionFailure, "code" | "organization" | "sessionCount">): string {
  switch (failure.code) {
    case "owns_organization_with_sessions": {
      const name = failure.organization?.name ? `"${failure.organization.name}"` : "an organisation";
      const sessions = failure.sessionCount ? plural(failure.sessionCount, "session") : "sessions";
      return `Owns ${name}, which has ${sessions} (any status). Not deleted. To delete this account, first delete the organisation from this row - that also removes its sessions, registrations and results - only if that is intended.`;
    }
    case "created_sessions": {
      const sessions = failure.sessionCount ? plural(failure.sessionCount, "session") : "sessions";
      return `Created ${sessions} (any status). Not deleted while those sessions exist; remove the organisation that holds them first.`;
    }
    case "self":
      return "You cannot delete yourself.";
    case "not_found":
      return "Already deleted or not found. Refresh the list.";
    default:
      return "Not deleted: the server couldn't complete the deletion. Nothing was removed for this account; try again.";
  }
}

/** A failure as the admin routes return it. */
export function toAdminFailure(failure: DeletionFailure): DeletionFailure {
  return { ...failure, message: adminDeletionMessage(failure) };
}

export const DELETION_GROUP_LABELS: Record<DeletionFailureCode, string> = {
  owns_organization_with_sessions: "Own an organisation with sessions",
  created_sessions: "Created sessions",
  not_found: "Already deleted or not found",
  self: "Your own account",
  error: "Server error",
};

const GROUP_ORDER: DeletionFailureCode[] = ["owns_organization_with_sessions", "created_sessions", "not_found", "self", "error"];

export interface DeletionSummary {
  deletedCount: number;
  notDeletedCount: number;
  /** e.g. "9 deleted, 8 not deleted" */
  title: string;
  groups: { code: DeletionFailureCode; label: string; failures: DeletionFailure[] }[];
}

/** One readable summary of a bulk result, failures grouped by reason. */
export function summariseDeletion(result: DeletionResult): DeletionSummary {
  const deletedCount = uniqueIds(result.deleted).length;
  const notDeletedCount = result.failed.length;
  const title =
    notDeletedCount === 0
      ? `${plural(deletedCount, "user")} deleted`
      : deletedCount === 0
        ? `No users deleted (${notDeletedCount} not deleted)`
        : `${deletedCount} deleted, ${notDeletedCount} not deleted`;
  const groups = GROUP_ORDER.map((code) => ({
    code,
    label: DELETION_GROUP_LABELS[code],
    failures: result.failed.filter((f) => f.code === code),
  })).filter((g) => g.failures.length > 0);
  // Anything without a known code (an older server) still shows up, under "Server error".
  const unknown = result.failed.filter((f) => !GROUP_ORDER.includes(f.code));
  if (unknown.length > 0) {
    const errorGroup = groups.find((g) => g.code === "error");
    if (errorGroup) errorGroup.failures.push(...unknown);
    else groups.push({ code: "error", label: DELETION_GROUP_LABELS.error, failures: unknown });
  }
  return { deletedCount, notDeletedCount, title, groups };
}

/**
 * For the admin Users list: which existing accounts the rules would refuse to
 * delete right now, with the admin wording. Same planUserDeletion() the delete
 * itself runs, so the list and the result can't disagree.
 */
export function deletionBlocks(
  userIds: readonly string[],
  facts: UserDeletionFacts,
): Map<string, DeletionFailure> {
  const plan = planUserDeletion({
    requestedIds: userIds,
    existingIds: userIds,
    ownedOrganizations: facts.ownedOrganizations,
    sessionCountByOrganization: facts.sessionCountByOrganization,
    createdSessionCountByUser: facts.createdSessionCountByUser,
  });
  return new Map(plan.failed.map((f) => [f.id, toAdminFailure(f)]));
}

/** The ids a bulk delete may send: selected AND currently visible AND not the admin. */
export function bulkDeleteTargets(selectedIds: Iterable<string>, visibleIds: Iterable<string>, selfId?: string | null): string[] {
  const visible = new Set(visibleIds);
  return uniqueIds(Array.from(selectedIds)).filter((id) => visible.has(id) && id !== selfId);
}

/** Largest batch the bulk route accepts in one request. */
export const MAX_BULK_DELETE = 500;
