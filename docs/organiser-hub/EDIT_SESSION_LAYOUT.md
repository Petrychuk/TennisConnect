# Edit Session page layout

`client/src/pages/organiser/session-edit.tsx` (TC-199). Only the page body changed: the data model, API calls, permissions, status logic and the Cancel / Save Changes buttons are as before.

## Structure
Back to {Session Name} · **Edit Session** · three flat sections (thin border, no shadow, no nested cards) · Cancel / Save Changes.

| Section | Contents |
|---|---|
| Session Details | Name (full width); Venue + City/Timezone; Date + Start + End + Courts |
| Registration | Registration closes (date + time) + Max Players; Pricing; Price (Paid only); Waiting List |
| Session Information | Description; Rules & policies accordion |

Content width is `max-w-[820px]`.

## Responsive
- **Desktop (lg+)**: Date/Start/End/Courts in one row of four; Venue + Timezone and Closes + Max Players side by side.
- **Tablet (sm–lg)**: the four-column row becomes two columns.
- **Phone**: everything stacks except Start | End, which share a row. Buttons stack full width with Save Changes on top. Inputs keep the 40 px height, radios have a 40 px tap row, no horizontal scroll.

## Behaviour
- Price is not rendered when Pricing is Free.
- Rules & policies starts collapsed for every session and shows "Optional", or "Configured" when any policy has text. The four fields live in the page state, so collapsing never clears them and saving works while collapsed.
- Required fields are marked `*`; after the first Save attempt each shows an inline error next to the field (the existing toasts remain).
- One validation was added: a Paid session needs a price above $0 (before, an empty price silently saved the session as free). Everything else is unchanged.
- Drafts are still redirected to the wizard (see DRAFTS.md).

## Tests
E2E `tests/organiser/organiser-edit.spec.ts` (ORG-EDIT-001…007); ORG-WIZ-003 now expands the accordion first. Not run locally (no app); layout checked in a Chromium replica at 1440, 1024, 768, 390 and 360 px.
