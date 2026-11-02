/*
  Session categories (Organiser Hub, Phase 2 Batch 2).

  The Create Session wizard used to offer 12 flat "types". None of them
  changed the later steps, the Session Workspace or the Live engine - only
  labels and a few hard-coded "is this a competition" lists in five places.
  Organisers now choose one of four CATEGORIES, decided by what the event
  actually contains, and then a FORMAT inside it.

  The format is the existing `sessions.type` value, so every stored session,
  URL, Play filter and template keeps working - no data migration. The one
  new key is `junior-development`: "Junior Event" meant both a junior
  competition and a junior coaching programme, so it is split by purpose:
    junior-event       -> Competition       (label "Junior Competition")
    junior-development -> Coaching & Fitness (label "Junior Development")

  What each category shows (wizard Step 3, Session Workspace):
    social-play       match format + scoring + rounds; Live rounds; results
    competition       match format + scoring + rounds; Live rounds; results.
                      No seeded draws or knockout brackets - the Live engine
                      doesn't build them, so nothing claims it does.
    coaching-fitness  no match format, rounds, scores or Live: coach-led
    other             everything optional (custom)
*/

export type SessionCategoryKey = "social-play" | "competition" | "coaching-fitness" | "other";

export interface SessionCategory {
  key: SessionCategoryKey;
  label: string;
  description: string;
  /** Existing sessions.type values in this category, most common first. */
  formats: readonly string[];
  /** Match format, scoring and rounds apply (wizard Step 3, Format tab). */
  usesMatchFormat: boolean;
  /** Can be run with TC Live rounds and has a results leaderboard. */
  usesLiveRounds: boolean;
}

export const SESSION_CATEGORIES: readonly SessionCategory[] = [
  {
    key: "social-play",
    label: "Social Play",
    description: "Rotating doubles or singles on courts, with rounds and scores.",
    formats: ["social", "americano", "mexicano", "round-robin", "king-of-the-court"],
    usesMatchFormat: true,
    usesLiveRounds: true,
  },
  {
    key: "competition",
    label: "Competition",
    description: "Results matter: players compete for a ranking or a title.",
    formats: ["tournament", "league", "club-championship", "junior-event"],
    usesMatchFormat: true,
    usesLiveRounds: true,
  },
  {
    key: "coaching-fitness",
    label: "Coaching & Fitness",
    description: "Coach-led sessions: skills, drills and fitness. No rounds or scores.",
    formats: ["coaching-clinic", "cardio-tennis", "junior-development"],
    usesMatchFormat: false,
    usesLiveRounds: false,
  },
  {
    key: "other",
    label: "Other",
    description: "Anything else - you choose what to set up.",
    formats: ["custom"],
    usesMatchFormat: true,
    usesLiveRounds: true,
  },
];

const BY_FORMAT = new Map<string, SessionCategory>(
  SESSION_CATEGORIES.flatMap((category) => category.formats.map((format) => [format, category] as const)),
);

/** Category of a stored session type. Unknown or missing types count as "other". */
export function sessionCategoryOf(type: string | null | undefined): SessionCategory {
  return (type && BY_FORMAT.get(type)) || SESSION_CATEGORIES[SESSION_CATEGORIES.length - 1];
}

/** Competition events: "Join Competition", the Play "Competitions" filter, recommendations. */
export function isCompetitionType(type: string | null | undefined): boolean {
  return sessionCategoryOf(type).key === "competition";
}

/** Every format key, in category order. */
export const ALL_SESSION_FORMATS: readonly string[] = SESSION_CATEGORIES.flatMap((category) => category.formats);
