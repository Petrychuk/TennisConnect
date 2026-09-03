import { zonedTimeToUtc, toZonedDateTimeInputs } from "@/lib/timezone";
import type { SessionWithDetails } from "@shared/schema";

export type SessionTypeKey =
  | "social"
  | "americano"
  | "round-robin"
  | "mexicano"
  | "king-of-the-court"
  | "league"
  | "club-championship"
  | "tournament"
  | "junior-event"
  | "cardio-tennis"
  | "coaching-clinic"
  | "custom";

export interface SessionTypeOption {
  key: SessionTypeKey;
  label: string;
  description: string;
  details: string;
  mostPopular?: boolean;
}

// Tournament (and League, Club Championship, etc.) are deliberately just
// more entries here, not a separate module or entity - "Tournament — это
// один из типов Session", per the architecture note. The wizard's later
// steps and Session Workspace still only branch behavior on a handful of
// mechanical questions (draw vs. rounds, elimination vs. round-robin),
// not on a hardcoded "is this a tournament" check, so adding a type here
// doesn't require a new code path elsewhere - only Step 1 needs to know
// the full list exists.
//
// This list currently mixes two different concepts - session formats
// (Americano, Mexicano, King of the Court) and event purposes/types
// (Junior Event, Cardio Tennis, Coaching Clinic). Fine for this MVP
// list, but don't let the database schema or backend logic bind
// tightly to these exact 12 keys - the likely direction later is
// splitting this into separate Session Type / Play Format / Scoring
// Format concepts that combine (e.g. Junior Event + Round Robin, or
// Club Championship + Knockout), rather than growing this single flat
// list further. A Ladder format (players challenge each other within
// a standing ranking, positions changing over time - an ongoing club
// activity rather than a one-off event) was considered for this list
// and deliberately left out of the first release, not forgotten.
export const SESSION_TYPE_OPTIONS: SessionTypeOption[] = [
  { key: "social", label: "Social Tennis", description: "Fun, random doubles", mostPopular: true, details: "Casual, flexible tennis focused on playing and socialising, with players and partners rotating throughout the session." },
  { key: "americano", label: "Americano", description: "Rotate partners · Individual points", details: "Players rotate partners over a series of rounds, with points typically tracked individually to create an overall ranking." },
  { key: "round-robin", label: "Round Robin", description: "Everyone plays · Structured format", details: "Every player, pair, or team competes against others in their group — a structured format that works well for both social and competitive play." },
  { key: "mexicano", label: "Mexicano", description: "Competitive doubles · Level based", details: "A dynamic format where pairings are adjusted between rounds based on results, helping create increasingly balanced matches." },
  { key: "king-of-the-court", label: "King of the Court", description: "Challenge and play · Elimination style", details: "Winners move up or stay on the top court while other players rotate — a fast-paced competitive format with continuous movement." },
  { key: "tournament", label: "Tournament", description: "Draw · Elimination · Champion", details: "A structured competition using knockout, group, or combined formats, progressing toward final standings or a champion." },
  { key: "league", label: "League Match", description: "Home vs away · Team points · Season", details: "Players or teams compete across scheduled matches, with results contributing to season standings or league rankings." },
  { key: "club-championship", label: "Club Championship", description: "Seeded draw · Qualifying · Final", details: "A club competition played across one or more stages to determine champions within selected events, divisions, or categories." },
  { key: "junior-event", label: "Junior Event", description: "Age groups · Development focused", details: "A junior-focused session or competition that can be organised by age, skill level, or development goals." },
  { key: "cardio-tennis", label: "Cardio Tennis", description: "Fitness format · High rotation", details: "A high-energy, fitness-focused tennis session combining fast-paced drills, movement, and frequent player rotation." },
  { key: "coaching-clinic", label: "Coaching Clinic", description: "Instructor led · Skill building", details: "A coach-led session focused on specific skills, technique, tactics, or match play through structured drills and activities." },
  { key: "custom", label: "Custom Session", description: "Create your own · Fully flexible", details: "Build your own format by choosing the rules, scoring, rounds, player rotation, and other session settings." },
];

export type Visibility = "public" | "members" | "invite";
export type PricingMode = "free" | "paid";

export interface NewSessionDraft {
  // Step 1
  type: SessionTypeKey | null;

  // Step 2 - Session
  name: string;
  season: string;
  venue: string;
  courtCount: number;
  // IANA zone the venue is in - see client/src/lib/timezone.ts. This is
  // what "10:00" below actually means; without it the wizard has no way
  // to know whether the organizer's "10:00" is Sydney time, Perth time,
  // or (if their browser happens to be set to some other zone entirely)
  // neither.
  timeZone: string;
  // Date
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  // Registration
  registrationOpens: string; // yyyy-mm-dd
  registrationOpensTime: string; // HH:mm
  registrationCloses: string; // yyyy-mm-dd
  registrationClosesTime: string; // HH:mm
  maxPlayers: number;
  waitingListEnabled: boolean;
  // null = unlimited. Only meaningful while waitingListEnabled is true.
  waitingListCapacity: number | null;
  allowLateRegistration: boolean;
  // Pricing
  pricing: PricingMode;
  price: number;
  // Visibility
  visibility: Visibility;
  coverImage: string | null; // data URL

  // Step 3 - Format
  matchType: "singles" | "doubles" | "mixed";
  category: "open" | "mens" | "womens";
  gamesTo: number;
  roundsCount: number;
  noAd: boolean;
  tiebreak: boolean;
  // Pairing
  randomPartners: boolean;
  avoidRepeatPartners: boolean;
  balanceWaitingList: boolean;
  usePlayerRating: boolean;
  allowGuests: boolean;
  // Live Settings
  qrCheckIn: boolean;
  liveScores: boolean;
  autoNextRound: boolean;
  publishResults: boolean;

  // Step 3 - optional free text, all folded into the description
  // summary on submit (no dedicated backend columns yet, same
  // reasoning as the format/pairing settings below)
  rulesText: string;
  refundPolicy: string;
  latePolicy: string;
  cancellationPolicy: string;
}

export function createEmptyDraft(): NewSessionDraft {
  const today = new Date();
  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

  return {
    type: null,
    name: "",
    season: "",
    venue: "",
    courtCount: 6,
    timeZone: "Australia/Sydney",
    date: toDateInput(today),
    startTime: "18:30",
    endTime: "20:00",
    registrationOpens: toDateInput(today),
    registrationOpensTime: "00:00",
    registrationCloses: toDateInput(today),
    // Defaults to the session's own start time (registration closes
    // right as it begins) rather than the old hardcoded end-of-day -
    // that let registration nominally stay "open" for hours after a
    // session had already started (even finished, for an evening
    // session), which is exactly what made the sessions list progress
    // bar's "Registration closes in Xh" look wrong for a session that
    // was actually already underway. Still freely editable either way.
    registrationClosesTime: "18:30",
    maxPlayers: 24,
    waitingListEnabled: true,
    waitingListCapacity: 10,
    allowLateRegistration: true,
    pricing: "free",
    price: 15,
    visibility: "public",
    coverImage: null,
    matchType: "doubles",
    category: "open",
    gamesTo: 4,
    roundsCount: 5,
    noAd: true,
    tiebreak: true,
    randomPartners: true,
    avoidRepeatPartners: true,
    balanceWaitingList: true,
    usePlayerRating: false,
    allowGuests: true,
    qrCheckIn: true,
    liveScores: true,
    autoNextRound: false,
    publishResults: true,
    rulesText: "",
    refundPolicy: "",
    latePolicy: "",
    cancellationPolicy: "",
  };
}

/**
 * Maps the wizard's draft to the real backend's InsertSession shape
 * (server/routes/organizer.ts POST /sessions, validated against
 * insertSessionSchema in shared/schema.ts).
 *
 * Step 1/2 fields (type, name, venue, date/time, registration window,
 * capacity, pricing, visibility, court count, waiting list) all have a
 * direct column - those go straight across. Step 3's format/rules
 * fields (singles/doubles/mixed, games to, rounds, no-ad/tiebreak,
 * pairing rules, live settings) don't have columns on the sessions
 * table yet, so nothing there is silently dropped - they're folded
 * into a short, readable summary appended to the description instead,
 * which is better than losing that information outright while a
 * proper schema addition for structured format/rules storage is a
 * separate, later piece of work. season has no backend column yet
 * for the same reason. coverImage does have a real column now (a
 * base64 data URL, since there's no separate object storage wired
 * for session covers yet) and is sent as-is.
 */
/**
 * The inverse of draftToInsertSession, for the "Duplicate" action - lets
 * a past/archived session become the STARTING POINT of a real wizard
 * pass (Step 1 through publish) instead of silently POSTing a
 * near-empty session directly with no review step, which is what
 * "Duplicate" used to do (only title/venue/maxPlayers actually carried
 * over, everything else silently reset to createEmptyDraft()'s
 * defaults, and the copy was left stuck in "draft" status forever since
 * nothing ever called publishSession on it).
 *
 * Only fields with a real column can round-trip - see
 * draftToInsertSession's own comment for which Step 3 fields
 * (pairing/live-settings toggles, free-text policies) only ever get
 * folded into the description as a read-only summary rather than
 * stored as structured data. Those can't be recovered from a past
 * session's description text without fragile parsing, so they reset to
 * createEmptyDraft()'s own defaults here rather than guessing.
 *
 * date/registrationOpens/registrationCloses deliberately reset to
 * TODAY rather than copying the source session's own (likely past, for
 * an archived session) dates - the organizer is about to pick new ones
 * for the next meeting anyway, and starting from today is a more
 * useful default than a stale date they'd have to change regardless.
 */
export function sessionToDraft(session: SessionWithDetails): NewSessionDraft {
  const empty = createEmptyDraft();
  const startInputs = toZonedDateTimeInputs(session.startAt, session.timeZone);
  const endInputs = session.endAt ? toZonedDateTimeInputs(session.endAt, session.timeZone) : null;

  return {
    ...empty,
    type: (session.type as SessionTypeKey) ?? empty.type,
    name: session.title ? `${session.title} (Copy)` : empty.name,
    venue: session.location ?? empty.venue,
    courtCount: session.courtsCount ?? empty.courtCount,
    timeZone: session.timeZone ?? empty.timeZone,
    // Time of day carries over (same session format, same usual start
    // time) - only the DATE resets to today, per the reasoning above.
    startTime: startInputs.time,
    endTime: endInputs?.time ?? empty.endTime,
    maxPlayers: session.maxParticipants ?? empty.maxPlayers,
    waitingListEnabled: session.waitingListEnabled ?? empty.waitingListEnabled,
    waitingListCapacity: session.waitingListCapacity ?? empty.waitingListCapacity,
    pricing: session.price && Number(session.price) > 0 ? "paid" : "free",
    price: session.price ? Number(session.price) : empty.price,
    visibility: (session.visibility as Visibility) ?? empty.visibility,
    coverImage: session.coverImage ?? empty.coverImage,
    matchType: session.matchMode === "singles" ? "singles" : "doubles",
    category: (session.category as NewSessionDraft["category"]) ?? empty.category,
    gamesTo: session.gamesTo ?? empty.gamesTo,
    roundsCount: session.plannedRoundsCount ?? empty.roundsCount,
    noAd: session.noAd ?? empty.noAd,
    tiebreak: session.tiebreak ?? empty.tiebreak,
  };
}

export function draftToInsertSession(draft: NewSessionDraft) {
  // See client/src/lib/timezone.ts - this is the fix for what used to be
  // `new Date(\`${draft.date}T${draft.startTime}\`)`, which silently used
  // the ORGANIZER'S BROWSER'S ambient local timezone instead of the
  // venue's. A session's advertised time belongs to the venue
  // (draft.timeZone), not to whoever happens to be creating it.
  const startAt = draft.date
    ? zonedTimeToUtc(draft.date, draft.startTime || "00:00", draft.timeZone)
    : new Date();
  const endAt = draft.date && draft.endTime
    ? zonedTimeToUtc(draft.date, draft.endTime, draft.timeZone)
    : undefined;

  const baseMatchTypeLabel = draft.matchType === "mixed" ? "Mixed Doubles" : draft.matchType === "doubles" ? "Doubles" : "Singles";
  const categoryPrefix = draft.category === "mens" ? "Men's " : draft.category === "womens" ? "Women's " : "";
  const matchTypeLabel = draft.matchType === "mixed" ? baseMatchTypeLabel : `${categoryPrefix}${baseMatchTypeLabel}`;
  const pairingLabels = [
    draft.randomPartners ? "Random Partners" : null,
    draft.avoidRepeatPartners ? "Avoid Repeat Partners" : null,
    draft.balanceWaitingList ? "Balance Waiting List" : null,
    draft.usePlayerRating ? "Rating-Based Pairing" : null,
    draft.allowGuests ? "Guests Allowed" : null,
  ].filter(Boolean);
  const formatSummary = [
    `Format: ${matchTypeLabel}`,
    `Games to ${draft.gamesTo}`,
    `${draft.roundsCount} rounds`,
    draft.noAd ? "No-Ad" : null,
    draft.tiebreak ? "Tiebreak" : null,
    pairingLabels.length ? pairingLabels.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const policySections = [
    draft.rulesText.trim() ? `Rules: ${draft.rulesText.trim()}` : null,
    draft.refundPolicy.trim() ? `Refund Policy: ${draft.refundPolicy.trim()}` : null,
    draft.latePolicy.trim() ? `Late Arrivals: ${draft.latePolicy.trim()}` : null,
    draft.cancellationPolicy.trim() ? `Cancellations: ${draft.cancellationPolicy.trim()}` : null,
  ].filter(Boolean);

  const fullDescription = [formatSummary, ...policySections].filter(Boolean).join("\n\n");

  return {
    title: draft.name || "Untitled Session",
    description: fullDescription || undefined,
    coverImage: draft.coverImage || undefined,
    type: draft.type ?? "custom",
    location: draft.venue || undefined,
    timeZone: draft.timeZone,
    startAt,
    endAt,
    registrationOpensAt: draft.registrationOpens ? zonedTimeToUtc(draft.registrationOpens, draft.registrationOpensTime || "00:00", draft.timeZone) : undefined,
    registrationClosesAt: draft.registrationCloses ? zonedTimeToUtc(draft.registrationCloses, draft.registrationClosesTime || "23:59", draft.timeZone) : undefined,
    price: draft.pricing === "paid" ? draft.price : 0,
    maxParticipants: draft.maxPlayers || undefined,
    visibility: draft.visibility,
    courtsCount: draft.courtCount || undefined,
    waitingListEnabled: draft.waitingListEnabled,
    waitingListCapacity: draft.waitingListEnabled ? draft.waitingListCapacity : undefined,
    // Structured, queryable versions of what formatSummary above already
    // folds into description as text - matchMode also drives TC Live's
    // pairing engine (server/services/liveEngine.ts), which previously
    // never learned what the organizer picked here and silently treated
    // every session as doubles regardless.
    matchMode: draft.matchType === "singles" ? "singles" : "doubles",
    category: draft.category,
    gamesTo: draft.gamesTo || undefined,
    noAd: draft.noAd,
    tiebreak: draft.tiebreak,
    plannedRoundsCount: draft.roundsCount || undefined,
  };
}
