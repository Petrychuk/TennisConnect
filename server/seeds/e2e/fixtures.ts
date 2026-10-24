// Deterministic E2E fixtures for Railway Staging (Stage 2).
//
// buildFixtureSet(anchor) is a pure function: the same anchor date always
// produces exactly the same fixtures (no randomness, no clock reads).
//
// Dates: past items (completed sessions, the past tournament) sit before
// the anchor and stay past forever. Every future item (upcoming, cancelled,
// draft sessions; upcoming tournaments; the season end) sits at least
// FUTURE_HORIZON_DAYS after the anchor, and the anchor must be within the
// last week (safety.ts parseAnchor), so one seed keeps "upcoming" data
// upcoming for roughly six months. fixtureValidUntil() reports the exact
// date; re-running the seed before then refreshes the dates in place
// (idempotent - same records, new dates). Time-window views such as
// "Play This Week" cannot be covered by persistent data: tests for those
// must create their own run-owned session.
//
// Identities are entirely fictional; places are real Australian suburbs.
// Every record is recognisable as test data:
//   - users: e2e-* emails on tennisconnect.test (server/seeds/e2e/identities.ts)
//   - organisations, clubs, tournaments: "e2e-" slugs, "[E2E]" names and a
//     tennisconnect.test contact email (the seed's ownership marker)
//   - sessions: "[E2E]" titles under the fixture organisation only.
//
// Sizes are chosen for the existing tests: the coaches directory shows 16
// per page and the players directory 20 per page (server/routes/coaches.ts,
// players.ts; client pages use the same limits), so PUBLIC-003/PUBLIC-007
// need more than 16 listed coaches and more than 20 listed players.

import { BASELINE_IDENTITIES, type BaselineIdentity } from "./identities";

export const FIXTURE_CONTACT_EMAIL = "e2e-fixtures@tennisconnect.test";
export const FIXTURE_PLAYER_COUNT = 24;
export const FIXTURE_COACH_COUNT = 20;
export const COACHES_PER_PAGE = 16;
export const PLAYERS_PER_PAGE = 20;
/** Every future-dated fixture is at least this many days after the anchor. */
export const FUTURE_HORIZON_DAYS = 180;
export const DEFAULT_COVER = "/images/cinematic_tennis_court_abstract_background.webp";

// ---------- Types ----------

export interface PlayerProfileFixture {
  location: string;
  country: string;
  skillLevel: string;
  bio: string;
  latitude: number;
  longitude: number;
  gameFormat: string;
  playStyle: string;
  playingHand: string;
}

export interface CoachProfileFixture {
  title: string;
  country: string;
  location: string;
  locations: string[];
  latitude: number;
  longitude: number;
  bio: string;
  rate: string;
  experience: string;
  tags: string[];
  isCertified: boolean;
  certificationDetails: string | null;
}

export interface UserFixture {
  kind: "baseline" | "fixture";
  email: string;
  slug: string;
  name: string;
  userRole: "player" | "coach";
  isOrganizer: boolean;
  isAdmin: boolean;
  /** Listed in public directories? (users.isHidden = !listed) */
  listed: boolean;
  /** Baseline accounts log in with this env var's password; fixtures can't log in. */
  passwordEnv: string | null;
  playerProfile: PlayerProfileFixture | null;
  coachProfile: CoachProfileFixture | null;
}

export interface OrganizationFixture {
  slug: string;
  name: string;
  description: string;
  type: "community";
  status: "active";
  ownerEmail: string;
  email: string;
}

export interface CommunityMembershipFixture {
  userEmail: string;
  status: "accepted" | "pending" | "declined";
}

export interface ClubFixture {
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  location: string;
  suburb: string;
  state: string;
  latitude: number;
  longitude: number;
  email: string;
  status: "published";
  hasCourts: boolean;
  hasCommunity: boolean;
  hasCoaching: boolean;
  outdoorCourts: number;
  indoorCourts: number;
  courtSurfaces: string[];
  publicAccess: boolean;
  membershipRequired: boolean;
}

export interface TournamentFixture {
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  level: string;
  price: number;
  maxParticipants: number;
  currentParticipants: number;
  description: string;
  organizer: string;
  email: string;
  coverImage: string;
  status: "upcoming" | "past";
  winner: string | null;
  finalist: string | null;
}

export interface MatchFixture {
  courtLabel: string;
  teamA: string[]; // user emails
  teamB: string[];
  teamAGames: number;
  teamBGames: number;
}

export interface RoundFixture {
  roundNumber: number;
  matches: MatchFixture[];
}

export interface RegistrationFixture {
  userEmail: string;
  status: "registered" | "waitlisted" | "cancelled";
  checkedIn: boolean;
}

export interface SessionFixture {
  key: string;
  title: string;
  description: string;
  type: "social" | "clinic" | "tournament";
  status: "draft" | "published" | "cancelled" | "completed";
  startAt: Date;
  endAt: Date;
  location: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  maxParticipants: number;
  waitingListEnabled: boolean;
  waitingListCapacity: number | null;
  skillLevel: string;
  courtsCount: number;
  matchMode: "singles" | "doubles";
  inSeries: boolean;
  registrations: RegistrationFixture[];
  rounds: RoundFixture[];
}

export interface SeasonFixture {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface SeriesFixture {
  name: string;
  format: string;
  description: string;
}

export interface MessageFixture {
  key: string;
  fromEmail: string;
  toEmail: string;
  recipientType: "player" | "coach";
  subject: string;
  content: string;
}

export interface FixtureSet {
  anchor: string; // YYYY-MM-DD
  users: UserFixture[];
  organization: OrganizationFixture;
  communityMemberships: CommunityMembershipFixture[];
  clubs: ClubFixture[];
  clubFollows: { userEmail: string; clubSlug: string }[];
  tournaments: TournamentFixture[];
  season: SeasonFixture;
  series: SeriesFixture;
  sessions: SessionFixture[];
  messages: MessageFixture[];
}

// ---------- Fictional people, real places ----------

const FIRST_NAMES = [
  "Mia", "Lachlan", "Isla", "Noah", "Chloe", "Oliver", "Zoe", "Hamish", "Ruby", "Angus",
  "Matilda", "Finn", "Harper", "Callum", "Evie", "Archie", "Sienna", "Jasper", "Grace", "Toby",
  "Poppy", "Riley", "Willow", "Hugo",
];
const LAST_NAMES = [
  "Thornbury", "Kellaway", "Ashdown", "Merriwa", "Coldstream", "Penrose", "Westbrook", "Halloran",
  "Brightwater", "Calloway", "Dunmore", "Fairhaven", "Glenrowan", "Harrowgate", "Inverell", "Jarrahdale",
  "Kingsbury", "Larkspur", "Marlowe", "Northcote", "Oakridge", "Pemberton", "Quorrobolong", "Rosewood",
];

interface Place { suburb: string; state: string; city: string; latitude: number; longitude: number }

const PLACES: readonly Place[] = [
  { suburb: "Moore Park", state: "NSW", city: "Sydney", latitude: -33.8935, longitude: 151.2238 },
  { suburb: "Strathfield", state: "NSW", city: "Sydney", latitude: -33.8794, longitude: 151.0825 },
  { suburb: "Manly", state: "NSW", city: "Sydney", latitude: -33.7969, longitude: 151.2850 },
  { suburb: "Parramatta", state: "NSW", city: "Sydney", latitude: -33.8150, longitude: 151.0011 },
  { suburb: "St Kilda", state: "VIC", city: "Melbourne", latitude: -37.8676, longitude: 144.9809 },
  { suburb: "Kooyong", state: "VIC", city: "Melbourne", latitude: -37.8396, longitude: 145.0339 },
  { suburb: "New Farm", state: "QLD", city: "Brisbane", latitude: -27.4680, longitude: 153.0490 },
  { suburb: "Tennyson", state: "QLD", city: "Brisbane", latitude: -27.5232, longitude: 152.9982 },
  { suburb: "Subiaco", state: "WA", city: "Perth", latitude: -31.9474, longitude: 115.8256 },
  { suburb: "Memorial Drive", state: "SA", city: "Adelaide", latitude: -34.9150, longitude: 138.5950 },
  { suburb: "Lyneham", state: "ACT", city: "Canberra", latitude: -35.2440, longitude: 149.1250 },
  { suburb: "Sandy Bay", state: "TAS", city: "Hobart", latitude: -42.9032, longitude: 147.3253 },
];

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Social"] as const;
const GAME_FORMATS = ["singles", "doubles", "both"] as const;
const PLAY_STYLES = ["Baseliner", "All-court", "Serve and volley", "Counter-puncher"] as const;
const HANDS = ["right", "left"] as const;
const COACH_TITLES = ["Head Coach", "Tennis Coach", "Junior Development Coach", "Performance Coach"] as const;
const COACH_TAGS = [["Juniors", "Beginners"], ["Adults", "Doubles"], ["Performance", "Tournament prep"], ["Cardio tennis", "Social"]];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function placeLabel(place: Place): string {
  return `${place.suburb}, ${place.state}`;
}

function day(anchor: Date, offsetDays: number, hourUtc: number): Date {
  const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + offsetDays, hourUtc, 0, 0));
  return d;
}

function isoDate(anchor: Date, offsetDays: number): string {
  return day(anchor, offsetDays, 0).toISOString().slice(0, 10);
}

// ---------- Users ----------

function baselineUser(identity: BaselineIdentity, index: number): UserFixture {
  const place = PLACES[index % PLACES.length];
  const isCoach = identity.userRole === "coach";
  return {
    kind: "baseline",
    email: identity.email,
    slug: identity.slug,
    name: identity.name,
    userRole: identity.userRole,
    isOrganizer: identity.isOrganizer,
    isAdmin: identity.isAdmin,
    // The admin account is not shown in public directories.
    listed: !identity.isAdmin,
    passwordEnv: identity.passwordEnv,
    playerProfile: isCoach
      ? null
      : {
          location: placeLabel(place),
          country: "Australia",
          skillLevel: SKILL_LEVELS[index % SKILL_LEVELS.length],
          bio: `Fictional E2E baseline account (${identity.role}). Not a real person.`,
          latitude: place.latitude,
          longitude: place.longitude,
          gameFormat: GAME_FORMATS[index % GAME_FORMATS.length],
          playStyle: PLAY_STYLES[index % PLAY_STYLES.length],
          playingHand: HANDS[index % HANDS.length],
        },
    coachProfile: isCoach
      ? {
          title: "Head Coach",
          country: "Australia",
          location: placeLabel(PLACES[0]),
          locations: [PLACES[0].suburb, PLACES[1].suburb],
          latitude: PLACES[0].latitude,
          longitude: PLACES[0].longitude,
          bio: "Fictional E2E baseline coach with a complete public profile. Not a real person.",
          rate: "$80/hr",
          experience: "10+ years",
          tags: ["Adults", "Juniors", "Doubles"],
          isCertified: true,
          certificationDetails: "Club Professional (fictional E2E record)",
        }
      : null,
  };
}

function fixturePlayer(n: number): UserFixture {
  const i = n - 1;
  const place = PLACES[i % PLACES.length];
  return {
    kind: "fixture",
    email: `e2e-fixture-player-${pad(n)}@tennisconnect.test`,
    slug: `e2e-fixture-player-${pad(n)}`,
    name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
    userRole: "player",
    isOrganizer: false,
    isAdmin: false,
    listed: true,
    passwordEnv: null,
    playerProfile: {
      location: placeLabel(place),
      country: "Australia",
      skillLevel: SKILL_LEVELS[i % SKILL_LEVELS.length],
      bio: `Fictional E2E fixture player ${pad(n)} based in ${place.city}. Not a real person.`,
      latitude: place.latitude,
      longitude: place.longitude,
      gameFormat: GAME_FORMATS[i % GAME_FORMATS.length],
      playStyle: PLAY_STYLES[i % PLAY_STYLES.length],
      playingHand: HANDS[i % HANDS.length],
    },
    coachProfile: null,
  };
}

function fixtureCoach(n: number): UserFixture {
  const i = n - 1;
  const place = PLACES[(i + 3) % PLACES.length];
  const nextPlace = PLACES[(i + 4) % PLACES.length];
  // Offset name pairing so coaches don't share names with fixture players.
  const first = FIRST_NAMES[(i + 7) % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 5 + 3) % LAST_NAMES.length];
  return {
    kind: "fixture",
    email: `e2e-fixture-coach-${pad(n)}@tennisconnect.test`,
    slug: `e2e-fixture-coach-${pad(n)}`,
    name: `${first} ${last}`,
    userRole: "coach",
    isOrganizer: false,
    isAdmin: false,
    listed: true,
    passwordEnv: null,
    playerProfile: null,
    coachProfile: {
      title: COACH_TITLES[i % COACH_TITLES.length],
      country: "Australia",
      location: placeLabel(place),
      locations: [place.suburb, nextPlace.suburb],
      latitude: place.latitude,
      longitude: place.longitude,
      bio: `Fictional E2E fixture coach ${pad(n)} in ${place.city}. Not a real person.`,
      rate: `$${60 + (i % 5) * 10}/hr`,
      experience: `${3 + (i % 8)} years`,
      tags: COACH_TAGS[i % COACH_TAGS.length],
      isCertified: i % 3 !== 2,
      certificationDetails: i % 3 !== 2 ? "Club Coach (fictional E2E record)" : null,
    },
  };
}

// ---------- Fixture set ----------

const P = (n: number) => `e2e-fixture-player-${pad(n)}@tennisconnect.test`;

export function buildFixtureSet(anchorInput: Date): FixtureSet {
  if (Number.isNaN(anchorInput.getTime())) throw new Error("buildFixtureSet: invalid anchor date");
  const anchor = new Date(Date.UTC(anchorInput.getUTCFullYear(), anchorInput.getUTCMonth(), anchorInput.getUTCDate()));

  const users: UserFixture[] = [
    ...BASELINE_IDENTITIES.map((identity, index) => baselineUser(identity, index)),
    ...Array.from({ length: FIXTURE_PLAYER_COUNT }, (_, i) => fixturePlayer(i + 1)),
    ...Array.from({ length: FIXTURE_COACH_COUNT }, (_, i) => fixtureCoach(i + 1)),
  ];

  const organiserEmail = "e2e-organiser@tennisconnect.test";
  const venue = PLACES[0];
  const venueLabel = "Fictional E2E Courts, Moore Park NSW";
  // 08:00 UTC = 18:00/19:00 Sydney (AEST/AEDT).
  const evening = (offset: number) => day(anchor, offset, 8);
  const later = (offset: number) => day(anchor, offset, 10);

  const baseSession = {
    location: venueLabel,
    latitude: venue.latitude,
    longitude: venue.longitude,
    timeZone: "Australia/Sydney",
    skillLevel: "Intermediate",
    courtsCount: 2,
    matchMode: "doubles" as const,
  };

  const sessions: SessionFixture[] = [
    {
      ...baseSession,
      key: "upcoming-full-waitlist",
      title: "[E2E] Upcoming Wednesday Social (full, waitlist)",
      description: "Fictional E2E session: full with a waiting list.",
      type: "social",
      status: "published",
      startAt: evening(FUTURE_HORIZON_DAYS),
      endAt: later(FUTURE_HORIZON_DAYS),
      maxParticipants: 4,
      waitingListEnabled: true,
      waitingListCapacity: 4,
      inSeries: true,
      registrations: [
        { userEmail: P(1), status: "registered", checkedIn: false },
        { userEmail: P(2), status: "registered", checkedIn: false },
        { userEmail: P(3), status: "registered", checkedIn: false },
        { userEmail: P(4), status: "registered", checkedIn: false },
        { userEmail: P(5), status: "waitlisted", checkedIn: false },
        { userEmail: P(6), status: "waitlisted", checkedIn: false },
      ],
      rounds: [],
    },
    {
      ...baseSession,
      key: "upcoming-open-clinic",
      title: "[E2E] Upcoming Doubles Clinic (open)",
      description: "Fictional E2E clinic with open places.",
      type: "clinic",
      status: "published",
      startAt: evening(FUTURE_HORIZON_DAYS + 7),
      endAt: later(FUTURE_HORIZON_DAYS + 7),
      maxParticipants: 8,
      waitingListEnabled: true,
      waitingListCapacity: null,
      inSeries: false,
      registrations: [
        { userEmail: P(7), status: "registered", checkedIn: false },
        { userEmail: P(8), status: "registered", checkedIn: false },
        { userEmail: "e2e-player-2@tennisconnect.test", status: "registered", checkedIn: false },
      ],
      rounds: [],
    },
    {
      ...baseSession,
      key: "completed-week-1",
      title: "[E2E] Completed Social Week 1 (scored)",
      description: "Fictional E2E completed session with confirmed scores.",
      type: "social",
      status: "completed",
      startAt: evening(-14),
      endAt: later(-14),
      maxParticipants: 8,
      waitingListEnabled: true,
      waitingListCapacity: null,
      inSeries: true,
      registrations: [1, 2, 3, 4].map(n => ({ userEmail: P(n), status: "registered" as const, checkedIn: true })),
      rounds: [
        { roundNumber: 1, matches: [{ courtLabel: "Court 1", teamA: [P(1), P(2)], teamB: [P(3), P(4)], teamAGames: 6, teamBGames: 3 }] },
        { roundNumber: 2, matches: [{ courtLabel: "Court 1", teamA: [P(1), P(3)], teamB: [P(2), P(4)], teamAGames: 4, teamBGames: 6 }] },
      ],
    },
    {
      ...baseSession,
      key: "completed-week-2",
      title: "[E2E] Completed Social Week 2 (scored)",
      description: "Fictional E2E completed session with confirmed scores.",
      type: "social",
      status: "completed",
      startAt: evening(-7),
      endAt: later(-7),
      maxParticipants: 8,
      waitingListEnabled: true,
      waitingListCapacity: null,
      inSeries: true,
      registrations: [1, 2, 3, 4].map(n => ({ userEmail: P(n), status: "registered" as const, checkedIn: true })),
      rounds: [
        { roundNumber: 1, matches: [{ courtLabel: "Court 1", teamA: [P(1), P(4)], teamB: [P(2), P(3)], teamAGames: 6, teamBGames: 2 }] },
      ],
    },
    {
      ...baseSession,
      key: "cancelled",
      title: "[E2E] Cancelled Social",
      description: "Fictional E2E cancelled session.",
      type: "social",
      status: "cancelled",
      startAt: evening(FUTURE_HORIZON_DAYS + 3),
      endAt: later(FUTURE_HORIZON_DAYS + 3),
      maxParticipants: 8,
      waitingListEnabled: false,
      waitingListCapacity: null,
      inSeries: false,
      registrations: [{ userEmail: P(9), status: "cancelled", checkedIn: false }],
      rounds: [],
    },
    {
      ...baseSession,
      key: "draft",
      title: "[E2E] Draft Session",
      description: "Fictional E2E draft session (not public).",
      type: "social",
      status: "draft",
      startAt: evening(FUTURE_HORIZON_DAYS + 14),
      endAt: later(FUTURE_HORIZON_DAYS + 14),
      maxParticipants: 8,
      waitingListEnabled: true,
      waitingListCapacity: null,
      inSeries: false,
      registrations: [],
      rounds: [],
    },
    {
      ...baseSession,
      key: "upcoming-tournament",
      title: "[E2E] Club Championship",
      description: "Fictional E2E tournament-format session.",
      type: "tournament",
      status: "published",
      startAt: evening(FUTURE_HORIZON_DAYS + 30),
      endAt: later(FUTURE_HORIZON_DAYS + 30),
      maxParticipants: 16,
      waitingListEnabled: true,
      waitingListCapacity: null,
      inSeries: false,
      registrations: [10, 11, 12, 13].map(n => ({ userEmail: P(n), status: "registered" as const, checkedIn: false })),
      rounds: [],
    },
  ];

  return {
    anchor: anchor.toISOString().slice(0, 10),
    users,
    organization: {
      slug: "e2e-harbourside-social",
      name: "[E2E] Harbourside Social Tennis",
      description: "Fictional E2E community organisation. Not a real club.",
      type: "community",
      status: "active",
      ownerEmail: organiserEmail,
      email: FIXTURE_CONTACT_EMAIL,
    },
    communityMemberships: [
      { userEmail: "e2e-player@tennisconnect.test", status: "accepted" },
      { userEmail: "e2e-player-2@tennisconnect.test", status: "pending" },
      { userEmail: P(1), status: "declined" },
    ],
    clubs: [
      {
        slug: "e2e-club-moore-park", name: "[E2E] Moore Park Tennis Club (fictional)", category: "club",
        shortDescription: "Fictional E2E club with public courts.",
        description: "Fictional E2E club listing used by automated tests. Not a real club.",
        location: "Moore Park, NSW", suburb: "Moore Park", state: "NSW", latitude: -33.8935, longitude: 151.2238,
        email: FIXTURE_CONTACT_EMAIL, status: "published", hasCourts: true, hasCommunity: true, hasCoaching: true,
        outdoorCourts: 8, indoorCourts: 0, courtSurfaces: ["hard"], publicAccess: true, membershipRequired: false,
      },
      {
        slug: "e2e-club-kooyong", name: "[E2E] Kooyong Members Club (fictional)", category: "club",
        shortDescription: "Fictional E2E members-only club.",
        description: "Fictional E2E club listing used by automated tests. Not a real club.",
        location: "Kooyong, VIC", suburb: "Kooyong", state: "VIC", latitude: -37.8396, longitude: 145.0339,
        email: FIXTURE_CONTACT_EMAIL, status: "published", hasCourts: true, hasCommunity: false, hasCoaching: true,
        outdoorCourts: 10, indoorCourts: 2, courtSurfaces: ["grass", "hard"], publicAccess: false, membershipRequired: true,
      },
      {
        slug: "e2e-club-new-farm", name: "[E2E] New Farm Social Group (fictional)", category: "social-group",
        shortDescription: "Fictional E2E social group, no courts of its own.",
        description: "Fictional E2E community listing used by automated tests. Not a real group.",
        location: "New Farm, QLD", suburb: "New Farm", state: "QLD", latitude: -27.4680, longitude: 153.0490,
        email: FIXTURE_CONTACT_EMAIL, status: "published", hasCourts: false, hasCommunity: true, hasCoaching: false,
        outdoorCourts: 0, indoorCourts: 0, courtSurfaces: [], publicAccess: true, membershipRequired: false,
      },
    ],
    clubFollows: [{ userEmail: "e2e-player@tennisconnect.test", clubSlug: "e2e-club-moore-park" }],
    tournaments: [
      {
        slug: "e2e-tournament-spring-open", name: "[E2E] Spring Open (fictional)",
        startDate: isoDate(anchor, FUTURE_HORIZON_DAYS + 20), endDate: isoDate(anchor, FUTURE_HORIZON_DAYS + 22), location: "Moore Park, NSW",
        level: "Intermediate", price: 45, maxParticipants: 32, currentParticipants: 12,
        description: "Fictional E2E upcoming tournament.", organizer: "[E2E] Harbourside Social Tennis",
        email: FIXTURE_CONTACT_EMAIL, coverImage: DEFAULT_COVER, status: "upcoming", winner: null, finalist: null,
      },
      {
        slug: "e2e-tournament-summer-doubles", name: "[E2E] Summer Doubles (fictional)",
        startDate: isoDate(anchor, FUTURE_HORIZON_DAYS + 45), endDate: isoDate(anchor, FUTURE_HORIZON_DAYS + 45), location: "St Kilda, VIC",
        level: "Advanced", price: 60, maxParticipants: 16, currentParticipants: 4,
        description: "Fictional E2E upcoming doubles tournament.", organizer: "[E2E] Harbourside Social Tennis",
        email: FIXTURE_CONTACT_EMAIL, coverImage: DEFAULT_COVER, status: "upcoming", winner: null, finalist: null,
      },
      {
        slug: "e2e-tournament-winter-classic", name: "[E2E] Winter Classic (fictional)",
        startDate: isoDate(anchor, -60), endDate: isoDate(anchor, -59), location: "New Farm, QLD",
        level: "Beginner", price: 30, maxParticipants: 16, currentParticipants: 16,
        description: "Fictional E2E past tournament with results.", organizer: "[E2E] Harbourside Social Tennis",
        email: FIXTURE_CONTACT_EMAIL, coverImage: DEFAULT_COVER, status: "past",
        winner: "Mia Thornbury", finalist: "Lachlan Kellaway",
      },
    ],
    season: {
      name: "[E2E] Summer Social Season",
      type: "social",
      startDate: isoDate(anchor, -30),
      endDate: isoDate(anchor, FUTURE_HORIZON_DAYS + 185),
      description: "Fictional E2E season.",
    },
    series: { name: "[E2E] Wednesday Social Series", format: "social", description: "Fictional E2E series." },
    sessions,
    messages: [
      {
        key: "player-to-coach", fromEmail: "e2e-player@tennisconnect.test", toEmail: "e2e-coach@tennisconnect.test",
        recipientType: "coach", subject: "[E2E] Coaching enquiry",
        content: "Fictional E2E message: are you taking new adult students on weekday evenings?",
      },
      {
        key: "coach-reply", fromEmail: "e2e-coach@tennisconnect.test", toEmail: "e2e-player@tennisconnect.test",
        recipientType: "player", subject: "[E2E] Coaching enquiry",
        content: "Fictional E2E reply: yes, Tuesday and Thursday evenings are available.",
      },
      {
        key: "player-to-player", fromEmail: "e2e-player@tennisconnect.test", toEmail: "e2e-player-2@tennisconnect.test",
        recipientType: "player", subject: "[E2E] Hit this weekend?",
        content: "Fictional E2E message: keen for a hit at Moore Park on Saturday morning?",
      },
    ],
  };
}

// ---------- Invariants (checked by tests and by the seed before writing) ----------

export function fixtureInvariantProblems(set: FixtureSet): string[] {
  const problems: string[] = [];
  const emails = new Set<string>();
  const slugs = new Set<string>();

  for (const user of set.users) {
    if (emails.has(user.email)) problems.push(`duplicate email ${user.email}`);
    if (slugs.has(user.slug)) problems.push(`duplicate slug ${user.slug}`);
    emails.add(user.email);
    slugs.add(user.slug);
    if (!user.email.endsWith("@tennisconnect.test")) problems.push(`non-reserved email ${user.email}`);
    if (user.userRole === "coach" ? !user.coachProfile : !user.playerProfile) problems.push(`${user.email} lacks its profile`);
    if (user.isAdmin && user.kind !== "baseline") problems.push(`${user.email}: admin must be a baseline account`);
  }

  const admins = set.users.filter(user => user.isAdmin);
  if (admins.length !== 1 || admins[0].email !== "e2e-admin@tennisconnect.test") {
    problems.push("exactly one admin (e2e-admin@tennisconnect.test) is allowed");
  }

  const listedCoaches = set.users.filter(user => user.listed && user.userRole === "coach").length;
  const listedPlayers = set.users.filter(user => user.listed && user.userRole === "player").length;
  if (listedCoaches <= COACHES_PER_PAGE) problems.push(`only ${listedCoaches} listed coaches; pagination needs > ${COACHES_PER_PAGE}`);
  if (listedPlayers <= PLAYERS_PER_PAGE) problems.push(`only ${listedPlayers} listed players; pagination needs > ${PLAYERS_PER_PAGE}`);

  const referenced = [
    set.organization.ownerEmail,
    ...set.communityMemberships.map(m => m.userEmail),
    ...set.clubFollows.map(f => f.userEmail),
    ...set.sessions.flatMap(s => s.registrations.map(r => r.userEmail)),
    ...set.sessions.flatMap(s => s.rounds.flatMap(r => r.matches.flatMap(m => [...m.teamA, ...m.teamB]))),
    ...set.messages.flatMap(m => [m.fromEmail, m.toEmail]),
  ];
  for (const email of referenced) {
    if (!emails.has(email)) problems.push(`reference to unknown fixture user ${email}`);
  }

  for (const session of set.sessions) {
    if (!session.title.startsWith("[E2E] ")) problems.push(`session title must start with "[E2E] ": ${session.title}`);
    const registered = session.registrations.filter(r => r.status === "registered").length;
    if (registered > session.maxParticipants) problems.push(`${session.key}: more registered than maxParticipants`);
    const regEmails = new Set(session.registrations.map(r => r.userEmail));
    if (regEmails.size !== session.registrations.length) problems.push(`${session.key}: duplicate registration`);
    for (const round of session.rounds) {
      for (const match of round.matches) {
        for (const email of [...match.teamA, ...match.teamB]) {
          if (!regEmails.has(email)) problems.push(`${session.key}: match player ${email} is not registered`);
        }
      }
    }
  }

  for (const item of [set.organization, ...set.clubs, ...set.tournaments]) {
    if (!item.slug.startsWith("e2e-")) problems.push(`slug must start with "e2e-": ${item.slug}`);
    if (item.email !== FIXTURE_CONTACT_EMAIL) problems.push(`${item.slug}: missing fixture contact email marker`);
  }

  // Dates: past items strictly before the anchor, future items at least
  // FUTURE_HORIZON_DAYS after it - nothing in between that could expire soon.
  const anchorMs = Date.parse(`${set.anchor}T00:00:00Z`);
  const horizonMs = anchorMs + FUTURE_HORIZON_DAYS * 86_400_000;
  for (const item of datedItems(set)) {
    const ms = item.date.getTime();
    if (item.past ? ms >= anchorMs : ms < horizonMs) {
      problems.push(`${item.label}: ${item.past ? "past item not before the anchor" : `future item less than ${FUTURE_HORIZON_DAYS} days after the anchor`}`);
    }
  }

  return problems;
}

interface DatedItem {
  label: string;
  date: Date;
  past: boolean;
}

function datedItems(set: FixtureSet): DatedItem[] {
  const items: DatedItem[] = [];
  for (const session of set.sessions) {
    const past = session.status === "completed";
    items.push({ label: `session ${session.key} start`, date: session.startAt, past });
    items.push({ label: `session ${session.key} end`, date: session.endAt, past });
  }
  for (const tournament of set.tournaments) {
    const past = tournament.status === "past";
    items.push({ label: `tournament ${tournament.slug} start`, date: new Date(`${tournament.startDate}T00:00:00Z`), past });
    items.push({ label: `tournament ${tournament.slug} end`, date: new Date(`${tournament.endDate}T00:00:00Z`), past });
  }
  items.push({ label: "season start", date: new Date(`${set.season.startDate}T00:00:00Z`), past: true });
  items.push({ label: "season end", date: new Date(`${set.season.endDate}T00:00:00Z`), past: false });
  return items;
}

/**
 * The earliest future-dated fixture. "Upcoming" data stays upcoming until
 * then; re-run the seed before this date to refresh it.
 */
export function fixtureValidUntil(set: FixtureSet): Date {
  const future = datedItems(set).filter(item => !item.past).map(item => item.date.getTime());
  return new Date(Math.min(...future));
}
