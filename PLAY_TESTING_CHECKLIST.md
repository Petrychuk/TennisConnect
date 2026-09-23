# Play page v2 + Recommendations — manual testing checklist

Everything below was written and typechecked but never opened in a real
browser on my end — this is the checklist to actually verify it. Organised
so you can go top to bottom once on desktop, then repeat the mobile/tablet
section separately.

## 1. Basic search still works (nothing regressed)

- [ ] Go to `/play`, type a session title into the search box → matching sessions appear
- [ ] Search a venue name → matches
- [ ] Search an organiser name → matches
- [ ] Clear the search box → full list returns

## 2. Quick filters row

- [ ] **Near me** — signed OUT: button is disabled (greyed, tooltip on hover: "Sign in to filter by your own area")
- [ ] **Near me** — signed IN as a player with a location/preferred area set: click it → location filter fills in with your own area, results update
- [ ] **This week** — click once → highlights, results filter to this week; click again → toggles off
- [ ] **This weekend** — same toggle behaviour, and mutually exclusive with This week (picking one doesn't leave the other highlighted)
- [ ] **Competitions** — click → only Tournament/League/Club Championship/Junior Event sessions remain; click again → toggles off
- [ ] **Filters** button opens the dialog (see section 3)
- [ ] On a narrow window, the row scrolls horizontally instead of wrapping or overflowing the page

## 3. Filters dialog

- [ ] Open Filters → Location, Date (radio list), Format (dropdown), Level (dropdown) all show your CURRENT active filters pre-filled (not reset to blank)
- [ ] Change a few fields, click **Clear all** *inside the dialog* → dialog's own fields reset to blank/Any, but the page behind it is unchanged (dialog hasn't closed yet, nothing applied)
- [ ] Now set some fields and click **Show results** → dialog closes, results actually reflect what you picked, chips (section 4) appear
- [ ] Pick "Choose Date" → a date picker appears inline; picking a date and Show results filters to that exact day
- [ ] Dialog content is fully visible and scrollable if your window is short (this was a real bug I found and fixed — worth double-checking specifically on a small laptop window or with the browser zoomed in)

## 4. Active filter chips

- [ ] With any filter active, a chip row appears below quick filters showing each active filter by name (location text, date label, format label, level, "Competitions")
- [ ] Click the × on one chip → that filter clears, results update, chip disappears, others remain
- [ ] "Clear all" next to the chips clears everything at once
- [ ] With zero filters active, the whole chip row is gone (not an empty bar)

## 5. Empty states

- [ ] Apply filters that can't match anything (e.g. an obscure location + a specific date far away) → "No games found / Try changing your date, location or filters" + a Clear filters button that actually works
- [ ] With zero filters, if there are genuinely no published sessions at all in the environment you're testing against → "New games are coming soon" (no filter-clearing button, since there's nothing to clear)

## 6. Event Quick View Modal

- [ ] Click anywhere on a card (not just the View button) → modal opens
- [ ] Click the View button specifically → same modal opens
- [ ] Modal shows: title, status badge, date/time, location, format, level, player count, price (if set), About text, organiser name+avatar
- [ ] Season/Series line ("Part of ...") only appears when the session actually belongs to one — check both a standalone session and a season-linked one if you have both in test data
- [ ] **Signed out**: primary button says "Sign in to Register", clicking it goes to `/auth`
- [ ] **Signed in, open session, not registered**: button says "Join Session" (or "Join Competition" for tournament/league/club-championship/junior-event types) — click it → toast confirms, button becomes "Registered" state
- [ ] **Already registered**: green "Registered" badge + "Cancel Registration" button — cancelling works and reverts the state
- [ ] **Waitlist-enabled full session**: button says "Join Waiting List"; after joining, "On Waiting List" + "Leave Waiting List"
- [ ] **Full, no waitlist**: button disabled, says "Full"
- [ ] **Registration closed**: button disabled, says "Registration Closed"
- [ ] Closing the modal (X, clicking outside, or Cancel Registration flow) doesn't leave you on a broken/blank page — you're back on `/play` with the list intact

## 7. Recommended for You / Popular near you

- [ ] **Signed out**: no recommendations section appears at all
- [ ] **Signed in, profile has 2+ of (level, availability, format, play style/looking-for)**: section heading is "✨ Recommended for You", each card shows an "N% match" badge with 1-3 plain-English reasons (never a reason code, never scoring jargon)
- [ ] **Signed in, brand-new/mostly-empty profile**: section heading is "Popular near you" instead, and cards show NO percentage badge at all — this is the important one to confirm, since it's easy to accidentally leave a stray "0% match" or a badge showing anyway
- [ ] Apply ANY search or quick filter → the whole Recommended/Popular section disappears entirely (personalisation must never fight your explicit request) — clear the filter and it reappears
- [ ] At most 4 cards ever show in this section, regardless of how many eligible sessions exist
- [ ] Opening a recommended card's modal shows the "✨ Great match for you" banner with reasons; opening a normal search result's card does NOT show that banner
- [ ] A session you've registered for, one that's full-with-no-waitlist, or one requiring a level far from yours never appears in this section at all (not just low-scored — actually absent)

## 8. Mobile (~375–430px wide) and tablet (~768–1024px)

- [ ] Hero doesn't dominate the whole first screen on mobile (compact photo strip + headline + search, no huge dead space before you reach any content)
- [ ] Search input is fully usable (no clipped placeholder text, keyboard doesn't cover it awkwardly)
- [ ] Quick filters row scrolls sideways with a normal touch swipe, nothing gets cut off at the right edge with no way to reach it
- [ ] Filters dialog: fits the screen width without horizontal scrolling, is tall enough content still reachable by scrolling within the dialog (this is the fix from section 3 — check it for real on an actual small screen, not just a resized desktop browser)
- [ ] Filter chips wrap onto multiple lines cleanly instead of overflowing off-screen
- [ ] Session cards: image on top, content below (not squeezed side-by-side) — confirm this still holds now that cards can also show a recommendation badge
- [ ] Recommendation match badge doesn't get cut off or overlap other text on a narrow card
- [ ] Event Quick View Modal: fits the screen, every field readable without horizontal scrolling, the Join/Registered button is reachable (not hidden below the fold with no scroll)
- [ ] Pagination controls (when there are enough results) don't overflow the screen width
- [ ] Tablet specifically: confirm nothing is stuck in an awkward "half mobile, half desktop" state — most of this page only has one breakpoint jump (sm) rather than a distinct tablet layout, so tablet should look like a slightly wider version of mobile, not broken

## If something fails

Note which checklist item, what you expected vs what you saw, and ideally a
screenshot — that's exactly the format that's worked well for finding the
real bugs earlier in this project (the photo-delete button overlap, the
missing `photos` field mapping, the DialogTitle warnings were all found
this way).
