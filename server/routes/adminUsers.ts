import { Router } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../requireAuth";
import { omitPassword } from "../lib/sanitizeUser";
import {
  MAX_BULK_DELETE,
  deletionBlocks,
  toAdminFailure,
  uniqueIds,
  type DeletionFailure,
} from "@shared/userDeletion";

/*
  Admin Users list and account deletion (mounted at /api/admin).

  Moved out of server/routes.ts so the routes can be tested on a loopback
  server with faked storage (server/routes/adminUsers.test.ts). The business
  rule is unchanged and lives in shared/userDeletion.ts: an account that owns
  an organisation with sessions, or created sessions, is never deleted here.
  What changed:
  - every account in the list carries `deletionBlock` (null, or the reason it
    can't be deleted now), and `ownedOrganization` for EVERY owner - before,
    only current organisers had it, so a player whose organiser access had
    been revoked was blocked with no "Delete organisation" action to unblock;
  - single and bulk deletes answer with a code, the admin wording, the
    organisation and its session count for each refusal;
  - bulk requests are deduplicated and capped (MAX_BULK_DELETE), and the
    acting admin is reported, never deleted;
  - one audit line per delete request: admin id, counts and ids (no emails).
*/

const router = Router();

function audit(action: string, adminId: string, requested: number, deleted: string[], failed: DeletionFailure[]) {
  console.info(
    `[admin-audit] ${action} admin=${adminId} requested=${requested} deleted=${deleted.length} not_deleted=${failed.length}` +
      ` deleted_ids=${JSON.stringify(deleted)} not_deleted=${JSON.stringify(failed.map((f) => ({ id: f.id, code: f.code })))}`,
  );
}

router.get("/users", requireAdmin, async (_req, res, next) => {
  try {
    const users = await storage.getAllUsers();
    const requests = await storage.getOrganizerRequests();

    // Latest request per user (requests are already ordered desc by createdAt).
    const latestRequestByUser = new Map<string, string>();
    for (const r of requests) {
      if (!latestRequestByUser.has(r.userId)) latestRequestByUser.set(r.userId, r.status);
    }

    const ids = users.map((u) => u.id);
    const organizations = await storage.getOrganizationsByOwnerIds(ids);
    const organizationByOwner = new Map(organizations.map((o) => [o.ownerId, o]));
    const facts = await storage.getUserDeletionFacts(ids);
    const blocks = deletionBlocks(ids, facts);

    res.json(
      users.map((u: any) => {
        const org = organizationByOwner.get(u.id);
        return {
          ...omitPassword(u),
          organizerRequestStatus: u.isOrganizer ? null : latestRequestByUser.get(u.id) || null,
          ownedOrganization: org
            ? { ...org, sessionCount: facts.sessionCountByOrganization.get(org.id) ?? 0 }
            : null,
          deletionBlock: blocks.get(u.id) ?? null,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  const adminId = (req.user as any).id as string;
  const userId = req.params.id;
  try {
    const { deleted, failed } = await storage.deleteUserAccounts([userId], { selfId: adminId });
    const adminFailed = failed.map(toAdminFailure);
    audit("delete-user", adminId, 1, deleted, adminFailed);

    if (deleted.includes(userId)) return res.json({ success: true, deleted });

    const failure = adminFailed[0];
    const status = failure?.code === "not_found" ? 404 : failure?.code === "error" ? 500 : 400;
    return res.status(status).json({
      success: false,
      code: failure?.code ?? "error",
      message: failure?.message ?? "Failed to delete user",
      organization: failure?.organization ?? null,
      sessionCount: failure?.sessionCount ?? null,
      failed: adminFailed,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, code: "error", message: "Failed to delete user" });
  }
});

router.post("/users/bulk-delete", requireAdmin, async (req, res) => {
  const adminId = (req.user as any).id as string;
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }
  const requested = uniqueIds(ids);
  if (requested.length === 0) {
    return res.status(400).json({ message: "ids must be a non-empty array" });
  }
  if (requested.length > MAX_BULK_DELETE) {
    return res.status(400).json({ message: `At most ${MAX_BULK_DELETE} users can be deleted at once` });
  }

  try {
    const { deleted, failed } = await storage.deleteUserAccounts(requested, { selfId: adminId });
    const adminFailed = failed.map(toAdminFailure);
    audit("bulk-delete", adminId, requested.length, deleted, adminFailed);
    res.json({
      deleted,
      failed: adminFailed,
      summary: { requested: requested.length, deleted: deleted.length, notDeleted: adminFailed.length },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Bulk delete failed. Nothing was reported as deleted; refresh the list to check." });
  }
});

export default router;
