# [SECURITY][P1] Coach contact details in public APIs, plus 6 Staging failures (29 Oct 2026)

Branch: `fix/coach-contact-privacy`, from `main` `813ceb1`. `main` already has the Production-safe expansion (v1, identical); this branch carries v2 (the fix below) plus the second pass in section 3.

## 1. Coach contact exposure

### Reproduction (from the code; not run against Staging from here)

`GET /api/coaches/:slug` (`server/routes/coaches.ts`) answered every visitor, signed in or not, with:

```ts
res.json({ user: toPublicUser(user), profile });   // profile = the whole coach_profiles row
```

`coach_profiles` has `phone` and `email`, so both went to guests. The page hid them behind "Sign in" (`coach-contact-signed-out`), but the JSON had them.

To reproduce on Staging before the fix, as a guest:

```
GET /api/coaches/<any coach slug>
```

`profile.phone` and `profile.email` are present. Don't paste the values anywhere.

### Root cause

Public responses were built by **removing** a fixed list of fields:

- `toPublicUser()` listed what to remove.
- The coach profile was not filtered at all.

So any field not on the remove-list went public. That includes:

- the coach's `phone` and `email`;
- the user row's `failedLoginAttempts` and `lockedUntil` (login-lockout state), on both coach and player profiles.

### Other public endpoints reviewed

| Endpoint | Before | Now |
|---|---|---|
| `GET /api/coaches` (directory, search, filters) | Already built field by field: no contact fields | Unchanged; route test checks it |
| `GET /api/coaches/:slug` | Whole profile row (phone, email); user via a remove-list | Allowlisted user and profile; `contact` only for allowed viewers |
| `GET /api/players/:slug` | User via a remove-list (lockout counters leaked) | `toPublicUser()` is now an allowlist |
| `GET /api/profile/marketplace/public/:userId`, `/all` | Every item had `sellerEmail`, the seller's **login** email, set from `user.email` on create. The UI never shows it. | `sellerEmail` removed (allowlist). The seller's own `GET /api/profile/marketplace` still has it. |
| `/api/play/recommendations`, `/player-match/:userId`, `/players-looking` | No coach contact fields | Unchanged |
| `/api/organizer/organizations/:slug` | The organisation's own `phone`/`email` (business contact the organiser entered for the listing) | Unchanged; by design, flagged for product review |
| Commented-out duplicate coach routes in `server/routes.ts` | Not mounted | Unchanged |

Caching: no API cache layer exists (only static files get `Cache-Control`). `GET /api/coaches/:slug` now sends `Cache-Control: private, no-store` and `Vary: Cookie`, because its body depends on who asks.

### Fix

`server/lib/publicProfiles.ts` (pure, unit-tested) has:

- `PUBLIC_COACH_PROFILE_FIELDS`, the fields the profile page renders. Never `phone`, `email`, `isDraft` or coordinates.
- `coachContactAccess(viewer, coachUserId)`, which returns `granted`, `sign-in` or `pending-approval`.
- `publicCoachResponse()`, which builds `{ user, profile, contact, contactAccess }`. `contact` is `{ phone, email }` only when access is granted; otherwise it is `null`.
- `toPublicMarketplaceItem()`, an allowlist without `sellerEmail`.

`server/lib/sanitizeUser.ts`:

- `toPublicUser()` keeps only `PUBLIC_USER_FIELDS`: `id`, `name`, `role`, `slug`, `avatar`, `cover`, `profileCompleted`, `isOrganizer`, `createdAt`.
- A column added later stays private until someone adds it on purpose.

**Contact access policy**, approved 29 Oct:

| Viewer | Phone and email |
|---|---|
| Guest | never: `contactAccess: "sign-in"` |
| Signed in, not approved by an admin, hidden or not active | no: `"pending-approval"` |
| Signed in and approved, not hidden, active | yes |
| The coach, and admins | always |

Messaging the coach is unchanged.

**Frontend** (`client/src/pages/coach-profile.tsx`):

- Phone and email are read from `data.contact`.
- A signed-in account that is not approved sees: "The coach's phone and email appear once your account is approved. You can still send a message below." (`coach-contact-pending-approval`). The message form stays.
- The guest prompt is unchanged.
- The coach's own page still gets its contact details, so Save keeps them.

### Tests

| Level | Test | What it proves |
|---|---|---|
| Unit | `server/lib/publicProfiles.test.ts` (5) | Allowlists, including new columns staying private; the policy for each viewer type; no private value anywhere in the body; marketplace items without `sellerEmail` |
| Route | `server/routes/coachContact.test.ts` (4) | Real router, storage faked. Guest, unapproved, approved, admin and self get the right body. `Cache-Control` is set. The directory never carries contact details. |
| Guard | `uiConsistency.test.ts` | The page reads `data.contact`, never `data.profile.phone/email`; the pending-approval state exists |
| Staging E2E (mutating-core) | `SEC-011` | A run-owned coach with run-owned contact details. The coach and the approved baseline player see them, in the API and the UI. A guest and a fresh, unapproved player don't. The directory never has them. |
| Production-safe | `PROD-SAFE-033` | Guest API contract: keys only, no values read |
| Production-safe | `PROD-SAFE-022` | Unchanged: the guest Contact tab still asks to sign in |

## 2. The 6 failures in `playwright-report-staging-v2.zip` (286 tests: 268 passed, 6 failed, 12 skipped)

| Test | Class | Root cause | Fix |
|---|---|---|---|
| MSG-003 | **APP_BUG** (regression from round 1) | On phones (<1024px) the inbox showed "No messages yet" whenever no conversation was selected. Round 1 stopped auto-opening the newest chat on phones, so a phone user with messages never saw their inbox list. The report shows "No messages yet" next to a "9+" unread badge. | `MessagesInbox.tsx`: the empty state shows only when `messages.length === 0`. |
| MSG-101 | **APP_BUG** | A thread response could land after the reader had opened another conversation, so the second row showed the first row's thread. The newest conversation was also auto-loaded twice: once in `fetchMessages`, once in the selection effect. | `activeConversationIdRef` is set when a row is selected, and a thread response for any other conversation is dropped. The duplicate auto-open is removed; the effect still opens the newest conversation on desktop. |
| MSG-011, MSG-018 | TEST | The validation toast also appears in a screen-reader live region, so the page-wide `getByText(/…|validation error/i)` matched 2-3 elements (strict mode). MSG-011's toast reads "Subject must be at least **3** characters". | Scoped to the toast list (`TOAST_LIST`): exact title "Validation Error" and the exact field rule (`/^(subject\|message) must be at least \d+ characters$/`, MSG-018 `/^message must be at least 5 characters$/`). That is stricter than before. |
| MSG-116 | TEST_OUTDATED | The Users tab offers **Hide** only for approved accounts (`users_tab.tsx`, as designed). A fresh registration is Pending, so there was only Approve, and the click waited out the 180 s test timeout. | Approve the run-owned player first (`approveUser`), then hide. |
| PLAY-001 | TEST_OUTDATED | Staging keeps earlier runs' sessions. The list had 16 sessions at 6 per page, and the new one was not on page 1. | It checks the session is in the unfiltered `GET /api/play/sessions`, then types its unique title, which is a GET filter, not the smart search, and checks the card. |

No assertion was weakened, no timeout raised, and auth, authorisation and rate limits are unchanged.

## Validation

Run here:

- `test:e2e:guard`: 162/162
- `test:ui`: 44/44
- server unit tests: 15/15
- route tests (`coaches`, `coachContact`): 8/8. The real router ran under a minimal Express stand-in, because there is no npm registry here.
- client bundle: 393 modules, 0 errors
- `--list`: 315 tests in 41 files; Production: 33 tests in 1 file

Still to run on your side:

- `npm run check`, `npm run build`, `npm run test:server-unit`, with real Express
- Staging: SEC-001/002/011, MSG-003/011/018/101/116, PLAY-001 and the coach and profile specs
- after release: `npm run test:e2e:prod-safe`. PROD-SAFE-033 fails until the fix is deployed.

## 3. Second pass: profile visibility, policy and business contacts (29 Oct)

### Hidden and unapproved coach profiles: reproduced from the code

`GET /api/coaches/:slug` checked only `role === "coach"` and `profileCompleted`. An **unapproved, hidden, draft or inactive** coach was therefore:

- not in the directory (`getAllCoachesWithProfiles` filters them out);
- but fully reachable by slug, for guests and members alike.

**Fix.** One rule, `isCoachPubliclyVisible()` in `server/lib/publicProfiles.ts`:

- role coach and profile completed;
- profile not a draft;
- approved, not hidden, account active.

The directory query has the same conditions, plus a new "account active" condition: `or(isNull(status), eq(status, "active"))`. A unit test checks that both stay in step.

`coachProfileAccess()` decides who may open a profile:

| Viewer | Visible coach | Not visible (unapproved, hidden, draft, inactive) | Onboarding not finished |
|---|---|---|---|
| Guest | 200 | 404 `{ message: "Coach not found" }` | 404 |
| Approved member (direct link) | 200 | 404 | 404 |
| The coach | 200 | 200 | 404; the page sends them to `/complete-profile` |
| Admin | 200 | 200 | 404 (nothing to show yet) |

- **Frontend:** unchanged. A 404 already sent the page back to `/coaches`.
- **Workflows:**
  - `complete-profile` sends a new, unapproved coach to their own page, which still opens, because they are the owner.
  - Admin review and editing still work.
- **Contacts:** contact details follow the profile. An approved member only ever reaches visible coaches, so "contacts for published, active coach profiles" holds through the API.

### Contact policy (unchanged) and the future Coach Hub preference

- The policy is the one from section 1, now in one place: `coachContactAccess(viewer, coachId, visibility)`.
- `visibility` is the coach's future setting, "Contact visibility: Approved members / Only me":
  - `"approved-members"`: today's behaviour, the default;
  - `"only-me"`: only the coach and admins; others get `contactAccess: "private"`.
- No column or UI is added in this release. Every caller passes `DEFAULT_COACH_CONTACT_VISIBILITY`.
- Spec: `docs/product/coach-contact-visibility-preference.md`.

### Organisation and marketplace contacts

| Data | Decision |
|---|---|
| Organisation `phone`, `email`, `website` | **Kept public.** The organiser types them into the organisation form as business contacts (`insertOrganizationSchema`). Nothing copies the login email into them, on the server or the client. |
| Organisation owner | Only `ownerId`: no owner user object, no login email |
| Marketplace `sellerEmail` | Removed from public listings (section 1). It was set automatically from the seller's login email. The seller's own list still has it. The page's unused `seller_email` mapping is gone too. |
| Marketplace seller name | Public, as before. There is no public seller contact field; buyers use the existing request form. |

### Tests added in this pass

| Level | Test |
|---|---|
| Unit (`publicProfiles.test.ts`, now 9) | The visibility rule for every reason (unapproved, hidden, inactive, incomplete, draft, no profile, not a coach). Profile access for guest, member, owner and admin. The "Only me" preference. The directory query keeps the same conditions. |
| Route (`coachContact.test.ts`, now 6) | Unapproved, hidden, inactive, draft and incomplete coaches are a 404 with the same body for guests and approved members. Owner and admin can open hidden and unapproved profiles. Another coach doesn't count as the owner. |
| Staging `SEC-012` (mutating-core) | Fresh coach: 404 for guests and members, 200 for the coach, not listed, and the page redirects. After approval: public and listed. After hiding: 404 for guests and members, not listed, still 200 for the coach and admins. |
| Staging `SEC-011` | Approves the coach first, because the unapproved state is now SEC-012's job. All its contact checks are unchanged. |
| Staging `SEC-001`/`SEC-002` | Also forbid `failedLoginAttempts` and `lockedUntil`. |
| Production-safe `PROD-SAFE-033` | Also checks that an unknown coach slug is a plain 404 with no data. The id and allowlist entry are unchanged. |

## Remaining risks

- `GET /api/players/:slug` still serves hidden or unapproved **players** by slug. That route only checks role. Same class of issue, outside this coach ticket: follow-up.
- `GET /api/organizer/organizations/by-user/:userSlug` and `/api/profile/marketplace/public/:userId` don't check whether the owner is hidden. They return business data (organisation, items), not contacts.
- Not validated against a real Express, Postgres or browser from here: see the release readiness file.
