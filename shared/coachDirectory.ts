/*
  The public coach directory (/coaches, GET /api/coaches).

  Search, location and price used to be applied in the browser to the one
  page of 16 coaches the API had returned, so a filter only ever looked at
  page 1 ("No coaches found" while matches sat on page 2), and the location
  list only offered page-1 locations. The API now filters the whole
  directory and paginates the result; the page only sends the filters.

  With no filters, every listed coach is returned (newest first, 16 per
  page) - including coaches whose free-text rate has no number in it.
*/

/** Slider top value = "any price". */
export const ANY_PRICE = 150;
export const COACHES_PAGE_SIZE = 16;

/**
 * Coaches type their hourly rate as free text - "80", "$80", "$80/hr",
 * "AUD 70-90". Number() is NaN for anything but a bare number, and
 * `NaN <= maxPrice` is false, so every coach with a "$" in their rate
 * vanished from the directory. This reads the first number instead.
 */
export function parseHourlyRate(rate: unknown): number | null {
  if (typeof rate === "number") return Number.isFinite(rate) ? rate : null;
  if (typeof rate !== "string") return null;
  const match = rate.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** No limit -> every coach; a limit -> coaches whose rate is known and within it. */
export function matchesMaxRate(rate: number | null, maxPrice: number): boolean {
  if (!Number.isFinite(maxPrice) || maxPrice >= ANY_PRICE) return true;
  return rate !== null && rate <= maxPrice;
}

export interface CoachDirectoryQuery {
  /** Free text, matched against name, title and location (case-insensitive). */
  q: string;
  /** Exact location, or "" for any. */
  location: string;
  /** Maximum hourly rate; ANY_PRICE (or more) = no limit. */
  maxRate: number;
}

export interface CoachDirectoryEntry {
  name: string;
  title: string;
  location: string;
  rate: number | null;
}

/** Reads ?q=&location=&maxRate= from a request query, tolerating junk. */
export function parseCoachDirectoryQuery(query: Record<string, unknown>): CoachDirectoryQuery {
  const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
  const location = text(query.location);
  const maxRate = Number(query.maxRate);
  return {
    q: text(query.q),
    location: location.toLowerCase() === "all" ? "" : location,
    maxRate: Number.isFinite(maxRate) && maxRate > 0 ? maxRate : ANY_PRICE,
  };
}

export function coachMatches(coach: CoachDirectoryEntry, query: CoachDirectoryQuery): boolean {
  const q = query.q.toLowerCase();
  const matchesSearch =
    !q || [coach.name, coach.title, coach.location].some((field) => (field ?? "").toLowerCase().includes(q));
  const matchesLocation = !query.location || coach.location === query.location;
  return matchesSearch && matchesLocation && matchesMaxRate(coach.rate, query.maxRate);
}

/** Every distinct location in the whole directory, for the Location filter. */
export function directoryLocations(coaches: CoachDirectoryEntry[]): string[] {
  return Array.from(new Set(coaches.map((c) => c.location).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

/** Filters the whole directory, then cuts out one page. */
export function pageOfCoaches<T extends CoachDirectoryEntry>(all: T[], query: CoachDirectoryQuery, page: number, limit: number) {
  const matching = all.filter((c) => coachMatches(c, query));
  const totalPages = Math.ceil(matching.length / limit);
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  return {
    coaches: matching.slice((safePage - 1) * limit, safePage * limit),
    pagination: { page: safePage, limit, total: matching.length, totalPages },
  };
}
