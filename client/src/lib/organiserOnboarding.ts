import type { OrganizerStatusData } from "@/hooks/use-organizer-status";
import { resolveOrganizerCardView } from "@/lib/organizer-status";

// What the "Ready to organise tennis with TennisConnect?" modal shows a
// signed-in person who is not an organiser or admin. Pure, so it is unit-tested
// without a DOM. It only chooses what to SHOW: the server still decides who
// may request or organise (POST /api/organizer/requests, requireOrganizer).

export const ONBOARDING_COPY = {
  heading: "Ready to organise tennis with TennisConnect?",
  body: "Organiser Hub is an additional feature for people who want to create and manage tennis sessions, events and competitions.",
  benefits: [
    "Create and manage tennis sessions",
    "Manage registrations and players",
    "Track scores and results",
  ],
  requestCta: "Request Organiser Access",
  requestAgainCta: "Request Access Again",
  backCta: "Back to My Profile",
  note: "Organiser access is subject to approval. You can request access whenever you're ready.",
  pending: "Your organiser request is under review",
  submitted: "Your request has been submitted. We'll review your request and let you know when there's an update.",
  rejected: "Your last request was not approved.",
  revoked: "Your organiser access was revoked.",
  statusError: "We couldn't check your request status. Please try again.",
} as const;

export type OnboardingView =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "submitted" }
  | { kind: "rejected" }
  | { kind: "revoked" }
  | { kind: "approved" };

export interface OnboardingInput {
  status: OrganizerStatusData | null;
  loading: boolean;
  /** This visit already sent a request that the server accepted. */
  submitted: boolean;
}

export function resolveOnboardingView({ status, loading, submitted }: OnboardingInput): OnboardingView {
  if (!status) return loading ? { kind: "loading" } : { kind: "error" };
  // Same rule as the profile card: real access outranks any request row.
  const card = resolveOrganizerCardView(status);
  if (card.kind === "approved") return { kind: "approved" };
  if (card.kind === "pending") return submitted ? { kind: "submitted" } : { kind: "pending" };
  if (submitted) return { kind: "submitted" };
  return card;
}

/** The request button is only live where the API would accept a request. */
export function canRequestAccess(view: OnboardingView): boolean {
  return view.kind === "none" || view.kind === "rejected" || view.kind === "revoked";
}
