// Implements both halves of the chain a session's time goes through:
//
//   WRITE:  "10:00" wall clock + Australia/Sydney  -> UTC   (zonedTimeToUtc)
//   READ:   UTC timestamptz    + Australia/Sydney  -> "10:00" wall clock (formatInTimeZone)
//
// The bug this replaces: constructing `new Date(\`${date}T${time}\`)` with
// no timezone info makes JS assume the BROWSER's own ambient local
// timezone - fine if the organizer happens to be sitting in the venue's
// timezone, wrong (and silently wrong) the moment they aren't. A
// session's advertised time is a property of the VENUE, not of whoever
// is creating or viewing it, so the conversion has to name the zone
// explicitly instead of leaning on whatever zone the calling machine
// happens to be in.
//
// No new dependency (no date-fns-tz) - both directions are done with
// nothing but the standard Intl API already available in every modern
// browser and Node runtime.

// A handful of Australian cities to start - the platform's real markets
// today. Adding a city here is the whole change needed to offer it in
// the wizard's picker (see AU_CITY_TIMEZONES usage in
// step2-date-registration.tsx) - nothing else needs updating, since
// zonedTimeToUtc/formatInTimeZone take the IANA string as data, not as
// a hardcoded case.
export const AU_CITY_TIMEZONES: { label: string; timeZone: string }[] = [
  { label: "Sydney", timeZone: "Australia/Sydney" },
  { label: "Melbourne", timeZone: "Australia/Melbourne" },
  { label: "Brisbane", timeZone: "Australia/Brisbane" },
  { label: "Perth", timeZone: "Australia/Perth" },
  { label: "Adelaide", timeZone: "Australia/Adelaide" },
];

/**
 * Converts a wall-clock date+time as experienced in `timeZone` into the
 * correct UTC instant - e.g. ("2026-08-27", "18:30", "Australia/Sydney")
 * -> the Date representing 2026-08-27T08:30:00Z (AEST, UTC+10).
 *
 * How it works, without a timezone-conversion library: construct a Date
 * by pretending the wall clock IS UTC (a stable reference instant), then
 * ask Intl what that same instant reads as inside the target zone. The
 * gap between those two readings is exactly that zone's offset at that
 * moment (DST included, since Intl uses the real IANA database) - add
 * that gap back to the reference instant to get the true UTC instant.
 * Both readings are parsed by the SAME calling environment, so whatever
 * ambient timezone that environment itself has cancels out of the
 * subtraction - this is correct regardless of the browser's or server's
 * own local timezone.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const asIfUtc = new Date(`${dateStr}T${timeStr || "00:00"}:00Z`);
  const readAsZoned = new Date(asIfUtc.toLocaleString("en-US", { timeZone }));
  const offsetMs = asIfUtc.getTime() - readAsZoned.getTime();
  return new Date(asIfUtc.getTime() + offsetMs);
}

/**
 * Formats a UTC instant (a Date, or anything `new Date()` accepts) as a
 * wall-clock time in `timeZone` - e.g. a session's true stored startAt,
 * shown as "6:30 PM" for a Sydney session to every viewer everywhere,
 * not converted to each viewer's own local time. Native Intl support
 * for an explicit timeZone option - no conversion trick needed here,
 * only the write direction (zonedTimeToUtc) needs one.
 */
export function formatInTimeZone(
  date: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", { ...options, timeZone });
}
