# Organiser onboarding

Updated 2 Nov 2026 (branch `feature/organiser-hub-v2`). No backend, permission or schema change.

## Flow

1. **Register → verify.** `/verify-email` accepts the token, the server creates the session, and the client goes to `postVerifyTarget(user, stashedReturn)` (`client/src/lib/postVerifyTarget.ts`): a safe stashed `returnTo` (+`joinSession`), else `/complete-profile` while the profile is unfinished, else the person's own profile (`profilePathFor(user)`, built from the signed-in account). It never defaults to `/organiser`. The "check your email" poll in `auth.tsx` uses the same function.
2. **Sign in.** `auth.tsx` follows `?returnTo=` only when `safeReturnPath()` accepts it (a single-slash same-site path; absolute, `//host`, backslash and control-character values are ignored). Where they land is decided by the page: the Hub checks real permissions on arrival.
3. **Organiser Hub.** `OrganiserAccessGate` (`components/organiser/ui/organiser-layout.tsx`):
   - guest → `/auth?returnTo=…`;
   - `isOrganizer` or `isAdmin` → the Hub, no modal (same rule as `requireOrganizer`);
   - anyone else signed in → `OrganiserAccessModal` over a blank screen (no Hub content rendered).
4. **Modal states** (`resolveOnboardingView`, `client/src/lib/organiserOnboarding.ts`): loading, status-check error (Try again), no request (button live), pending ("Your organiser request is under review", button off), submitted (confirmation copy, button off), rejected / revoked (existing wording, "Request Access Again"), approved (re-reads the account; the gate then opens the Hub).
5. **Requesting** uses the existing `POST /api/organizer/requests` and `GET /api/organizer/requests/me`. The server still refuses a second pending request (400) and an existing organiser. A request grants nothing; an admin approves it as before.
6. **Closing** (X, Escape, backdrop, "Back to My Profile") goes to the person's own profile.

The Organiser Hub link in the profile menu and the mobile "More" sheet is now shown to every signed-in person (it was organisers and admins only), so a player has a way to click it.

## Accessibility and layout

Radix Dialog: focus trap, Escape, `aria-modal`, title and description wiring. Close button 44×44; both buttons `size="lg"` (48 px). Desktop and tablet: centred dialog with the photo on the left. Phones (< 640 px): bottom sheet, safe-area padding, no photo (a CSS background on an element that is `display: none`, so it isn't downloaded). Status text is in a polite live region; errors use `role="alert"`.

## Known limitations

- **Rejected requests:** the API has no cool-down, so "Request Access Again" works immediately. If a rule is added server-side, the modal shows the server's message (inline alert) without a client change. ORG-ONB-011 asserts the current behaviour (201).
- **Duplicate requests:** the "no pending request" check in `POST /requests` is read-then-insert, not atomic, so two truly simultaneous requests from different tabs could both pass. The UI sends one at a time; a unique partial index on `(user_id) WHERE status = 'pending'` would close it. Not done here (schema change).
- **Focus restoration:** the modal opens on navigation, not from a trigger, and every way of closing it navigates away, so there is no element to return focus to.
- **Design:** the mockup's dark-green buttons and photo were adapted to the TennisConnect button system (lime button, 12 px radius) and an existing court photo (`dynamic_tennis_ball_on_court_line_with_dramatic_lighting.png`). Swap the image if the design's own photo is supplied.
- Verification in a different browser from registration: the server creates the session in the browser that opens the link; that is unchanged.
