// [PLAY][AI] TC Discovery Agent - deterministic normalisation (spec
// sections 8-11). No LLM here - these are lookup tables and pure
// functions the AI extraction step's OUTPUT gets run through, not
// something asked of the model itself. "Extract, don't invent" (spec
// section 27) means the model should return the ORIGINAL text; these
// functions are what turn that into TennisConnect's own taxonomy, with
// an explicit `null` whenever the mapping isn't confident - never a
// guessed value standing in for a missing one.

export type NormalisedLevel = "Beginner" | "Intermediate" | "Advanced" | "Pro";

/**
 * Maps free-text level descriptions (as written on an external site)
 * to TennisConnect's own level taxonomy. Returns null - never a guess -
 * when nothing in the table matches. Deliberately does NOT try to
 * parse a "UTR 3-5"-style range into a specific level (spec section 10:
 * "do not let AI invent a UTR" applies just as much to this
 * deterministic layer - a UTR range doesn't unambiguously map to one
 * of four buckets, so it's left unmapped rather than guessed).
 */
export function normaliseLevelText(originalLevelText: string | null | undefined): NormalisedLevel | null {
  if (!originalLevelText) return null;
  const text = originalLevelText.toLowerCase();

  // Order matters - checked most-specific-combination first, since
  // e.g. "beginner-intermediate" would otherwise match the plain
  // "beginner" check below and lose the "intermediate" half entirely.
  if (/beginner.{0,10}intermediate|intermediate.{0,10}beginner/.test(text)) return "Beginner";
  if (/intermediate.{0,10}advanced|advanced.{0,10}intermediate/.test(text)) return "Advanced";

  if (/\bbeginner|novice|new to tennis|just starting\b/.test(text)) return "Beginner";
  if (/\bintermediate|social player|club player\b/.test(text)) return "Intermediate";
  if (/\badvanced|competitive|division 1|division 2|open grade\b/.test(text)) return "Advanced";
  if (/\bpro\b|\bprofessional\b|elite/.test(text)) return "Pro";

  // "UTR 3-5", "division 4", or anything else too ambiguous to place
  // in one bucket confidently - null, not a guess.
  return null;
}

export type NormalisedFormat = {
  activityType: string | null; // matches SESSION_TYPE_OPTIONS keys where possible; null = not recognised
  gameFormat: "singles" | "doubles" | "mixed" | null;
};

/**
 * Maps free-text format/activity descriptions to TennisConnect's own
 * activityType + gameFormat pair (spec section 11). Same
 * null-over-guess philosophy - gameFormat is only ever set when the
 * source text actually said singles/doubles/mixed, never inferred from
 * the activity type alone (a "social tennis" session isn't assumed to
 * be doubles just because that's common).
 */
export function normaliseFormatText(sourceText: string): NormalisedFormat {
  const text = sourceText.toLowerCase();

  // No match means we DON'T KNOW - not "social". A "Pride Cup" or a junior
  // matchplay night is not a social hit just because nothing else matched
  // (spec sections 11 and 27: missing is better than fabricated).
  let activityType: string | null = null;
  if (/round.?robin/.test(text)) activityType = "round-robin";
  else if (/americano/.test(text)) activityType = "americano";
  else if (/mexicano/.test(text)) activityType = "mexicano";
  else if (/king of the court/.test(text)) activityType = "king-of-the-court";
  else if (/tournament/.test(text)) activityType = "tournament";
  else if (/league/.test(text)) activityType = "league";
  else if (/club championship/.test(text)) activityType = "club-championship";
  else if (/junior/.test(text)) activityType = "junior-event";
  else if (/cardio tennis/.test(text)) activityType = "cardio-tennis";
  else if (/clinic|coaching/.test(text)) activityType = "coaching-clinic";
  else if (/social/.test(text)) activityType = "social";

  let gameFormat: NormalisedFormat["gameFormat"] = null;
  const mentionsSingles = /singles/.test(text);
  const mentionsDoubles = /doubles/.test(text);
  // "Singles and Doubles play" / "singles or mixed doubles" names BOTH -
  // recording either one alone would misstate the activity, so it stays
  // null. Only an unambiguous single format is set.
  if (mentionsSingles && mentionsDoubles) gameFormat = null;
  else if (/mixed doubles/.test(text)) gameFormat = "mixed";
  else if (mentionsDoubles) gameFormat = "doubles";
  else if (mentionsSingles) gameFormat = "singles";

  return { activityType, gameFormat };
}

// Spec section 8's own list, plus ACT (shares Sydney's zone - there's
// no separate "Australia/Canberra" IANA zone).
export const AU_STATE_TIMEZONES: Record<string, string> = {
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  QLD: "Australia/Brisbane",
  WA: "Australia/Perth",
  SA: "Australia/Adelaide",
  TAS: "Australia/Hobart",
  NT: "Australia/Darwin",
};

/**
 * Resolves the venue-local IANA time zone from state - "do not assume
 * all Australian events use Sydney time" (spec section 8). Returns
 * null for an unrecognised/missing state rather than defaulting to
 * Sydney, since a wrong silent default is worse than an explicit
 * "we don't know yet".
 */
export function resolveTimeZoneForState(state: string | null | undefined): string | null {
  if (!state) return null;
  return AU_STATE_TIMEZONES[state.toUpperCase()] ?? null;
}

export interface DateValidationResult {
  valid: boolean;
  reason?: "missing_start_date" | "invalid_date" | "already_expired" | "end_before_start" | "invalid_time_range";
}

/**
 * Spec section 8's own checklist, as one function: start date exists,
 * parses, isn't already in the past, end date (if given) isn't before
 * the start, and the time range (if both given) is logical. Does NOT
 * check recurrence understanding or timezone appropriateness here -
 * those are handled by normaliseFormatText/resolveTimeZoneForState
 * respectively; this function is specifically the date/time shape.
 */
export function validateActivityDates(input: {
  startDate: string | null; // YYYY-MM-DD
  endDate?: string | null;
  startTime?: string | null; // HH:MM
  endTime?: string | null;
  timeZone: string | null;
  now?: Date; // injectable for tests
}): DateValidationResult {
  const now = input.now ?? new Date();

  if (!input.startDate) return { valid: false, reason: "missing_start_date" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return { valid: false, reason: "invalid_date" };

  const todayInVenue = input.timeZone
    ? new Intl.DateTimeFormat("en-CA", { timeZone: input.timeZone }).format(now)
    : new Intl.DateTimeFormat("en-CA").format(now);
  if (input.startDate < todayInVenue) return { valid: false, reason: "already_expired" };

  if (input.endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) return { valid: false, reason: "invalid_date" };
    if (input.endDate < input.startDate) return { valid: false, reason: "end_before_start" };
  }

  if (input.startTime && input.endTime) {
    if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
      return { valid: false, reason: "invalid_time_range" };
    }
    // Only meaningful to compare on the same calendar day - a
    // multi-day event's end time being numerically "before" its start
    // time (e.g. a Friday 6pm - Sunday 2pm) is normal, not an error.
    if (!input.endDate || input.endDate === input.startDate) {
      if (input.endTime <= input.startTime) return { valid: false, reason: "invalid_time_range" };
    }
  }

  return { valid: true };
}

/**
 * Turns a registration link pulled from an external page into a URL that
 * is safe to render as a player-facing <a href>, or null (spec sections
 * 19 and 26: "do not fabricate registration links", "invalid
 * registration URL"). Relative links ("/book") are resolved against the
 * page they were found on. Only http(s) survives - a scraped
 * "javascript:..." or "data:..." value must never reach a link.
 */
export function resolveRegistrationUrl(raw: string | null | undefined, pageUrl: string): string | null {
  if (!raw || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim(), pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // "http://name@host" is a mangled email address (a real pilot page has
    // one as a button link) and also the classic look-alike-link trick -
    // never a registration link.
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const STATE_NAMES: Record<string, string> = {
  "new south wales": "NSW",
  victoria: "VIC",
  queensland: "QLD",
  "western australia": "WA",
  "south australia": "SA",
  tasmania: "TAS",
  "australian capital territory": "ACT",
  "northern territory": "NT",
};

/**
 * "Victoria", "vic", "V.I.C" -> "VIC". Returns null for anything that
 * isn't one of the eight Australian states/territories, rather than
 * passing an unrecognised string through - an unknown state means an
 * unknown time zone, which must surface for review, not be guessed.
 */
export function normaliseAustralianState(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim().toLowerCase().replace(/\./g, "");
  if (STATE_NAMES[t]) return STATE_NAMES[t];
  const upper = t.toUpperCase();
  return AU_STATE_TIMEZONES[upper] ? upper : null;
}

/**
 * Guard for any URL the Agent will fetch server-side (a source's pages).
 * Sources are admin-configured, but a fetch made from the server must
 * never be aimable at the server's own network: only http(s), and never
 * localhost, private/link-local ranges, or the cloud metadata address.
 * (Redirect targets are re-checked by the caller against the final URL;
 * DNS-level tricks aren't covered - this is a sensible floor for an
 * admin-only feature, not a full SSRF defence.)
 */
export function isSafeExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false; // link-local, incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  }
  return true;
}

export interface DiscoveredDatesInput {
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isRecurring: boolean;
  timeZone: string | null;
  now?: Date;
}

/**
 * Date validation for a freshly extracted activity (spec section 8).
 * A one-off needs a real, not-yet-past start date. A recurring session
 * legitimately has NO fixed date ("every Thursday"), and any start date
 * it does carry is just when the season began - so being in the past is
 * fine; what matters is that the series hasn't ENDED and the times make
 * sense.
 */
export function validateDiscoveredDates(input: DiscoveredDatesInput): DateValidationResult {
  const now = input.now ?? new Date();
  if (!input.isRecurring) {
    return validateActivityDates({
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.startTime,
      endTime: input.endTime,
      timeZone: input.timeZone,
      now,
    });
  }

  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (input.startDate && !ymd.test(input.startDate)) return { valid: false, reason: "invalid_date" };
  if (input.endDate && !ymd.test(input.endDate)) return { valid: false, reason: "invalid_date" };
  if (input.startDate && input.endDate && input.endDate < input.startDate) return { valid: false, reason: "end_before_start" };
  if (input.endDate) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: input.timeZone ?? "Australia/Perth" }).format(now);
    if (input.endDate < today) return { valid: false, reason: "already_expired" };
  }
  if (input.startTime && input.endTime) {
    if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime) || input.endTime <= input.startTime) {
      return { valid: false, reason: "invalid_time_range" };
    }
  }
  return { valid: true };
}
