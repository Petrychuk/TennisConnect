import type { OrganizerStatusData } from "@/hooks/use-organizer-status";

// [BUG][ORGANIZER] Regression guard, extracted from BecomeOrganizerCard.tsx.
//
// Reported symptom: a coach (and possibly a player) whose Organizer
// Request was approved by an admin still sees "Pending" on their own
// profile, with no "Open Organiser Hub" button and no notification.
//
// This function is the exact decision BecomeOrganizerCard.tsx makes about
// which of its five blocks to render - pulled out as a pure function (no
// JSX, no React) so it can be unit-tested without a DOM. The card and this
// resolver must always agree, so the card calls this instead of repeating
// the same chain of conditions inline.
//
// The one rule this exists to protect: `isOrganizer` is checked BEFORE
// `request.status`. An approved organizer is shown as approved even if a
// stale request row (an old rejected/revoked one, or a duplicate pending
// one left over from a race) is sitting underneath - the account's actual
// access always wins over the paperwork about it.
export type OrganizerCardView =
  | { kind: "approved" }
  | { kind: "pending" }
  | { kind: "rejected" }
  | { kind: "revoked" }
  | { kind: "none" };

export function resolveOrganizerCardView(status: OrganizerStatusData): OrganizerCardView {
  if (status.isOrganizer) return { kind: "approved" };

  switch (status.request?.status) {
    case "pending":
      return { kind: "pending" };
    case "rejected":
      return { kind: "rejected" };
    case "revoked":
      return { kind: "revoked" };
    default:
      // No request at all, or a request whose status this card doesn't
      // otherwise handle - either way, "Become an Organiser" is the
      // right thing to offer.
      return { kind: "none" };
  }
}
