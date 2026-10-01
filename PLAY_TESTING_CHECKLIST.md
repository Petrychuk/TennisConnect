# Play, Recommendations, Smart Search & Player Matching — full testing guide

Everything below was written and typechecked, and where possible run through
automated unit tests, but the routes and UI have never been opened in a real
browser or hit a live LLM/geocoding API from where this was built. This is
the structured way to actually verify all of it works, organised by feature
area in the order it was built. Test each section top to bottom; note the
exact step, expected vs actual, and a screenshot when something fails —
that's the format that already found every real bug in this project so far.

## 0. Before you start

- [ ] All migrations 0024 through 0028 are applied
- [ ] `ANTHROPIC_API_KEY` is set if you want to test the real Smart Search AI path —
      without it, Smart Search still works, just always via the safe fallback
- [ ] At least 2-3 test player accounts with completed profiles, and a couple of
      published, non-cancelled sessions in the system

---

## 1. Basic search (nothing regressed)

- [ ] Type a session title into the search box → matching sessions appear
- [ ] Search a venue name → matches
- [ ] Search an organiser name → matches
- [ ] Clear the search box → full list returns

## 2. Quick filters row

- [ ] **Near me** — signed OUT: disabled, tooltip "Sign in to filter by your own area"
- [ ] **Near me** — signed IN with a location set: fills the location filter with your own area
- [ ] **This week** / **This weekend** — toggle on/off, mutually exclusive
- [ ] **Competitions** — only Tournament/League/Club Championship/Junior Event remain
- [ ] Row scrolls horizontally on a narrow screen instead of wrapping/overflowing

## 3. Filters dialog

- [ ] Opens pre-filled with your CURRENT active filters (not blank)
- [ ] Clear all (inside dialog) resets the dialog's own fields only, not the page yet
- [ ] Show results actually applies and closes the dialog
- [ ] "Choose Date" shows an inline date picker
- [ ] Dialog scrolls internally if your window is short (a real bug found and fixed earlier)

## 4. Active filter chips

- [ ] Each active filter shows as a chip; x removes just that one
- [ ] "Clear all" next to the chips clears everything
- [ ] Zero filters -> no chip row at all

## 5. Empty states

- [ ] Filtered to nothing -> "No games found" + working Clear filters
- [ ] Genuinely zero published sessions -> "New games are coming soon" (no clear button)

## 6. Event Quick View Modal

- [ ] Click anywhere on a card, or the View button -> same modal
- [ ] Shows title, status, date/time, location, format, level, players, price, About, organiser
- [ ] Season/Series line only appears when actually part of one
- [ ] Signed out: "Sign in to Register" -> goes to /auth
- [ ] Open session, not registered: "Join Session" (or "Join Competition" for tournament/
      league/club-championship/junior-event) -> toast confirms, becomes Registered
- [ ] Already registered: green "Registered" badge + working Cancel Registration
- [ ] Full + waitlist enabled: "Join Waiting List" -> "On Waiting List" + Leave option
- [ ] Full, no waitlist: disabled "Full"
- [ ] Closed: disabled "Registration Closed"

## 7. Recommended for You / Popular near you

- [ ] Signed out: section doesn't appear at all
- [ ] Profile has 2+ signals (level/availability/format/style-or-looking-for): "Recommended
      for You" heading, each card shows "N% match" + 1-3 plain-English reasons
- [ ] Brand-new/mostly-empty profile: "Popular near you" instead, NO percentage badge at all
      on any card - this is the one to double-check carefully
- [ ] Any search/filter active -> whole section disappears; clear it and it reappears
- [ ] Max 4 cards, ever
- [ ] Opening a recommended card's modal shows "Great match for you" + reasons; a normal
      search result's modal does not
- [ ] A session you're already registered for, a full-no-waitlist one, or one with a level
      far from yours is simply absent from this section (not just low-scored)

## 8. Availability nudge

- [ ] Signed in as a player with NO availability set, no active filters: "Get better
      recommendations / Add availability" banner appears above Recommended/Popular
- [ ] Clicking "Add availability" opens a small dialog, Save persists it and the
      recommendations section re-ranks
- [ ] The X on the banner dismisses it for this session without saving anything
- [ ] Once availability is set, the banner doesn't reappear

## 9. Players Looking to Play (on /play)

- [ ] Section appears (signed in, no active filters) whenever at least one OTHER player
      has an active Looking to Play status
- [ ] Each card: avatar, name, level, location, "Looking to play" indicator, either
      "N% match" + reasons or "Potential match" (never a fake percentage)
- [ ] "See all players" opens /players?lookingToPlay=true pre-filtered
- [ ] Max 4 cards
- [ ] A player who turned their status off, whose status expired, or is yourself never
      appears here

## 10. Looking to Play toggle (on your own profile)

- [ ] OFF state: "Want to play?" prompt with an "I'm looking to play" button
- [ ] Clicking it opens a small dialog: When (Today/This week/This weekend), What (Singles/
      Doubles/Either)
- [ ] Saving shows the ON state with when/format and a "Turn off" option
- [ ] "Turn off" immediately reverts to the OFF state
- [ ] Expiry: turn on "Today", then manually set the DB's looking_to_play_expires_at to the
      past - the status should stop counting as active everywhere even though
      looking_to_play_enabled itself is still true
- [ ] Only visible on your OWN profile, never a visitor's

## 11. Good Match for You (on another player's profile)

- [ ] Viewing another player while signed in, with enough shared signal: shows a match
      card, percent + reasons
- [ ] With no real signal in common: card doesn't render (not a fake/zero %)
- [ ] "Suggest a game" opens the invite modal with a friendly prefilled message
- [ ] Not shown on your OWN profile, or when signed out

## 12. Players directory filter

- [ ] Arriving via ?lookingToPlay=true shows only players with an active status
- [ ] The desktop filter chip toggles the same filter manually
- [ ] Combines correctly with the existing level filter and search box

## 13. Invite to Play + Accept/Decline

- [ ] Sending an invite opens the message modal with a friendly prefilled message, editable
- [ ] The recipient (a second test account) sees Accept/Decline buttons on that specific
      message, not just plain text
- [ ] Accept -> "You're playing!" status, no separate Session gets created anywhere
- [ ] Decline -> "Invitation declined", buttons gone
- [ ] A plain "Message" (not an invite) never shows Accept/Decline buttons
- [ ] Double-accepting, or responding as someone who isn't the recipient, is rejected

## 14. Smart Search - works without AI at all

- [ ] With ANTHROPIC_API_KEY unset, typing a query still returns results via plain text
      search, with a "couldn't understand" note
- [ ] A plain name/venue/organiser query still works exactly as before

## 15. Smart Search - with a real ANTHROPIC_API_KEY set

Try each of these and check the interpretation makes sense (not an exact match test):

Doubles Saturday morning | Competition around my level | Social tennis near me |
Anything this weekend? | Singles in Bondi | Round robin within 10 km |
Something relaxed after work | Wolli Creek Tennis | Find someone to hit with Sunday |
unclear/garbled text (safe fallback expected)

- [ ] Profile override: set your format to Doubles, search "Singles Sunday" -> results are
      Singles, not Doubles
- [ ] Results show real match percentages (same engine as Recommended for You) - this was a
      bug found and fixed mid-session, worth confirming specifically
- [ ] "Showing matches for: ..." chips appear when AI interpreted something; Clear resets
      (no per-chip editing - a known simplification)
- [ ] No-results shows suggestions that, when clicked, actually return something
- [ ] "Find someone to hit with Sunday" returns real matched players, not "coming soon"

## 16. Distance / geocoding

- [ ] Save a location matching the curated table exactly (Bondi Beach, Manly, Sydney CBD,
      Wolli Creek, Parramatta, Coogee, Chatswood, Rose Bay, Rushcutters Bay, Paddington,
      Kingsford, Homebush, Moore Park, Eastern Suburbs) -> coordinates set instantly
- [ ] Save an uncommon location somewhere with real network access -> triggers a real
      Nominatim call, a new geocode_cache row appears with source = nominatim
- [ ] Save that same uncommon location again (different player) -> resolves instantly from
      cache, no second external call
- [ ] Two players with coordinates + a playRadiusKm -> distance actually contributes to
      Match Score (full credit inside radius, partial to 2x it, zero beyond)
- [ ] Same for a coach's location and a club's suburb/address (admin club routes) - one
      shared service backs all three

## 17. Mobile (~375-430px) and tablet (~768-1024px)

- [ ] Hero doesn't dominate the first screen on mobile
- [ ] Quick filters row scrolls with a normal touch swipe
- [ ] Filters dialog fits the screen and scrolls internally if taller than it
- [ ] Filter chips wrap cleanly
- [ ] Session/player cards: image/avatar on top, content below
- [ ] Match badges don't overflow or clip on a narrow card (a real bug found earlier)
- [ ] Modals/dialogs are fully usable without horizontal scrolling
- [ ] Tablet doesn't look like a broken half-mobile/half-desktop state

## 18. Analytics

- [ ] play_recommendation_impression / _open / _join fire with activityId/matchScore/
      position/format
- [ ] play_smart_search fires on every submit; exactly one of _success / _no_results /
      _fallback follows - never the raw query text
- [ ] play_player_recommendation_impression / play_player_profile_open /
      play_player_invite_sent fire for player matching
- [ ] play_player_invite_accepted / _declined fire only for play_invite-type messages
- [ ] looking_to_play_enabled / _disabled fire from the profile toggle

## 19. Discovery Agent (Admin -> Discovery)

Needs the migrations 0029 and 0030 applied and, for real extraction, `ANTHROPIC_API_KEY`.
Do the DRY RUN steps first - they write nothing.

**Pilot sources** (add from the Sources tab; `npm run seed:discovery-pilot` does it in dev):
- Tennis Victoria - What's On | `https://www.tennis.com.au/vic/events/whats-on` | Tennis organisation | VIC
- Strathfield Sports Club - Saturday Social | `https://strathfieldsportsclub.com.au/events/saturday-social-2026-08-01/` | Club | NSW | Sydney
- Queensland Tennis Centre - Social Tennis | `https://www.queenslandtenniscentre.com.au/adults/programs-fixtures/social-tennis/` | Club | QLD | Brisbane

**Pilot dry run - pass criteria** (run Discovery with Dry run ticked, all three sources):
- [ ] Sources scanned = 3, Pages checked > 0
- [ ] Potential events > 0 and Valid > 0 (at least one real activity structured)
- [ ] Nothing appears in the queue or in /play afterwards (dry run writes nothing)
- [ ] Problems (if any) name the source and give a reason - an *Unsupported ... JavaScript*
      reason means that page was skipped on purpose, not that the run broke
- [ ] Then run ONE source for real: its items are in Pending, with the right source name and
      link ("View Source"), the recurring ones (Strathfield, QTC) show a weekday not a date,
      and anything the page didn't state (level, price, times, city) is blank - not filled in
- [ ] Expect Tennis Victoria's already-passed events (e.g. Pride Cup, 12 Sep) to be rejected,
      not published

**Sources tab**
- [ ] Add a source (name, main page, type, state). It appears in the list as "Never scanned".
- [ ] Try adding `http://localhost/x` or `file:///etc/passwd` - it is refused.
- [ ] Add up to 5 "Additional pages" (one per line); the card shows "+N more pages".
- [ ] The Enabled switch pauses/resumes the source.

**Dry run**
- [ ] Sources tab -> Run on one source, "Dry run" ticked. It shows "Running...", then a summary
      (sources, pages, potential events, valid, duplicates, needs review, rejected) and any
      problems. Nothing appears in the queue.
- [ ] A source with a broken URL reports a problem but the run still completes.

**Real run + review queue**
- [ ] Untick Dry run on ONE trusted source. Items appear in Pending (counts on the tabs match).
- [ ] Run the same source again straight away: no duplicate rows appear; unchanged pages are
      skipped ("Last checked" moves).
- [ ] An item that was flagged shows "Why it's here: ..." in plain English.
- [ ] Edit an item (date, state, level, price, link). A bad link (`javascript:...`) or a bad
      date is refused with a clear message. Changing the state updates the time zone.
- [ ] Approve / Reject / Duplicate move the item to the right tab and the counts update.

**In Play**
- [ ] An approved item appears in /play labelled "Found by TennisConnect", with a match score
      like any other activity.
- [ ] Click it: the Quick View LOADS (source, last checked, "View original"), and there is NO
      "Join Session" button - even when signed out.
- [ ] A recurring session ("every Thursday") appears as several upcoming dates, each opening
      its own Quick View.
- [ ] Smart Search "social doubles Sunday morning around <a city you added>" can return it.
- [ ] Rejected / pending / expired items never appear.

**Freshness**
- [ ] Change something material on a test source page (price/time), re-run: the approved item
      moves to Needs Review as "Changed at source" with the diff, and leaves Play until
      re-approved.
- [ ] Remove an event from a test page, re-run: it goes to Needs Review but stays in Play.

## 20. Partner Events (Admin -> Discovery)

Needs migration 0032 applied.

**Primary path - confirm an existing Discovery find**
- [ ] On an EXTERNAL item (not yet Partner), click "Confirm as Partner", enter a partner name
      (leave partner ID blank for an unregistered club), save.
- [ ] The item now shows a "Partner" badge, and it's still the SAME item (no second row, counts
      on the tabs don't change by one extra).
- [ ] If it was already Approved and visible in Play, it still is - now with "TennisConnect
      Partner ✓" and "Register on partner website ↗" instead of "Found by TennisConnect" /
      "View original ↗".
- [ ] If it was Pending, it stays Pending - Approve is still a separate step.

**Fallback path - create from scratch**
- [ ] "+ New Partner Event": fill in title, partner name, a registration link, a day/time -
      save. It lands in Pending with a Partner badge.
- [ ] Leave the registration link blank: rejected with a clear error (this path requires one).
- [ ] Enter a partner organisation ID that doesn't exist: rejected, not silently ignored.

**Dedup priority (TENNISCONNECT -> PARTNER -> EXTERNAL)**
- [ ] Create a new Partner Event that duplicates an existing approved EXTERNAL item (same
      title/venue/time) - it should show a "possible duplicate" badge pointing at that item.
- [ ] Approve it: the OLD EXTERNAL item moves to Rejected/Duplicate on its own, and only the
      Partner Event shows in Play - never both.
- [ ] Approving an ordinary Partner Event that ISN'T a duplicate of anything touches no other
      item.

**Internal registration (a partner already registered as a TC organiser)**
- [ ] That organiser creates a session the normal way (nothing different here).
- [ ] An admin can mark that session as an official Partner Event; it still shows a normal Join
      button (internal registration), with the Partner badge in place of "Organised by X".

## If something fails

Note which checklist item, what you expected vs what you saw, and ideally a screenshot -
this exact format already found real bugs: the photo-delete button overlapping the dialog
close X, a missing photos field mapping, several DialogTitle accessibility warnings, a flex
child missing min-w-0 causing overflow, a Game Format signal that could never actually
match anything, and a migration that altered the wrong table entirely. All were real, all
were fixed the same way - a precise repro turned into a targeted patch.
