# Registration, capacity and the waiting list (TC-213)

Organiser Hub audit Batch 3 (OH-AUDIT-003 / 007 / 008), with the business rules
approved on 15 Nov 2026. Code: `server/lib/registrationTx.ts` (all registration
writes), `server/services/registrationNotifications.ts` (messages),
`shared/sessionLifecycle.ts` (`waitlistPromotionOpen`).

## Rules

**Registration**
- A player joining a session with a free place is registered straight away.
  When it's full they join the waiting list (if the session has one), in
  first-come-first-served order (`created_at`, then id).
- Concurrent requests never exceed capacity and never create a second
  registration for the same player (session row lock + the unique
  `(session_id, user_id)` constraint as a backstop).
- Joining again after cancelling is a new join: a new queue position.

**Automatic waitlist promotion** - only before the registration cutoff
(the earlier of "registration closes" and the start time, published sessions
only; TC-189). A place freed by a player cancelling, the organiser removing
someone, an invitation declined, or a capacity increase / removal goes to the
oldest waitlisted player, who is registered immediately and told. Each freed
place is filled exactly once. After the cutoff nothing is promoted
automatically.

**Late organiser registration** - after the cutoff only. `POST
/api/organizer/sessions/:id/late-registrations`, body `{ userId,
overrideWaitlist?, reason? }`:
- the session's owner only; session published or live (not draft, review,
  cancelled, completed or archived);
- capacity checked inside the transaction (409 `capacity_full`), a player who
  already has a place is 409 `already_registered`;
- the first player on the waiting list can be added directly; anyone else
  while people are waiting needs `overrideWaitlist: true` and a `reason` (409
  `waitlist_override_required` with `waiting`, `ahead`, `nextUserId` until
  then; 400 `override_reason_required` without a reason);
- every addition writes a `registration_audit_events` row in the same
  transaction: actor, player, time, action (`late_add` /
  `late_add_waitlist_override`), reason, previous status, the waitlisted
  registrations skipped;
- Live rounds are not changed and the player is not checked in.
UI: Players tab, after the cutoff - "Move to Registered" on the waiting list
and the Add dialog (the Invite button); the override confirmation asks for
the reason.

**Organiser "Move to waiting list"** - only from `registered` (409
`invalid_waitlist_move` otherwise); clears check-in; the player keeps their
original join time; the freed place is not filled automatically (the
organiser is making room on purpose).

**Accepting an invitation** - takes a place like Join, under the same lock;
refused (409 `registration_closed`) after the cutoff or for a cancelled /
finished session; "not open yet" doesn't apply (the organiser let them in).

## Locking

Every registration change of one session runs in a transaction that first
locks the session row (`SELECT ... FOR UPDATE`), then reads/writes
registrations - the same order as TC Live's `generateNextRound` and
`finishSession`, so they can't deadlock. Free places are always counted under
the lock.

## Notifications

- In-app messages (the organiser's thread with the player): "You're off the
  waiting list" for a promotion, "You've been added" for a late addition,
  plus the existing join / leave messages.
- Sent only after the transaction committed, from what it returned - never
  for a change that didn't happen. A repeated request that changes nothing
  sends nothing; each promoted registration gets one message.
- Best-effort: a failed message is logged (`[registration-notify]`) and never
  undoes, or turns into an error for, a registration that already happened.
- **Email: not sent.** TennisConnect has no notification-email preferences, so
  no email is "permitted by user preferences". Adding promotion emails needs
  a preference model (opt-in per user) first; the hook is
  `notifyPromotedPlayers` / `notifyLateAddedPlayer`.
- **No durable outbox.** There is no queue / outbox infrastructure; if the
  process stops between the commit and the send, that message is lost (the
  registration itself is safe). A durable outbox would be a table of pending
  notifications written in the same transaction and sent by a worker.

## Payments - future only

TennisConnect does not process session payments. The wizard says so to the
organiser ("TennisConnect shows the price but doesn't collect payment"), and
nothing in registration depends on payment.

Extension point for paid registration, when it's built: the existing
`payments` table (Stripe Checkout; `paymentType` and `relatedEntityId` are
reserved for future types). A session payment would be `paymentType:
'session_registration'`, `relatedEntityId` = the registration id. Its `status`
is `'pending'` until the **verified webhook** sets `'paid'`; `'pending'`,
`'expired'`, `'failed'` and `'refunded'` must never be read as paid. A paid
place would be held (e.g. a `pending_payment` registration state counted
against capacity under the same session lock, released on expiry) and only
become `registered` on `'paid'`. None of this exists yet; no tables or code
were added for it.

## Database

`migrations/0036_registration_audit_events.sql` - one new table, additive;
apply before deploying the code. Covered by the organisation cascade (rows
deleted with their session) and the user cascade (actor / player set to null).

## Tests

- `server/lib/registrationTx.pg.test.ts` - real Postgres (CI `db-integration`):
  parallel joins for the last place, 8 players for 3 places, double join,
  concurrent cancel + remove, FIFO promotion, cutoff, rollback, capacity races,
  invitations, late additions (override, audit, concurrency, statuses).
- `server/routes/organizerRegistration.test.ts` - API: notification dedupe and
  failure, late-add authorisation / validation / errors.
- `shared/sessionLifecycle.test.ts` - `waitlistPromotionOpen`.
