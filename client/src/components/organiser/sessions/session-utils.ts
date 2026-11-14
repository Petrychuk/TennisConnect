import { Users, type LucideIcon } from "lucide-react";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { isReadyToStart } from "@shared/sessionLifecycle";

export type SessionBucket =
  | "all"
  | "live"
  | "registration-open"
  | "upcoming"
  | "draft"
  | "completed"
  | "archived";

export const BUCKET_LABEL: Record<SessionBucket, string> = {
  all: "All",
  live: "Live",
  "registration-open": "Registration Open",
  upcoming: "Upcoming",
  draft: "Draft",
  completed: "Completed",
  archived: "Archived",
};

export const BUCKET_ORDER: SessionBucket[] = [
  "all",
  "live",
  "registration-open",
  "upcoming",
  "draft",
  "completed",
  "archived",
];

export function bucketFor(session: SessionListItem): Exclude<SessionBucket, "all"> {
  if (session.status === "live") return "live";
  if (session.status === "draft") return "draft";
  if (session.status === "completed") return "completed";
  if (session.status === "archived") return "archived";
  if (session.status === "published" && session.registrationOpen) return "registration-open";
  return "upcoming"; // published-but-closed/full, or pending_review
}

export function groupSessionsByBucket(sessions: SessionListItem[]) {
  const groups: Record<Exclude<SessionBucket, "all">, SessionListItem[]> = {
    live: [],
    "registration-open": [],
    upcoming: [],
    draft: [],
    completed: [],
    archived: [],
  };
  for (const session of sessions) {
    groups[bucketFor(session)].push(session);
  }
  return groups;
}

// Shared between session-card.tsx (list row) and session-card-grid.tsx
// (grid card) - both need the exact same status labelling/styling and
// "what's the one primary action for this status" logic; kept here so
// the two layouts can never quietly drift out of sync with each other.
export const STATUS_BADGE_LABEL: Record<string, string> = {
  live: "LIVE",
  "registration-open": "Registration Open",
  upcoming: "Upcoming",
  draft: "Draft",
  completed: "Completed",
  archived: "Archived",
};

// Deliberately just background/primary/muted/destructive tints - no
// per-status hue palette (green/orange/blue/purple like the mockup),
// keeping to the project's existing tokens.
export const STATUS_BADGE_STYLE: Record<string, string> = {
  live: "bg-primary text-foreground",
  "registration-open": "bg-white text-primary-text",
  upcoming: "bg-secondary text-secondary-foreground",
  draft: "bg-muted text-muted-foreground",
  completed: "bg-accent text-accent-foreground",
  archived: "bg-muted text-muted-foreground",
};

/**
 * The organiser's status label for a session: the bucket's label, except a
 * published session from 2 hours before its start - and after it, until the
 * organiser starts TC Live - reads "Ready to Start" (shared/sessionLifecycle.ts).
 * Every Hub screen (list row, grid card, workspace header) uses this one.
 */
export function sessionStatusLabel(session: { status: string; startAt: string | Date }, bucket: Exclude<SessionBucket, "all">): string {
  if ((bucket === "registration-open" || bucket === "upcoming") && isReadyToStart(session)) return "Ready to Start";
  return STATUS_BADGE_LABEL[bucket];
}

export interface SessionPrimaryAction {
  label: string;
  urgent: boolean;
  icon?: LucideIcon;
}

// Green (the site's actual "act now" colour) is reserved for actions
// that genuinely need attention right now - Continue Setup, Enter
// Live, Manage Session. View Results/View History are the least
// urgent thing on the page (the session already happened), so they
// stay a plain outline button instead of visually shouting louder
// than an unfinished draft or a live session in progress.
// hasRounds: false for Coaching & Fitness (shared/sessionCategories.ts) -
// they have no Results tab, so a finished one opens its players instead.
export function getPrimaryActionMeta(bucket: Exclude<SessionBucket, "all">, playIcon: LucideIcon, liveAvailable = true, hasRounds = true, readyToStart = false): SessionPrimaryAction {
  // Ready to Start: the one action is starting TC Live (the organiser's
  // explicit step - the clock never starts it).
  if (readyToStart && liveAvailable && hasRounds && (bucket === "registration-open" || bucket === "upcoming")) {
    return { label: "Start Live", urgent: true, icon: playIcon };
  }
  switch (bucket) {
    case "draft":
      return { label: "Continue Setup", urgent: true };
    case "live":
      // Without TC Live (Production) the button opens the workspace.
      return liveAvailable ? { label: "Enter Live", urgent: true, icon: playIcon } : { label: "Manage Session", urgent: true };
    case "completed":
    case "archived":
      // Archived used to say "View History" and open ?tab=history, a tab
      // that doesn't exist (it fell back to Overview).
      return { label: hasRounds ? "View Results" : "View Players", urgent: false };
    default:
      return { label: "Manage Session", urgent: true }; // registration-open, upcoming
  }
}

/**
 * Where "open / edit this session" goes. A draft is finished in the wizard (all
 * four steps, Save as Draft, Publish); the flat Edit page is for sessions that
 * are already out (it asks for name, venue and date, which a draft may not have yet).
 */
/** A finished session (completed or archived) keeps its results: it can be viewed and duplicated, never edited. */
export function canEditSession(session: { status: string }): boolean {
  return session.status !== "archived" && session.status !== "completed";
}

export function sessionEditPath(session: { id: string; status: string }): string {
  return session.status === "draft" ? `/organiser/sessions/new?draft=${session.id}` : `/organiser/sessions/${session.id}/edit`;
}
