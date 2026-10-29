# Future enhancement: coach-controlled contact visibility

Status: **not built**. The architecture is ready (29 Oct 2026, `server/lib/publicProfiles.ts`).

## What the coach would choose (Coach Hub → Profile → Privacy)

**Contact visibility:**

- **Approved members** (default, today's behaviour): signed-in accounts approved by an admin, not hidden and active see the coach's phone and email on the Contact tab.
- **Only me**: nobody else sees them. Members can still message the coach. Admins keep access for moderation.

## Already in place

- `coachContactAccess(viewer, coachId, visibility)` takes `"approved-members" | "only-me"`. "Only me" returns `"private"` for everyone except the coach and admins.
- `publicCoachResponse({ …, visibility })` passes it through. Every caller uses `DEFAULT_COACH_CONTACT_VISIBILITY` today.
- Unit tests already cover "Only me".

## To build it

1. **Schema:** add `coach_profiles.contact_visibility text not null default 'approved-members'`, with a check constraint for the two values. Migration and backfill to the default.
2. **API:** accept it in `coachProfileUpdateSchema` (`server/lib/coachProfileUpdate.ts`). Pass `profile.contactVisibility` to `publicCoachResponse` in `GET /api/coaches/:slug`. Do **not** add it to `PUBLIC_COACH_PROFILE_FIELDS`, because other people don't need it.
3. **UI:** a two-option radio group in the Coach Hub profile editor. Handle `contactAccess === "private"` on the Contact tab with "This coach shares contact details only through messages", keeping the message form.
4. **Tests:** a route test for both values. A Staging test where the coach switches to "Only me" and an approved member gets `contact: null`.
5. **Players:** if wanted, the same pattern on player profiles. They have no phone or email fields today.
