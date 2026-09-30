// Server-side equivalent of the client's date-fns-tz zonedTimeToUtc -
// this app has no date-fns-tz dependency on the server side at all
// (session creation relies on the CLIENT doing this conversion before
// ever sending startAt), and adding a new npm dependency isn't
// possible from this sandbox (no network access to install one and
// verify it). Implemented with only Intl.DateTimeFormat, which every
// supported Node runtime already includes with full ICU data.
//
// Standard technique: guess the UTC instant is the wall-clock time
// taken literally as UTC, then see what that instant actually reads as
// in the target zone, and correct by the difference - handles daylight
// saving correctly since the offset is derived from the specific date,
// not a fixed table.

/**
 * Converts a local date + time in a given IANA time zone to the
 * corresponding UTC Date. `dateStr` is YYYY-MM-DD, `timeStr` is HH:MM.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // First guess: treat the wall-clock time as if it were already UTC.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  // What does that instant actually read as, in the target zone?
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(guess);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const readAsZoned = new Date(
    Date.UTC(
      parseInt(get("year"), 10),
      parseInt(get("month"), 10) - 1,
      parseInt(get("day"), 10),
      parseInt(get("hour") === "24" ? "0" : get("hour"), 10),
      parseInt(get("minute"), 10),
      0
    )
  );

  // The difference between what we guessed and what the zone actually
  // shows IS the zone's UTC offset at this instant - correct by it.
  const offsetMs = guess.getTime() - readAsZoned.getTime();
  return new Date(guess.getTime() + offsetMs);
}
