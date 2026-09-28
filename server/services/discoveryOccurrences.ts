import { zonedTimeToUtc } from "../lib/zonedTime";

// [PLAY][AI] TC Discovery Agent, sections 7-8 - recurring sessions.
// "Do not create an unlimited number of future database records":
// an external "every Thursday 7-9pm" is stored ONCE as a pattern
// (frequency + day of week + times), and the concrete upcoming dates
// are generated on read, inside a bounded horizon. Everything here is
// pure - no database, no network - so it's fully unit-tested.
//
// Dates are handled as plain YYYY-MM-DD calendar strings with UTC
// arithmetic (never local-time Date math), so a date can't slip a day
// depending on where the server happens to run.

export type Frequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
export type DayOfWeek = "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";

// Index = Date.getUTCDay()
export const DAYS_OF_WEEK: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const DAY_PATTERNS: { day: DayOfWeek; re: RegExp }[] = [
  { day: "MONDAY", re: /\bmon(?:day)?s?\b/ },
  { day: "TUESDAY", re: /\btues?(?:day)?s?\b/ },
  { day: "WEDNESDAY", re: /\bwed(?:nesday)?s?\b/ },
  { day: "THURSDAY", re: /\bthu(?:rs?)?(?:day)?s?\b/ },
  { day: "FRIDAY", re: /\bfri(?:day)?s?\b/ },
  { day: "SATURDAY", re: /\bsat(?:urday)?s?\b/ },
  { day: "SUNDAY", re: /\bsun(?:day)?s?\b/ },
];

export interface ParsedRecurrence {
  frequency: Frequency;
  /** null when the text names no day, or more than one day - a single
      day-of-week can't represent "Tuesdays and Thursdays". */
  dayOfWeek: DayOfWeek | null;
  /** true only when we can actually place occurrences from this text
      alone (weekly + one named day). Anything else must be reviewed by
      a human rather than have dates guessed (spec section 8: "recurrence
      is understood"). */
  understood: boolean;
}

/**
 * Turns the source's own recurrence wording ("every Thursday 7-9pm",
 * "Saturdays", "fortnightly on Sundays") into a structured pattern.
 * Returns null when there's no recurrence text at all (a one-off event).
 * The model only extracts the wording (spec section 27) - deciding what
 * it means is this deterministic layer's job.
 */
export function parseRecurrenceText(text: string | null | undefined): ParsedRecurrence | null {
  if (!text || !text.trim()) return null;
  const t = text.toLowerCase();

  const days = DAY_PATTERNS.filter((d) => d.re.test(t)).map((d) => d.day);
  const dayOfWeek = days.length === 1 ? days[0] : null;

  let frequency: Frequency = "WEEKLY";
  if (/fortnight|bi-?weekly|every (?:2|two|other|second) weeks?|every second week/.test(t)) {
    frequency = "FORTNIGHTLY";
  } else if (
    /monthly|every month|each month|(?:first|second|third|fourth|last)\s+\w+\s+of\s+(?:the|each|every)\s+month/.test(t)
  ) {
    frequency = "MONTHLY";
  }

  // Weekly needs one named day; fortnightly needs it too (plus an anchor
  // date, checked at generation time); monthly is never "understood" in
  // V1 - "the first Saturday" isn't derivable without more structure.
  const understood = frequency !== "MONTHLY" && dayOfWeek !== null;
  return { frequency, dayOfWeek, understood };
}

// --- calendar-date helpers (UTC arithmetic on YYYY-MM-DD strings) ---

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMs(ymd: string): number {
  const m = YMD.exec(ymd);
  if (!m) throw new Error(`Invalid date: ${ymd}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatYmd(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export function addDays(ymd: string, days: number): string {
  return formatYmd(toUtcMs(ymd) + days * 86_400_000);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / 86_400_000);
}

export function isValidYmd(s: string | null | undefined): s is string {
  if (!s || !YMD.test(s)) return false;
  return formatYmd(toUtcMs(s)) === s; // rejects 2026-02-31 style dates
}

/** Today's calendar date in a given IANA zone - "today" for a Perth
    venue isn't "today" on a Sydney server at 1am. */
export function todayInZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export interface GenerateOptions {
  frequency: Frequency;
  dayOfWeek: DayOfWeek | null;
  /** First/season-start date if the source gave one - the anchor a
      fortnightly pattern counts from, and a lower bound for any pattern. */
  anchorDate?: string | null;
  /** Last date of the series, if the source gave one. */
  endDate?: string | null;
  fromDate: string;
  horizonDays: number;
  maxCount?: number;
}

/**
 * Concrete dates a recurring pattern falls on, inside [fromDate,
 * fromDate + horizonDays], never before the anchor or after endDate.
 * Only generates what it can be sure of: weekly with a named day, and
 * fortnightly when an anchor date fixes which fortnight. Monthly, or
 * anything with an unknown/ambiguous day, returns [] - a missing
 * occurrence is better than an invented one.
 */
export function generateOccurrenceDates(opts: GenerateOptions): string[] {
  const { frequency, dayOfWeek, anchorDate, endDate, fromDate, horizonDays } = opts;
  const maxCount = opts.maxCount ?? 8;
  if (!dayOfWeek || frequency === "MONTHLY") return [];
  if (!isValidYmd(fromDate)) return [];

  const wantedDow = DAYS_OF_WEEK.indexOf(dayOfWeek);
  let start = fromDate;
  if (isValidYmd(anchorDate) && anchorDate! > start) start = anchorDate!;

  let windowEnd = addDays(fromDate, horizonDays);
  if (isValidYmd(endDate) && endDate! < windowEnd) windowEnd = endDate!;
  if (start > windowEnd) return [];

  const out: string[] = [];

  if (frequency === "WEEKLY") {
    const startDow = new Date(toUtcMs(start)).getUTCDay();
    let d = addDays(start, (wantedDow - startDow + 7) % 7);
    while (d <= windowEnd && out.length < maxCount) {
      out.push(d);
      d = addDays(d, 7);
    }
    return out;
  }

  // FORTNIGHTLY - needs an anchor that actually falls on the named day,
  // otherwise we can't know which alternate week is the "on" week.
  if (!isValidYmd(anchorDate)) return [];
  if (new Date(toUtcMs(anchorDate!)).getUTCDay() !== wantedDow) return [];
  const behind = diffDays(start, anchorDate!);
  const steps = behind <= 0 ? 0 : Math.ceil(behind / 14);
  let d = addDays(anchorDate!, steps * 14);
  while (d <= windowEnd && out.length < maxCount) {
    out.push(d);
    d = addDays(d, 14);
  }
  return out;
}

/** Fallback used only for the "has this ended" check when an activity's
    time zone is unknown - the westmost Australian zone, so an event is
    never treated as finished earlier than it really is anywhere. */
export const CONSERVATIVE_TIME_ZONE = "Australia/Perth";

export interface EndedInput {
  /** The last calendar date of the occurrence (endDate ?? startDate). */
  date: string;
  startTime: string | null;
  endTime: string | null;
  timeZone: string;
  now: Date;
}

/**
 * Has this occurrence finished? Uses the real end time when known;
 * otherwise assumes 3 hours from the start; with no time at all, the
 * occurrence lasts until the end of that calendar day. Erring later
 * keeps a same-day event visible rather than vanishing at midnight.
 */
export function hasOccurrenceEnded(input: EndedInput): boolean {
  const { date, startTime, endTime, timeZone, now } = input;
  let endMs: number;
  if (endTime) {
    endMs = zonedTimeToUtc(date, endTime, timeZone).getTime();
  } else if (startTime) {
    endMs = zonedTimeToUtc(date, startTime, timeZone).getTime() + 3 * 3_600_000;
  } else {
    endMs = zonedTimeToUtc(date, "23:59", timeZone).getTime();
  }
  return endMs < now.getTime();
}

export interface ExpandableActivity {
  recurrenceFrequency: string | null;
  recurrenceDayOfWeek: string | null;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timeZone: string | null;
}

export const OCCURRENCE_HORIZON_DAYS = 28;
export const OCCURRENCE_MAX_COUNT = 8;

/**
 * The upcoming, not-yet-finished occurrence dates for one stored
 * external activity - one date for a one-off, up to a few for a
 * recurring pattern. This is what Play displays.
 */
export function expandOccurrences(
  activity: ExpandableActivity,
  now: Date,
  horizonDays = OCCURRENCE_HORIZON_DAYS,
  maxCount = OCCURRENCE_MAX_COUNT
): string[] {
  const zone = activity.timeZone ?? CONSERVATIVE_TIME_ZONE;
  const notEnded = (date: string) =>
    !hasOccurrenceEnded({ date, startTime: activity.startTime, endTime: activity.endTime, timeZone: zone, now });

  if (activity.recurrenceFrequency) {
    const dates = generateOccurrenceDates({
      frequency: activity.recurrenceFrequency as Frequency,
      dayOfWeek: (activity.recurrenceDayOfWeek as DayOfWeek | null) ?? null,
      anchorDate: activity.startDate,
      endDate: activity.endDate,
      fromDate: todayInZone(now, zone),
      horizonDays,
      maxCount,
    });
    return dates.filter(notEnded);
  }

  if (!isValidYmd(activity.startDate)) return [];
  // A multi-day one-off is over only after its LAST day.
  const lastDay = isValidYmd(activity.endDate) ? activity.endDate! : activity.startDate;
  return hasOccurrenceEnded({ date: lastDay, startTime: activity.startTime, endTime: activity.endTime, timeZone: zone, now })
    ? []
    : [activity.startDate];
}

// --- occurrence ids ---
// A recurring activity appears as several cards; each needs its own id
// that still resolves back to the one stored row. "~" never appears in
// a uuid, so a plain id is unambiguous.

export function makeOccurrenceId(baseId: string, date: string): string {
  return `${baseId}~${date}`;
}

export function parseOccurrenceId(id: string): { baseId: string; date: string | null } {
  const i = id.indexOf("~");
  if (i === -1) return { baseId: id, date: null };
  const date = id.slice(i + 1);
  return { baseId: id.slice(0, i), date: isValidYmd(date) ? date : null };
}

/** The local calendar date and HH:MM wall-clock time of an instant in a
    given zone - used to compare a stored UTC session against an external
    listing's local date/time (a 9am Sydney session is the previous day in
    UTC, so comparing UTC dates would miss every morning duplicate). */
export function toLocalDateTime(instant: Date, timeZone: string): { date: string; time: string } {
  const date = todayInZone(instant, timeZone);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
  return { date, time };
}

/**
 * Is the whole activity over - a one-off whose last day has ended, or a
 * recurring series whose end date has passed? Recurring series with no
 * end date never finish on their own. Drives the EXPIRED status.
 */
export function isActivityFinished(
  activity: Pick<ExpandableActivity, "recurrenceFrequency" | "startDate" | "endDate" | "startTime" | "endTime" | "timeZone">,
  now: Date
): boolean {
  const zone = activity.timeZone ?? CONSERVATIVE_TIME_ZONE;
  const base = { startTime: activity.startTime, endTime: activity.endTime, timeZone: zone, now };
  if (activity.recurrenceFrequency) {
    return isValidYmd(activity.endDate) ? hasOccurrenceEnded({ date: activity.endDate!, ...base }) : false;
  }
  if (!isValidYmd(activity.startDate)) return false;
  const lastDay = isValidYmd(activity.endDate) ? activity.endDate! : activity.startDate;
  return hasOccurrenceEnded({ date: lastDay, ...base });
}
