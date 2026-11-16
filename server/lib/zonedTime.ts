// Server-side equivalent of the client's date-fns-tz zonedTimeToUtc -
// this app has no date-fns-tz dependency on the server side at all
// (session creation relies on the CLIENT doing this conversion before
// ever sending startAt), and adding a new npm dependency isn't
// possible from this sandbox (no network access to install one and
// verify it). Implemented with only Intl.DateTimeFormat, which every
// supported Node runtime already includes with full ICU data.
//
// Technique: take the wall-clock time literally as if it were UTC, ask
// what offset the zone has at that instant, and correct by it - then do
// it AGAIN at the corrected instant. The second pass matters: on the
// day a zone changes its clocks, the literal-UTC guess lands on the far
// side of the change from the true instant, so a single pass applies the
// wrong offset (Sydney, evening of 3 Oct 2026, the night before daylight
// saving starts, came out one hour early - a "8:00 PM" session displayed
// as 7:00 PM). Deriving the offset from the specific instant, not a fixed
// table, is what handles daylight saving at all.

/** The zone's offset from UTC, in ms, at a given instant. */
function offsetMsAt(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(instantMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const readAsZoned = Date.UTC(
    parseInt(get("year"), 10),
    parseInt(get("month"), 10) - 1,
    parseInt(get("day"), 10),
    parseInt(get("hour") === "24" ? "0" : get("hour"), 10),
    parseInt(get("minute"), 10),
    0
  );
  // Seconds are dropped by the formatter, so compare against the
  // instant truncated to the minute.
  return readAsZoned - Math.floor(instantMs / 60_000) * 60_000;
}

/**
 * Converts a local date + time in a given IANA time zone to the
 * corresponding UTC Date. `dateStr` is YYYY-MM-DD, `timeStr` is HH:MM.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = localAsUtc - offsetMsAt(localAsUtc, timeZone);
  // Re-derive the offset at the instant we actually landed on.
  return new Date(localAsUtc - offsetMsAt(firstPass, timeZone));
}

/**
 * Return the YYYY-MM-DD date string for a UTC instant in a given IANA
 * time zone. Useful for grouping UTC timestamps by their local date.
 */
export function utcToZonedDateStr(utc: Date, timeZone: string): string {
  const offset = offsetMsAt(utc.getTime(), timeZone);
  const local = new Date(utc.getTime() + offset);
  return local.toISOString().slice(0, 10);
}

/**
 * Return the UTC Date for the very start (00:00:00.000) of a local
 * date in a given IANA time zone. `dateStr` is YYYY-MM-DD.
 */
export function startOfDayUtc(dateStr: string, timeZone: string): Date {
  return zonedTimeToUtc(dateStr, "00:00", timeZone);
}

/**
 * Return the UTC Date for the last instant (23:59:59.999) of a local
 * date in a given IANA time zone. `dateStr` is YYYY-MM-DD.
 */
export function endOfDayUtc(dateStr: string, timeZone: string): Date {
  const endOfDay = zonedTimeToUtc(dateStr, "23:59", timeZone);
  // Add 59 seconds + 999 ms to cover the full minute.
  return new Date(endOfDay.getTime() + 59_999);
}

/**
 * Return today's YYYY-MM-DD date string in the given IANA time zone.
 */
export function todayInZone(timeZone: string): string {
  return utcToZonedDateStr(new Date(), timeZone);
}
