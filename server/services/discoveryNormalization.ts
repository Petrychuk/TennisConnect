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
  activityType: string; // matches SESSION_TYPE_OPTIONS keys where possible (social, tournament, league, ...)
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

  let activityType = "social";
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
  if (/mixed doubles/.test(text)) gameFormat = "mixed";
  else if (/doubles/.test(text)) gameFormat = "doubles";
  else if (/singles/.test(text)) gameFormat = "singles";

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
