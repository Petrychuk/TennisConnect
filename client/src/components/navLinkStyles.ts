// Header links (desktop, 16px - 14px read as too small). Readability first:
// - idle: the full foreground colour (near-black) in semibold - never a
//   lighter grey - on the header's near-opaque light background (~18:1);
// - hover / active: --primary-text, the darker brand green (~5:1 on the
//   header background; plain --primary lime is only ~2:1 as text);
// - active also gets bold weight, an underline bar and aria-current, so
//   it is never signalled by colour alone;
// - keyboard focus: a 2px ring in --ring (dark green in light mode).
export const NAV_LINK_BASE =
  "relative rounded-sm px-1 py-1 text-base transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const NAV_LINK_IDLE = "font-semibold text-foreground hover:text-primary-text";
export const NAV_LINK_ACTIVE = "font-bold text-primary-text";
