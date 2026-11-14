# Admin user deletion

Updated 4 Nov 2026 (branch `feature/organiser-hub-v2`). The rules didn't change; the accounting, wording and UI did.

## Rules (`shared/userDeletion.ts`, unit-tested)

- An account that **owns an organisation with any session** (draft, published, cancelled or finished) is not deleted: registrations and results hang off sessions.
- An account that **created sessions** is not deleted.
- An organisation with **no sessions** is removed together with its owner, in the same transaction.
- The acting admin is never deleted. Unknown or already-deleted ids are reported as **not found** (they used to count as deleted).
- Nothing here cascade-deletes sessions. To remove a protected account, an admin first deletes its organisation from the row (`Delete Organization`; it removes the organisation's sessions, registrations and results) and only if that is intended. Then the account can be deleted.

## What was wrong

| Reported | Cause | Fix |
|---|---|---|
| Single delete of a test player refused with "You own an organization with active sessions…" | Business rule working as designed, but the message is the self-service one ("You own…", "active") and the rule counts **any** session. A player whose organiser access had been revoked had **no** `Delete Organization` button: the list only looked up organisations for current organisers. | Admin wording with the organisation name, session count and the way forward. `ownedOrganization` is now filled for every owner. The reason appears inside the dialog with a `Delete organisation…` button, not a toast. Protected rows carry a **Protected** badge before anything is tried. |
| Bulk "Deleted 9, 8 skipped" with a page-covering toast | Every failure message concatenated into one destructive toast | A result panel: "9 deleted, 8 not deleted", failures grouped by reason, each group collapsible and scrollable, names and emails, a dismiss button |
| Counts could mislead | Duplicates and missing ids were counted as deleted; ticks from other filters stayed selected and were sent | Ids are deduplicated; missing ids are `not_found`; any filter change clears the selection; only ticked **visible** rows are sent (`bulkDeleteTargets`); at most 500 per request |
| Double submit | Confirm could fire twice | One request at a time; buttons disabled while it runs |

## API (`server/routes/adminUsers.ts`, mounted at `/api/admin`)

- `GET /users`: each user adds `ownedOrganization` (with `sessionCount`) and `deletionBlock` (`null` or `{ code, message, organization, sessionCount }`).
- `DELETE /users/:id`: `200 { success, deleted }`; `400` for protected or self, `404` not found, `500` error. Each refusal is `{ code, message, organization, sessionCount }`.
- `POST /users/bulk-delete { ids }`: `200 { deleted, failed[], summary: { requested, deleted, notDeleted } }`; `400` for bad input or more than 500 ids.
- Codes: `owns_organization_with_sessions`, `created_sessions`, `not_found`, `self`, `error`.
- Audit: one `[admin-audit]` log line per request (admin id, counts, ids and codes, no emails).

## Users tab filters

Role (All / Players / Coaches), organiser status (All / Organisers Approved / Not Organisers / Awaiting Organiser Approval) and **account status (All / Approved / Pending)**, which used to be read-only counters. All three combine (`client/src/lib/adminUserFilters.ts`).

## Leftover E2E accounts on Staging

Accounts protected by these rules are not force-deleted. Remove them with the run-scoped cleanup for their run (`npm run e2e:cleanup-run -- --run-id=<id>`: dry run first, then `--apply`), which removes a run's organisations and sessions with its accounts. Alternatively an admin deletes the organisation and then the account, only for test accounts.

## Known limitations

- The eligibility check runs just before the delete transaction, not inside it. A session created in between makes the transaction fail on its foreign key, and every id in it is reported as `error`. Nothing is deleted in that case.
- The bulk result panel is replaced by the next bulk delete; it isn't kept after a page reload. The audit log is the record.
