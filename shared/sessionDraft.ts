// Rules for session DRAFTS, shared by the server routes and the wizard so both
// sides say the same thing (shared/sessionDraft.test.ts).
//
//  - A draft may be incomplete. Saving one never asks for publish-only things
//    (a real name, a venue, a future date). Those are checked when the draft is
//    submitted: publishProblems().
//  - Only a draft (or a rejected session being fixed and resubmitted) can be
//    published. Publishing a live, published, cancelled or completed session
//    used to silently reset it to "pending_review".
//  - Two devices editing one draft must not silently overwrite each other: a
//    save carries the `updatedAt` the editor last saw (expectedUpdatedAt) and is
//    refused with 409 if the row has moved on.
//  - Clearing a field in the form has to clear it in the row: the client sends
//    `null` for a cleared optional field and splitNullClears() turns that into a
//    real NULL (the insert schema's coerce rules would turn null into 1970 or 0).

/** Stored as the title of a draft whose name hasn't been typed yet (title is NOT NULL, min 2). */
export const DRAFT_PLACEHOLDER_TITLE = "Untitled Session";

export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  return t === "" || t.toLowerCase() === DRAFT_PLACEHOLDER_TITLE.toLowerCase();
}

/** Statuses an organiser can publish from. A rejected session is fixed and resubmitted. */
export const PUBLISHABLE_STATUSES = ["draft", "rejected"] as const;

export function publishStatusProblem(status: string | null | undefined): string | null {
  if ((PUBLISHABLE_STATUSES as readonly string[]).includes(status ?? "")) return null;
  return `This session is already ${status ?? "in another state"}, so it can't be published again.`;
}

export interface PublishableSession {
  title?: string | null;
  location?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  registrationOpensAt?: Date | string | null;
  registrationClosesAt?: Date | string | null;
}

const ts = (v: Date | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? null : n;
};

/** What is still missing before a draft can be submitted. Empty = ready. */
export function publishProblems(session: PublishableSession, now: number = Date.now()): string[] {
  const problems: string[] = [];
  if (isPlaceholderTitle(session.title) || (session.title ?? "").trim().length < 2) problems.push("Give the session a name.");
  if (!(session.location ?? "").trim()) problems.push("Add a venue.");
  const start = ts(session.startAt);
  if (start === null) problems.push("Pick a date and start time.");
  const end = ts(session.endAt);
  // Over only when it has ended (or, with no end time, started): one that is running right now is still publishable.
  if (start !== null && (end ?? start) <= now) problems.push("The session date has already passed. Pick a future date.");
  if (start !== null && end !== null && end <= start) problems.push("The end time must be after the start time.");
  const opens = ts(session.registrationOpensAt);
  const closes = ts(session.registrationClosesAt);
  if (opens !== null && closes !== null && closes < opens) problems.push("Registration can't close before it opens.");
  return problems;
}

/** Optional columns the form can empty out. Everything else keeps "omitted = unchanged". */
export const CLEARABLE_SESSION_FIELDS = [
  "description",
  "coverImage",
  "location",
  "endAt",
  "registrationOpensAt",
  "registrationClosesAt",
  "maxParticipants",
  "courtsCount",
  "waitingListCapacity",
  "seasonId",
  "matchMode",
  "category",
  "gamesTo",
  "plannedRoundsCount",
  "rulesText",
  "refundPolicy",
  "latePolicy",
  "cancellationPolicy",
] as const;

/** Separates `{ field: null }` (clear it) from the rest of a PUT body. */
export function splitNullClears(body: Record<string, unknown>): { rest: Record<string, unknown>; clears: Record<string, null> } {
  const rest: Record<string, unknown> = {};
  const clears: Record<string, null> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (value === null && (CLEARABLE_SESSION_FIELDS as readonly string[]).includes(key)) clears[key] = null;
    else rest[key] = value;
  }
  return { rest, clears };
}

export type ExpectedUpdatedAt = { kind: "absent" } | { kind: "invalid" } | { kind: "ok"; at: Date };

/** The `expectedUpdatedAt` of a save request (stale-write guard). Optional so existing callers keep working. */
export function readExpectedUpdatedAt(raw: unknown): ExpectedUpdatedAt {
  if (raw === undefined || raw === null) return { kind: "absent" };
  if (typeof raw !== "string" && !(raw instanceof Date)) return { kind: "invalid" };
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? { kind: "invalid" } : { kind: "ok", at };
}

export const STALE_DRAFT_MESSAGE =
  "This draft was changed somewhere else (another tab or device) after you opened it. Reload to see the latest version before saving, so nothing is overwritten.";
