import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useOrganiserSessions } from "@/lib/organiser-sessions-store";
import { getSessionDetail, type SessionListItem } from "@/lib/organiser-sessions-mock-data";
import { useMyRegistrations, getRegistrationStatus, joinSession } from "@/lib/session-registrations-store";

interface MyOrganizedSessionsSectionProps {
  isOwnProfile: boolean;
}

const OWNER_STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-secondary text-secondary-foreground",
  published: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  live: "bg-primary text-primary-foreground",
  completed: "bg-accent text-accent-foreground",
  archived: "bg-muted text-muted-foreground",
};

const OWNER_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

type GuestBucket = "open" | "waitlist" | "closed" | "live" | "archive";

const GUEST_STATUS_LABEL: Record<GuestBucket, string> = {
  open: "Registration Open",
  waitlist: "Waiting List",
  closed: "Registration Closed",
  live: "Live Now",
  archive: "Archive",
};

const GUEST_STATUS_BADGE: Record<GuestBucket, string> = {
  open: "bg-primary/10 text-primary",
  waitlist: "bg-secondary text-secondary-foreground",
  closed: "bg-muted text-muted-foreground",
  live: "bg-primary text-primary-foreground",
  archive: "bg-muted text-muted-foreground",
};

// A session only becomes visible to anyone other than its own organiser
// once it's published - drafts, pending review, and rejected sessions
// are the organiser's own business until then.
function guestBucketFor(session: SessionListItem): GuestBucket | null {
  if (session.status === "live") return "live";
  if (session.status === "completed" || session.status === "archived") return "archive";
  if (session.status !== "published") return null;
  const isFull = session.maxParticipants != null && session.registeredCount >= session.maxParticipants;
  if (!session.registrationOpen) return "closed";
  if (isFull) return session.waitingListEnabled ? "waitlist" : "closed";
  return "open";
}

// "Organiser & Sessions" — as opposed to MySessionsSection, which is
// sessions this viewer has *joined* as a player. Read-only for
// managing (that happens in the Organiser Hub); this is the at-a-
// glance view on the profile, and for other visitors, the entry point
// into actually joining.
//
// Reads from the same client-side store the Organiser Hub's Sessions
// page, wizard, and admin approval queue all use
// (organiser-sessions-store.ts) rather than a backend endpoint -
// there's no backend for this yet, and this is what makes a session
// created in the wizard and approved by an admin actually show up
// here, for the right audience, with the right status.
export function MyOrganizedSessionsSection({ isOwnProfile }: MyOrganizedSessionsSectionProps) {
  const allSessions = useOrganiserSessions();
  const { user, isAuthenticated } = useAuth();
  const registrations = useMyRegistrations();
  const { toast } = useToast();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [policyOpenId, setPolicyOpenId] = useState<string | null>(null);

  // Mock-data phase: every session in the shared store is treated as
  // belonging to whichever organiser is viewing/joining, since there's
  // only ever one organiser persona in this world so far. Once sessions
  // carry a real ownerId, this narrows to sessions where
  // session.ownerId === profile.userId.
  const sessions = isOwnProfile
    ? allSessions
    : allSessions.filter((s) => guestBucketFor(s) !== null);

  const [, setLocation] = useLocation();

  const handleJoin = (session: SessionListItem) => {
    if (!isAuthenticated) {
      setLocation("/auth");
      return;
    }
    setJoiningId(session.id);
    const status = joinSession(session.id);
    toast({
      title: status === "waitlisted" ? "Added to the waiting list" : "You're in!",
      description:
        status === "waitlisted"
          ? `"${session.title}" is full — you'll move up automatically if a spot opens.`
          : `You've joined "${session.title}".`,
    });
    setJoiningId(null);
  };

  return (
    <div className="space-y-3" data-testid="my-organized-sessions-list">
      {isOwnProfile && (
        <div className="flex justify-end">
          <Button asChild size="sm" data-testid="go-to-organizer-dashboard-from-profile">
            <Link href="/organiser">
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage in Organiser Hub
            </Link>
          </Button>
        </div>
      )}

      {sessions.length === 0 ? (
        <Card data-testid="my-organized-sessions-empty">
          <CardContent className="py-10 text-center text-muted-foreground">
            {isOwnProfile
              ? "You haven't created any sessions yet. Head to your Organiser Hub to create one."
              : "No sessions to show yet."}
          </CardContent>
        </Card>
      ) : (
        sessions.map((session) => {
          const guestBucket = guestBucketFor(session);
          const detail = getSessionDetail(session);
          const myStatus = getRegistrationStatus(session.id);
          const canJoin = !isOwnProfile
            ? (guestBucket === "open" || guestBucket === "waitlist") && !myStatus
            : (guestBucket === "open" || guestBucket === "waitlist") && !myStatus && detail.organizerName === user?.name;
          const showPolicy = policyOpenId === session.id;

          return (
            <Card key={session.id} data-testid={`my-organized-session-${session.id}`}>
              <CardHeader className="pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{session.title}</span>
                      {isOwnProfile ? (
                        <Badge className={OWNER_STATUS_BADGE[session.status]}>{OWNER_STATUS_LABEL[session.status]}</Badge>
                      ) : (
                        guestBucket && <Badge className={GUEST_STATUS_BADGE[guestBucket]}>{GUEST_STATUS_LABEL[guestBucket]}</Badge>
                      )}
                      {myStatus === "waitlisted" && <Badge variant="secondary">Waitlisted</Badge>}
                      {myStatus === "registered" && <Badge className="bg-primary/10 text-primary">Joined</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(session.startAt).toLocaleString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {session.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {session.location}
                        </span>
                      )}
                      <Badge variant="secondary" className="capitalize">
                        {session.type.replace("-", " ")}
                      </Badge>
                    </div>
                  </div>

                  {canJoin && (
                    <Button
                      size="sm"
                      onClick={() => handleJoin(session)}
                      disabled={joiningId === session.id}
                      data-testid={`join-session-${session.id}`}
                    >
                      {isAuthenticated ? "Join" : "Sign in to Join"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                {session.status === "rejected" && isOwnProfile && session.reviewNote && (
                  <p className="text-sm text-destructive">Note: {session.reviewNote}</p>
                )}

                {(guestBucket === "open" || guestBucket === "waitlist") && (
                  <button
                    type="button"
                    onClick={() => setPolicyOpenId(showPolicy ? null : session.id)}
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                    data-testid={`cancellation-policy-toggle-${session.id}`}
                  >
                    Cancellation &amp; refund policy
                    {showPolicy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
                {showPolicy && (
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-md" data-testid={`cancellation-policy-text-${session.id}`}>
                    {detail.cancellationPolicy}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
