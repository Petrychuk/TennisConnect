// When does a travel retreat count as ended ("Archived"), and in what
// order do retreat cards appear?
//
// Retreats (travel_packages) store a start date (date-only text, normally
// "YYYY-MM-DD", the retreat's own local calendar date) and a free-text
// duration ("7 days", "5 nights", "2 weeks") - there is no end date column.
//
// A retreat starting on S that lasts N days runs S .. S+N-1. It is
// archived from the first calendar day AFTER that, as counted in
// Australia/Sydney (the platform's home market - retreats are listed and
// sold from there), i.e. from 00:00 Sydney time on S+N. Comparing calendar
// dates instead of instants means the result doesn't depend on the
// viewer's own timezone, and the boundary is a clean midnight rather than
// "11am the next day" (what new Date("YYYY-MM-DD") + N days gave in
// Sydney, since that parses as UTC midnight).
//
// An inactive package (isActive === false - the existing manual archive
// switch; the public API already hides these) also counts as archived.
//
// Pure - unit-tested in ./travelStatus.test.ts.

export const RETREAT_TIME_ZONE = "Australia/Sydney";

export interface RetreatDates {
  startDate: string | null;
  duration?: string | null;
  isActive?: boolean | null;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date ("YYYY-MM-DD") of an instant, as seen in `timeZone`. */
export function calendarDateIn(instant: Date, timeZone: string = RETREAT_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/**
 * The retreat's first day as "YYYY-MM-DD". Date-only values are taken as
 * written; a full timestamp is converted to its Sydney calendar date.
 * Returns null when there is no usable date (a "TBA" retreat).
 */
export function retreatStartDay(startDate: string | null | undefined): string | null {
  const raw = (startDate ?? "").trim();
  if (!raw) return null;
  const m = DATE_ONLY.exec(raw);
  if (m) {
    const [, y, mo, d] = m;
    const probe = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    // Rejects impossible dates like 2026-02-30 (Date would roll them over).
    return probe.getUTCMonth() === Number(mo) - 1 && probe.getUTCDate() === Number(d) ? raw : null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : calendarDateIn(parsed);
}

/** Number of calendar days the retreat lasts (at least 1). */
export function retreatLengthDays(duration: string | null | undefined): number {
  const text = (duration ?? "").toLowerCase();
  const n = (re: RegExp) => {
    const m = re.exec(text);
    return m ? Number(m[1]) : null;
  };
  const days = n(/(\d+)\s*days?\b/);
  if (days) return days;
  const nights = n(/(\d+)\s*nights?\b/);
  if (nights) return nights + 1; // 5 nights = 6 calendar days
  const weeks = n(/(\d+)\s*weeks?\b/);
  if (weeks) return weeks * 7;
  return 1;
}

function addDays(day: string, count: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + count));
  return dt.toISOString().slice(0, 10);
}

/** The retreat's last day ("YYYY-MM-DD"), or null without a start date. */
export function retreatLastDay(pkg: RetreatDates): string | null {
  const start = retreatStartDay(pkg.startDate);
  return start ? addDays(start, retreatLengthDays(pkg.duration) - 1) : null;
}

/** True once the retreat has ended (or was switched off). */
export function isRetreatArchived(pkg: RetreatDates, now: Date = new Date()): boolean {
  if (pkg.isActive === false) return true;
  const last = retreatLastDay(pkg);
  if (!last) return false; // no date yet = still upcoming ("TBA")
  return calendarDateIn(now) > last;
}

/**
 * Upcoming retreats first (soonest start first, undated "TBA" ones after
 * the dated ones), then archived retreats (most recently ended first).
 * Stable for equal keys, so the API's own order breaks ties.
 */
export function sortRetreatsForDisplay<T extends RetreatDates>(items: readonly T[], now: Date = new Date()): T[] {
  const keyed = items.map((item, index) => {
    const archived = isRetreatArchived(item, now);
    return { item, index, archived, start: retreatStartDay(item.startDate), last: retreatLastDay(item) };
  });
  keyed.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    if (!a.archived) {
      if (a.start && b.start && a.start !== b.start) return a.start < b.start ? -1 : 1;
      if (!a.start !== !b.start) return a.start ? -1 : 1;
    } else if (a.last && b.last && a.last !== b.last) {
      return a.last > b.last ? -1 : 1;
    }
    return a.index - b.index;
  });
  return keyed.map((k) => k.item);
}
