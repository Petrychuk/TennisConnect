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
export const SESSION_TYPE_OPTIONS: SessionTypeOption[] = [
  { key: "social", label: "Social Tennis", description: "Fun, random doubles", mostPopular: true, details: "Casual, no-pressure doubles with partners mixed up throughout — great for regular club nights where the point is playing, not competing." },
  { key: "americano", label: "Americano", description: "Rotate partners · Individual points", details: "Everyone partners with everyone over several short rounds, with points tracked per player rather than per team — a lively, social format that still rewards individual play." },
  { key: "round-robin", label: "Round Robin", description: "Everyone plays · Structured format", details: "A fixed schedule where every player or pair faces every other one — fair and predictable, with a clear result at the end." },
  { key: "mexicano", label: "Mexicano", description: "Competitive doubles · Level based", details: "Similar to Americano, but pairings adjust round to round based on how players are performing, keeping matches close and competitive." },
  { key: "king-of-the-court", label: "King of the Court", description: "Challenge and play · Elimination style", details: "Winners stay on and face new challengers — a fast-moving, ladder-style format that suits drop-in sessions with players of mixed availability." },
  { key: "tournament", label: "Tournament", description: "Draw · Elimination · Champion", details: "A knockout bracket building toward a single champion — best for a headline event rather than a regular weekly session." },
  { key: "league", label: "League Match", description: "Home vs away · Team points · Season", details: "Teams face off across a season, accumulating points toward a standings table — suits ongoing club-vs-club competition." },
  { key: "club-championship", label: "Club Championship", description: "Seeded draw · Qualifying · Final", details: "A seeded, multi-stage event with qualifying rounds leading to a final — your club's own marquee competition." },
  { key: "junior-event", label: "Junior Event", description: "Age groups · Development focused", details: "Structured around age groups and skill development rather than pure competition — built for coaching juniors, not just matching them up." },
  { key: "cardio-tennis", label: "Cardio Tennis", description: "Fitness format · High rotation", details: "A fitness-first format with fast player rotation and constant movement — less about scorekeeping, more about a great workout." },
  { key: "coaching-clinic", label: "Coaching Clinic", description: "Instructor led · Skill building", details: "Led by a coach with a focus on drills and technique rather than open play — ideal when the goal is improvement, not a result." },
  { key: "custom", label: "Custom Session", description: "Create your own · Fully flexible", details: "No preset structure — set up format, rules, and rotation however suits your group." },
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
  // Date
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  // Registration
  registrationOpens: string; // yyyy-mm-dd
  registrationCloses: string; // yyyy-mm-dd
  maxPlayers: number;
  waitingListEnabled: boolean;
  allowLateRegistration: boolean;
  // Pricing
  pricing: PricingMode;
  price: number;
  // Visibility
  visibility: Visibility;
  coverImage: string | null; // data URL

  // Step 3 - Format
  matchType: "singles" | "doubles" | "mixed";
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
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

  return {
    type: null,
    name: "",
    season: "",
    venue: "Lyne Park Tennis Centre",
    courtCount: 6,
    date: toDateInput(in7Days),
    startTime: "18:30",
    endTime: "20:00",
    registrationOpens: toDateInput(today),
    registrationCloses: toDateInput(in7Days),
    maxPlayers: 24,
    waitingListEnabled: true,
    allowLateRegistration: true,
    pricing: "free",
    price: 15,
    visibility: "public",
    coverImage: null,
    matchType: "doubles",
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
 * separate, later piece of work. season/coverImage also have no
 * backend column yet for the same reason.
 */
export function draftToInsertSession(draft: NewSessionDraft) {
  const startAt = draft.date
    ? new Date(`${draft.date}T${draft.startTime || "00:00"}`)
    : new Date();
  const endAt = draft.date && draft.endTime
    ? new Date(`${draft.date}T${draft.endTime}`)
    : undefined;

  const matchTypeLabel = draft.matchType === "mixed" ? "Mixed Doubles" : draft.matchType === "doubles" ? "Doubles" : "Singles";
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
    type: draft.type ?? "custom",
    location: draft.venue || undefined,
    startAt,
    endAt,
    registrationOpensAt: draft.registrationOpens ? new Date(`${draft.registrationOpens}T00:00`) : undefined,
    registrationClosesAt: draft.registrationCloses ? new Date(`${draft.registrationCloses}T23:59`) : undefined,
    price: draft.pricing === "paid" ? draft.price : 0,
    maxParticipants: draft.maxPlayers || undefined,
    visibility: draft.visibility,
    courtsCount: draft.courtCount || undefined,
    waitingListEnabled: draft.waitingListEnabled,
  };
}
