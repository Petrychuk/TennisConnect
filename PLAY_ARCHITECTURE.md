# Play — Architecture Documentation (Tasks 1–4, cycle complete)

**Branch:** `feature/play-page-v2`
**Scope:** Play Foundation → Personalised Event Matching → AI Smart Search → Player Matching

## The chain

```
Task 1 — Play Foundation            "What can I play?"
Task 2 — Personalised Event Matching "What of this suits ME?"
Task 3 — AI Smart Search             "I just tell TC what I want."
Task 4 — Player Matching             "Who do I play WITH?"
```

Each task is a layer on top of the previous one, not a parallel system:

```
Player Profile
      ↓
Play Foundation (search + filters + real, published sessions)
      ↓
Recommendation Engine (deterministic Match Score, Task 2)
      ↓
AI Smart Search (interprets intent → structured criteria → same engine, Task 3)
      ↓
Player Matching Engine (same weighting/exclusion principles, applied to people, Task 4)
```

One consequence of building it this way: **there is exactly one deterministic scoring
engine per matching type** (events, players), reused everywhere that type of match is
shown — Play's own list, Smart Search results, and the Profile page's "Good Match for
You". No feature has its own separate copy of the scoring logic.

---

## Task 1 — Play Foundation

**Question answered:** what tennis activities exist right now that I could join?

### What changed from the old Play page

- Removed the permanent sidebar filter (and the separate mobile 2x2 grid) entirely.
- Replaced with a compact quick-filter row + a single `Filters` dialog that works
  identically on every breakpoint.
- Removed the separate Session Details page from the normal discovery flow — clicking a
  card opens `EventQuickViewModal` instead. The old page (`play-session-details.tsx`)
  still exists for direct/shared links, it's just no longer how discovery gets there.

### Components (`client/src/components/play/`)

| Component | Responsibility |
|---|---|
| `session-card.tsx` (`PlaySessionCard`) | The one card used everywhere an event is shown — Play's list, Recommended for You, Smart Search results, the homepage. Takes an optional `recommendation` prop; a plain search result never passes it. |
| `ActivityStatus.tsx` | The player-facing status badge (Registration Open / Almost Full / Full / Waitlist / Registered / etc.) — one source of truth, used by the card and the modal. |
| `PlayQuickFilters.tsx` | Near me / This week / This weekend / Competitions / Filters row. Pure props-in/callbacks-out. |
| `PlayFilters.tsx` | The Filters dialog (Location, Date, Format, Level). Operates on a single draft object the parent owns. |
| `PlayEmptyState.tsx` | `PlayNoMatches` / `PlayNoActivitiesYet` — the two spec-mandated empty states. |
| `EventQuickViewModal.tsx` | Full event detail + registration action (Join/Join Competition/Join Waiting List/Registered/Closed/Full), reusing the exact join/leave mutations already built for the standalone details page. |

### Backend (`server/routes/play.ts`)

- `GET /api/play/sessions` — the base query. Only returns published, non-draft,
  non-cancelled, non-archived, non-private, non-completed sessions (existing
  `storage.getPublicSessions` filtering, unchanged by this cycle).
- `GET /api/play/sessions/:id` — full details for the modal, including the caller's own
  `myRegistrationStatus` when signed in.

### "Competitions" quick filter

There's no single underlying format value for "any competition" — it's a client-side
post-filter grouping 4 session types: `tournament`, `league`, `club-championship`,
`junior-event`. This same grouping is reused wherever "is this a competition" needs to be
answered (Task 2's Join Competition wording, Task 3's intent parsing).

---

## Task 2 — Personalised Event Matching

**Question answered:** of everything in Task 1, what actually suits me?

### The engine (`server/services/recommendationEngine.ts`)

Deterministic. No LLM. Fixed weighting:

| Signal | Weight |
|---|---|
| Level compatibility | 30 |
| Availability | 25 |
| Distance/location | 20 |
| Game format | 15 |
| Intent / play style | 10 |

Two separate concerns, deliberately kept apart:

- **`isEventEligibleForPlayer`** — hard exclusions. A full/closed event, or a player whose
  level is 2+ steps from the event's required level, is *removed*, never scored low. This
  is what stops "UTR 5.0+ event, UTR 3.7 player → 43% match" from ever happening.
- **`computeRecommendation`** — scores only what's actually known. A missing signal is
  excluded from *both* the matched and available totals — never counted as a mismatch.
  `score = round(matched / available * 100)`, and `available` can be less than 100 for an
  incomplete profile. Returns symbolic reason codes (`SIMILAR_LEVEL`, `NEARBY`, etc.), never
  a raw percentage breakdown — the UI does the English translation.

**Distance** uses real haversine calculation against `latitude`/`longitude` (added to
`player_profiles` and `sessions`), with the linear-falloff-to-2x-radius scoring the spec
asked for. It only contributes when both sides actually have coordinates (see the
Geocoding section below) — otherwise it's excluded like any other missing signal, never
faked from a text match on suburb names.

**Game format** was found to be silently broken during Task 3's build: the signal added
its full weight to `available` whenever a player had a format preference, but no event
ever exposed a real singles/doubles field to match against — every such player was
permanently scored down for a signal that could never succeed. Fixed by gating the signal
on the event actually having the data (currently: none do, so it's inert until that field
exists on sessions).

### Low-data handling

`hasEnoughSignalForPersonalisation` gates the whole feature: a brand-new profile with
almost nothing set sees **"Popular near you"** (sorted by soonest-starting, zero match
badges shown at all) instead of a personalised — and dishonest — "94% match" on data that
doesn't exist yet. This is a genuinely different code path, not just a different heading:
the API response sets `recommendation: null` on every item in the low-data case, and the
card component only renders a percentage when that's non-null.

### UI

- "✨ Recommended for You" / "Popular near you" section on `/play`, max 4, **hidden
  entirely** whenever the player has an active search or filter — personalisation never
  overrides an explicit request, by construction (the section just doesn't render).
- `EventQuickViewModal` shows a "✨ Great match for you" banner + reasons when opened from
  a recommended card.
- `AvailabilityNudge` — a small, dismissible "add your availability" prompt shown only when
  that specific signal is missing, opening a tiny inline dialog (not a Settings redirect).

### Analytics

`play_recommendation_impression` / `_open` / `_join` — `activityId`, `matchScore`,
`position`, `format`. `_join` only fires from a real join-mutation success, and only when
the session being joined was opened from a recommendation context.

---

## Task 3 — AI Smart Search

**Question answered:** let me just say what I want in plain English.

### Core principle enforced end to end

**AI interprets. AI never invents, never scores.** The flow is:

```
Player's text query → LLM → validated structured intent → real DB query
                                                          → same Recommendation Engine
                                                          → results
```

The LLM's job stops at producing `{ intent, gameFormat, dateFrom, ... }`. Every actual
match percentage on a Smart Search result comes from the same `computeRecommendation`
used everywhere else — this was a real gap found and fixed mid-cycle (Smart Search
originally returned raw, unscored results).

### Backend (`server/services/smartSearchEngine.ts`)

- `playSearchIntentSchema` (Zod) — the actual enforced contract. Nothing downstream ever
  touches unvalidated model output.
- `buildSmartSearchPrompt` — pure function, no network. Explicitly instructs the model:
  explicit query values always override profile preferences; never invent a numeric
  level/UTR; `FIND_PLAYER` only for "find a person" requests, never events; a safe
  `TEXT_SEARCH` fallback whenever it isn't confident.
- `parseSmartSearchResponse` — strips an accidental markdown fence, validates against the
  schema, returns `null` (never throws) on anything invalid.
- `callSmartSearchLLM` — the only function that touches the network. Raw `fetch` to
  Anthropic's Messages API (`claude-haiku-4-5-20251001`, the cheapest/fastest tier — no
  SDK dependency added), 6s timeout. Returns `null` on *any* failure: missing API key,
  timeout, non-200, unparseable/invalid response.
- `matchesTimeOfDay` — deterministic morning/afternoon/evening check in the **event's own
  IANA time zone**. The spec is explicit the LLM must never judge this itself; this is the
  real backend filter that does.

### Route (`POST /api/play/smart-search`)

1. Builds minimal player context (level, preferred area, distance, format, style,
   availability — **never** email/DOB/photos/account data) if signed in.
2. Calls the LLM; falls back to `{ intent: TEXT_SEARCH, query: <original text> }` on any
   failure.
3. Resolves profile-deferred fields (`usePlayerLocation`, `usePlayerPreferences`,
   `levelMode: PLAYER_LEVEL`) — only when the intent itself asks for them, never silently.
4. Runs the existing `getPublicSessions` query with the resolved criteria, then the
   time-of-day filter.
5. **Scores every eligible result via the Task 2 engine** and sorts by score. An event
   failing the engine's own hard-eligibility check stays *in* the results (the player
   explicitly searched for it) with `recommendation: null` — different from Task 2's own
   list, which excludes it outright.
6. `FIND_PLAYER` intent branches to the Task 4 matching engine instead (see below) —
   real matched players, not a placeholder message.
7. On zero results: tries a handful of deterministic relaxations (drop the date range,
   drop location, drop format) and only offers a suggestion that's *verified* to actually
   return something.

### Frontend

- Placeholder: "What would you like to play?" + 3 clickable example queries.
- Runs on Enter/submit, not per keystroke (cost/latency).
- "Showing matches for: ..." chips when AI understood something; one "Clear" resets to
  normal browsing — **known simplification**: clearing is all-or-nothing, not per-field
  editing of the AI's interpretation (that would need mapping free-form AI output back into
  the page's own typed filter state).
- A fallback note ("We couldn't understand all of that...") when the AI call didn't
  succeed — search still works, just as plain text.

### Safety / cost controls

- `smartSearchLimiter` — 15 requests/minute, **keyed by user id** (not IP), layered on top
  of the router-wide 120/min general limiter. Caps worst-case spend per account without
  punishing a shared office/club IP for one person's bug or bot.
- Structured logs: `smart_search_ai_success` (with resolved intent), `smart_search_ai_error`
  (with a reason: `no_api_key` / `non_200` / `invalid_json_or_schema` / `timeout` /
  `network_error`), `smart_search_rate_limited` — for reviewing real usage after this has
  been live a while, before deciding whether caching/prompt optimisation is worth it.
- Cost profile at current settings: ~600 tokens system prompt + 20–60 tokens
  query/profile context + ≤300 tokens output (real JSON responses are usually well under
  that cap). Already on the cheapest model tier.

---

## Task 4 — Player Matching

**Question answered:** who else is around and up for a game?

### Looking to Play status

New `player_profiles` columns: `looking_to_play_enabled`, `looking_to_play_when`
(`today` / `this_week` / `this_weekend`), `looking_to_play_format` (`singles` / `doubles` /
`either`), `looking_to_play_expires_at`.

**Self-expiring by construction** — `computeLookingToPlayExpiry` calculates the real expiry
at the moment the player turns it on (today → end of day; this_week → +7 days; this_weekend
→ end of the upcoming Sunday). `isLookingToPlayActive` checks `enabled AND now < expiresAt`
everywhere the status is consulted — there's no cron job flipping a boolean, and a status
left on for months can never silently keep counting as active.

UI: a small card on the player's own profile (`LookingToPlayCard`) — OFF state is "Want to
play?" + a button; ON opens a tiny inline dialog (When/What), never a separate settings
page.

### The engine (`server/services/playerMatchEngine.ts`)

Same principles as Task 2's engine, deliberately: no LLM, fixed weighting (Level 30,
Availability 25, Distance 20, Format 15, Intent 10), missing-signal exclusion, hard
exclusions kept separate from scoring.

- **`isPlayerEligibleForMatching`** — hard exclusions: self, blocked, deactivated/suspended
  account, hidden from discovery, expired/disabled Looking to Play. A failing candidate is
  removed entirely.
- **`computePlayerMatch`** — symmetric two-player scoring. Distance is the same real
  haversine calculation as Task 2's event distance.
- **`hasEnoughSignalForPlayerMatch`** — the "Potential match" (no fake %) vs a real
  percentage gate.

**Known infrastructure gap, not a bug:** `isBlocked` is a real input the engine correctly
excludes on, but nothing in this codebase populates it — there's no block/relationship
table anywhere in the schema yet. `accountStatus`/`isHiddenFromDiscovery` map to the
already-existing `users.status`/`users.isHidden` fields.

### One matching service, three surfaces

The exact same engine + exclusion logic powers:

1. **`GET /api/play/players-looking`** — the "👥 Players Looking to Play" section on
   `/play`, max 4, requires the candidate's Looking to Play status to be currently active.
2. **`GET /api/play/player-match/:userId`** — the profile page's "Good Match for You".
   Deliberately does **not** require the target to be actively Looking to Play — viewing a
   specific profile and asking "are we compatible" isn't the same request as "who's up for
   a game right now."
3. **Smart Search's `FIND_PLAYER` intent** (Task 3) — same underlying `getMatchedPlayers`
   helper as (1), reused rather than duplicated.

`PlayerMatchCard` is the one card component used across all three surfaces.

### Invite to Play — real Accept/Decline, no new subsystem

Found existing infrastructure for exactly this need: `messages` already has a
`messageType` + `actionStatus` system for actionable invitations (`community_invite`,
`session_invite`), with a full Accept/Decline UI already built. Added `play_invite` as a
third type instead of building a parallel mechanism.

- Only `messageType: "play_invite"` (a single literal, not the full enum) is accepted from
  a regular sender's own request body on the public `POST /api/messages` — the other two
  types grant real access (org membership, session registration) and stay
  organiser-action-only.
- Accepting/declining a `play_invite` has **no side effect** beyond flipping the message's
  own status — "do not require the players to create an official Session just to arrange a
  casual hit." Accept shows "You're playing! 🎾 / Arrange the exact time and court in this
  conversation."
- Analytics: `play_player_invite_sent` (fires from the actual send-success handler, not on
  opening the modal — a real bug caught and fixed mid-cycle), `play_player_invite_accepted`
  / `_declined` from the Messages Accept/Decline action.

### Directory integration

`GET /api/players` now includes an expiry-checked `lookingToPlay` boolean per player.
`/players?lookingToPlay=true` (what Play's own "See all players" link sends) filters the
existing directory — no second player directory was built.

---

## Geocoding (cross-cutting, built to support Tasks 2 & 4's distance signal)

**Problem:** Task 2 and Task 4 both want real distance, but this app had no coordinates
anywhere and no geocoding provider configured.

**`server/services/geocodingService.ts` — `resolveCoordinates(location)`**, one shared
service for players, coaches, clubs, and sessions alike:

1. Checks a small hand-curated table (`server/lib/knownLocationCoordinates.ts`) — the
   handful of locations that actually appear in this app's own seed data (Bondi Beach,
   Manly, Sydney CBD, Wolli Creek, Parramatta, etc.) — instant, no network.
2. Checks the shared `geocode_cache` DB table (one cache for every entity type — a suburb
   is only ever looked up externally once, no matter who typed it first).
3. Falls back to OpenStreetMap's Nominatim (free, no API key) — only reached when neither
   of the above has it — and caches the result permanently.

Returns `null` (never throws) when nothing resolves, at every step — the same "signal
unavailable" contract the matching engines already expect.

**Wired into:** `PUT /api/me/player-profile`, `PUT /api/me/coach-profile`,
`POST`/`PUT /admin/clubs` (clubs, not "organizations" — two separate tables in this
schema; the latter was tried first and reverted once its own update schema turned out not
to validate location fields at all).

**A real migration bug was caught and fixed here too:** the first version of this
migration ran `ALTER TABLE "organizations"`, but the new schema columns actually lived on
`"clubs"` — would have added dead columns to the wrong table and left the real target
missing them, breaking the first insert/select that touched them.

---

## Data model summary (all new columns/tables this cycle)

| Table | New columns |
|---|---|
| `player_profiles` | `sex`, `looking_for`, `game_format`, `play_style`, `availability`, `play_radius_km`, `court_surface_preference`, `photos`, `playing_hand`, `availability_status`, `latitude`, `longitude`, `looking_to_play_enabled`, `looking_to_play_when`, `looking_to_play_format`, `looking_to_play_expires_at` |
| `sessions` | `latitude`, `longitude` |
| `coach_profiles` | `latitude`, `longitude` |
| `clubs` | `latitude`, `longitude` |
| `messages` | (pre-existing `messageType`/`actionStatus` — `"play_invite"` is a new *value*, not a new column) |
| `geocode_cache` (new table) | `location` (PK), `latitude`, `longitude`, `source`, `created_at` |

Every new player_profiles/sessions/coach_profiles/clubs column is nullable — no backfill
required, no existing row breaks.

---

## Known gaps (honest, not hidden)

- **No real geocoding data yet at scale** — the curated table covers a handful of common
  Sydney locations; Nominatim covers everything else *once someone saves that location for
  the first time*. Distance simply doesn't contribute to any score until both sides of a
  comparison have coordinates.
- **No player-blocking mechanism** — `playerMatchEngine`'s `isBlocked` input has nothing
  real feeding it yet.
- **Smart Search's chip-clearing is all-or-nothing**, not per-field editing of the AI's
  interpretation.
- **Game format isn't a real filterable/scoreable field on sessions** — `PublicSessionCard`
  has no singles/doubles/mixed column; both the Smart Search filter and the recommendation
  engine's Format signal are inert pending that field existing.
- **Invite Accept/Decline has no distinct "invite" object** beyond the message itself —
  by design (spec explicitly avoids requiring an official Session for a casual invite), but
  worth knowing there's nothing to query "how many pending invites does X have" from
  directly.
- **Reusable component extraction (spec section 14) is partial** — `PlaySearch` itself was
  never pulled out of `play.tsx`; the quick filters, filter dialog, empty states, activity
  status, and player match card all were.

## Testing

- **Automated, unit-level:** `server/services/recommendationEngine.test.ts` (27 tests),
  `playerMatchEngine.test.ts` (27 tests), `smartSearchEngine.test.ts` (13 tests) — 67 total,
  run via `npx tsx <file>`, no test framework dependency added. Cover every deterministic
  scoring/exclusion/expiry/parsing rule across all three engines. The LLM call itself and
  the live Nominatim call are the two things nothing here can unit-test — both are isolated
  into single, small functions (`callSmartSearchLLM`, the Nominatim fetch inside
  `geocodingService.ts`) specifically so everything *around* them stays testable even
  though they aren't.
- **Manual:** `PLAY_TESTING_CHECKLIST.md` (repo root) — 18 sections covering every user-facing
  behaviour across all four tasks, written for exactly this "cycle just finished" moment.
