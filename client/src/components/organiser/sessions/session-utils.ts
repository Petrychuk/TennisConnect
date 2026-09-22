import { Users, type LucideIcon } from "lucide-react";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

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
  "registration-open": "bg-white text-primary",
  upcoming: "bg-secondary text-secondary-foreground",
  draft: "bg-muted text-muted-foreground",
  completed: "bg-accent text-accent-foreground",
  archived: "bg-muted text-muted-foreground",
};

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
export function getPrimaryActionMeta(bucket: Exclude<SessionBucket, "all">, playIcon: LucideIcon): SessionPrimaryAction {
  switch (bucket) {
    case "draft":
      return { label: "Continue Setup", urgent: true };
    case "live":
      return { label: "Enter Live", urgent: true, icon: playIcon };
    case "completed":
      return { label: "View Results", urgent: false };
    case "archived":
      return { label: "View History", urgent: false };
    default:
      return { label: "Manage Session", urgent: true }; // registration-open, upcoming
  }
}
