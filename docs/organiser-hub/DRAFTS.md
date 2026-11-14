# Session drafts (Save as Draft)

A draft is one `sessions` row with `status = 'draft'`. It exists from the first save until it is published, and is visible and editable in My Sessions the whole time.

## Lifecycle
1. **First save** (any wizard step, any amount filled in) `POST /api/organizer/sessions` creates the draft. The wizard keeps the new id in the URL (`/organiser/sessions/new?draft=<id>`) and in memory.
2. **Every later save** `PUT /api/organizer/sessions/:id` on that id. Concurrent clicks share one in-flight request, so a double click cannot create two drafts (`client/src/lib/sessionDraftSaver.ts`).
3. **Reopen**: My Sessions → Continue Setup (or Edit) on a draft opens the wizard with `?draft=<id>`; `/organiser/sessions/:id/edit` redirects drafts there. The same URL works after logout, on another device and after a refresh, because everything is read from the server.
4. **Publish** updates the same row (`POST /sessions/:id/publish`). Organisers' sessions go to `pending_review` (admin approval); admin and internal-test sessions become `published`. Either way the row leaves Drafts.

## Validation split
- **Draft save**: nothing is required. Empty name is stored as `Untitled Session` (DB column is NOT NULL) and shown as empty when resumed. Emptied optional fields are sent as `null` and cleared.
- **Publish** (`shared/sessionDraft.ts → publishProblems`): real name, venue, start date, end after start, registration closes not before it opens, not already ended. Failure → 400 `{code:"incomplete"}`. The wizard checks the same rules first and jumps to step 2.
- Only `draft` and `rejected` sessions can be published (409 `not_publishable`); re-publishing never demotes a published or live session.

## Stale writes
Each save sends `expectedUpdatedAt`. If the row changed meanwhile (another tab or device) the server answers 409 `{code:"stale"}`, nothing is overwritten, and the wizard shows a banner offering to reload the latest saved version. A failed save never updates the "saved" state and never shows the success toast; the last successful state stays on the server.

## Tests
- Unit: `shared/sessionDraft.test.ts`, `client/src/lib/sessionDraftSaver.test.ts`, `client/src/lib/sessionDraftPayload.test.ts`
- API: `server/routes/organizerDrafts.test.ts`
- E2E: `tests/organiser/organiser-drafts.spec.ts` (ORG-DRAFT-001…007; 007 is opt-in with `E2E_ALLOW_PUBLISH_REVIEW=1`)

## Limitations
- An unselected session type is stored as the DB default (`social`).
- `maxPlayers` / `courtCount` saved as null resume as 0.
- No server idempotency key: duplicate protection is client-side (one in-flight save) plus the stale guard.
