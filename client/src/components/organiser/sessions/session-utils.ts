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
