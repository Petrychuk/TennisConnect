import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar, MapPin, ExternalLink, ChevronDown, ChevronUp, Info, Layers } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  getMySessions,
  getOrganizationByUserSlug,
  getMyRegisteredSessions,
  joinSession as joinSessionApi,
  leaveSession as leaveSessionApi,
} from "@/lib/api/organizer-sessions";
import type { TennisSession, SessionWithDetails } from "@shared/schema";

interface MyOrganizedSessionsSectionProps {
  isOwnProfile: boolean;
  profileSlug?: string;
}

const DEFAULT_CANCELLATION_POLICY =
  "Free cancellation up to 24 hours before the session starts. After that, no refund — the spot may still be offered to the waiting list.";

const OWNER_STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-secondary text-secondary-foreground",
  published: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
  live: "bg-primary text-primary-foreground",
  completed: "bg-accent text-accent-foreground",
};

const OWNER_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
  cancelled: "Cancelled",
  live: "Live",
  completed: "Completed",
};

type GuestBucket = "open" | "waitlist" | "closed";

const GUEST_STATUS_LABEL: Record<GuestBucket, string> = {
  open: "Registration Open",
  waitlist: "Waiting List",
  closed: "Registration Closed",
};

const GUEST_STATUS_BADGE: Record<GuestBucket, string> = {
  open: "bg-primary/10 text-primary",
  waitlist: "bg-secondary text-secondary-foreground",
  closed: "bg-muted text-muted-foreground",
};

// This endpoint (getOrganizationByUserSlug -> upcomingSessions) only
// ever returns published, upcoming sessions to begin with - so every
// row here is already "open" or "waitlist" or "closed", never
// draft/pending/live/completed. That's the right scope for a guest.
function guestBucketFor(session: SessionWithDetails): GuestBucket {
  const isFull = session.maxParticipants != null && session.registeredCount >= session.maxParticipants;
  if (isFull) return session.waitingListEnabled ? "waitlist" : "closed";
  return "open";
}

// "Organiser & Sessions" — as opposed to MySessionsSection, which is
// sessions this viewer has *joined* as a player. Read-only for
// managing (that happens in the Organiser Hub); this is the at-a-
// glance view on the profile, and for other visitors, the entry point
// into actually joining.
export function MyOrganizedSessionsSection({ isOwnProfile, profileSlug }: MyOrganizedSessionsSectionProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [policyOpenId, setPolicyOpenId] = useState<string | null>(null);
  const autoJoinAttempted = useRef(false);

  const mineQuery = useQuery({
    queryKey: ["/api/organizer/sessions/mine"],
    queryFn: getMySessions,
    enabled: isOwnProfile,
  });

  const orgQuery = useQuery({
    queryKey: ["/api/organizer/organizations/by-user", profileSlug],
    queryFn: () => getOrganizationByUserSlug(profileSlug!),
    enabled: !isOwnProfile && !!profileSlug,
  });

  // Needed to show "Joined"/"Waitlisted" and drive the Join/Leave
  // button on every session, own profile included - the organiser can
  // be a player in their own event too.
  const myRegisteredQuery = useQuery({
    queryKey: ["/api/organizer/sessions/mine/registered"],
    queryFn: getMyRegisteredSessions,
    enabled: isAuthenticated,
  });

  const isLoading = isOwnProfile ? mineQuery.isLoading : orgQuery.isLoading;
  const sessions: (TennisSession | SessionWithDetails)[] = isOwnProfile
    ? mineQuery.data ?? []
    : orgQuery.data?.upcomingSessions ?? [];

  // A Tournament/Club Championship "container" and its divisions
  // (Men's Singles A, Mixed Doubles, etc.) shouldn't render as flat,
  // unrelated cards - group each container with its own divisions
  // nested underneath. A division whose container isn't in this same
  // list (rare - e.g. the container itself isn't published yet but a
  // division somehow is) falls back to rendering standalone rather
  // than being silently dropped.
  const { topLevel, divisionsByParent } = useMemo(() => {
    const byParent = new Map<string, (TennisSession | SessionWithDetails)[]>();
    for (const s of sessions) {
      if (s.parentSessionId) {
        const arr = byParent.get(s.parentSessionId) ?? [];
        arr.push(s);
        byParent.set(s.parentSessionId, arr);
      }
    }
    const containerIds = new Set(sessions.filter((s) => !s.parentSessionId).map((s) => s.id));
    const top = sessions.filter((s) => {
      if (s.parentSessionId) return !containerIds.has(s.parentSessionId);
      // Guests only: a Tournament/Club Championship that's been split
      // into divisions, but none of them have actually been published
      // yet, has nothing joinable to show - hide it entirely rather
      // than displaying an empty container with no divisions listed.
      if (
        !isOwnProfile &&
        (s.type === "tournament" || s.type === "club-championship") &&
        "hasDivisions" in s &&
        s.hasDivisions &&
        !byParent.has(s.id)
      ) {
        return false;
      }
      return true;
    });
    return { topLevel: top, divisionsByParent: byParent };
  }, [sessions, isOwnProfile]);

  const [divisionInfoSession, setDivisionInfoSession] = useState<TennisSession | SessionWithDetails | null>(null);

  const myStatusById = useMemo(() => {
    const map = new Map<string, "registered" | "waitlisted">();
    (myRegisteredQuery.data ?? []).forEach((s) => {
      if (s.viewerRegistrationStatus === "registered" || s.viewerRegistrationStatus === "waitlisted") {
        map.set(s.id, s.viewerRegistrationStatus);
      }
    });
    return map;
  }, [myRegisteredQuery.data]);

  // The actual join call - shared by a direct click (already signed
  // in) and the auto-join effect below (just arrived back from
  // /auth). `announce` controls the toast wording, since "you're in!"
  // reads oddly right after a "welcome back" toast has already fired.
  const performJoin = async (session: TennisSession, announce: "immediate" | "after-auth") => {
    setJoiningId(session.id);
    try {
      const { waitlisted } = await joinSessionApi(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine/registered"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/organizations/by-user", profileSlug] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      toast({
        title: waitlisted ? "Added to the waiting list" : "You're in!",
        description:
          announce === "after-auth"
            ? waitlisted
              ? `You've been added to the waiting list for "${session.title}".`
              : `"${session.title}" has been added to your My Sessions.`
            : waitlisted
              ? `"${session.title}" is full — you'll move up automatically if a spot opens.`
              : `You've joined "${session.title}".`,
      });
    } catch (error: any) {
      toast({ title: "Couldn't join session", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setJoiningId(null);
    }
  };

  const handleJoin = async (session: TennisSession) => {
    if (!isAuthenticated) {
      // Send them to sign in (or register), but bring them right back
      // here afterwards instead of to their own profile, and remember
      // which session they were trying to join so it completes
      // automatically the moment they're back and authenticated.
      const returnTo = `${location}${search ? `?${search}` : ""}`;
      const params = new URLSearchParams({ returnTo, joinSession: session.id });
      setLocation(`/auth?${params.toString()}`);
      return;
    }
    performJoin(session, "immediate");
  };

  // Completes a join that was interrupted by a sign-in/registration
  // redirect. Runs once per mount; strips joinSession from the URL
  // right after so refreshing the page doesn't re-trigger it.
  useEffect(() => {
    if (autoJoinAttempted.current) return;
    if (!isAuthenticated) return;
    const params = new URLSearchParams(search);
    const pendingSessionId = params.get("joinSession");
    if (!pendingSessionId) return;
    if (isLoading || myRegisteredQuery.isLoading) return;

    autoJoinAttempted.current = true;
    params.delete("joinSession");
    params.delete("returnTo");
    const cleanQuery = params.toString();
    setLocation(`${location}${cleanQuery ? `?${cleanQuery}` : ""}`, { replace: true });

    const target = sessions.find((s) => s.id === pendingSessionId);
    if (target && !myStatusById.get(target.id)) {
      performJoin(target, "after-auth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, myRegisteredQuery.isLoading, sessions, search]);

  const handleLeave = async (session: TennisSession) => {
    setJoiningId(session.id);
    try {
      await leaveSessionApi(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine/registered"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/organizations/by-user", profileSlug] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      toast({ title: "Registration cancelled", description: `You're no longer registered for "${session.title}".` });
    } catch (error: any) {
      toast({ title: "Couldn't cancel", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setJoiningId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="my-organized-sessions-loading">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      </div>
    );
  }

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
        topLevel.map((session) => {
          const details = "registeredCount" in session ? session : null;
          const guestBucket = details ? guestBucketFor(details) : null;
          const myStatus = myStatusById.get(session.id) ?? null;
          const divisions = divisionsByParent.get(session.id) ?? [];
          const canJoin = divisions.length === 0 && (!isOwnProfile
            ? (guestBucket === "open" || guestBucket === "waitlist") && !myStatus
            : session.status === "published" && !myStatus); // capacity is re-checked server-side either way
          const showPolicy = policyOpenId === session.id;

          return (
            <Card key={session.id} data-testid={`my-organized-session-${session.id}`}>
              <CardHeader className="pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{session.title}</span>
                      {isOwnProfile ? (
                        <Badge className={OWNER_STATUS_BADGE[session.status]}>{OWNER_STATUS_LABEL[session.status] ?? session.status}</Badge>
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

                  <div className="flex items-center gap-2 shrink-0">
                    {session.description && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDivisionInfoSession(session)}
                        data-testid={`session-info-${session.id}`}
                      >
                        <Info className="w-4 h-4 mr-1.5" />
                        More info
                      </Button>
                    )}
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
                    {myStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLeave(session)}
                        disabled={joiningId === session.id}
                        data-testid={`leave-session-${session.id}`}
                      >
                        Leave
                      </Button>
                    )}
                  </div>
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
                    {DEFAULT_CANCELLATION_POLICY}
                  </p>
                )}

                {divisions.length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-2" data-testid={`session-divisions-${session.id}`}>
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Divisions
                    </p>
                    {divisions.map((division) => {
                      const divDetails = "registeredCount" in division ? division : null;
                      const divGuestBucket = divDetails ? guestBucketFor(divDetails) : null;
                      const divStatus = myStatusById.get(division.id) ?? null;
                      const divCanJoin = !isOwnProfile
                        ? (divGuestBucket === "open" || divGuestBucket === "waitlist") && !divStatus
                        : division.status === "published" && !divStatus;

                      return (
                        <div
                          key={division.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2"
                          data-testid={`session-division-${division.id}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">{division.title}</span>
                            {isOwnProfile ? (
                              <Badge className={OWNER_STATUS_BADGE[division.status]}>
                                {OWNER_STATUS_LABEL[division.status] ?? division.status}
                              </Badge>
                            ) : (
                              divGuestBucket && <Badge className={GUEST_STATUS_BADGE[divGuestBucket]}>{GUEST_STATUS_LABEL[divGuestBucket]}</Badge>
                            )}
                            {divStatus === "waitlisted" && <Badge variant="secondary">Waitlisted</Badge>}
                            {divStatus === "registered" && <Badge className="bg-primary/10 text-primary">Joined</Badge>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {division.description && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDivisionInfoSession(division)}
                                data-testid={`division-info-${division.id}`}
                              >
                                <Info className="w-4 h-4 mr-1.5" />
                                More info
                              </Button>
                            )}
                            {divCanJoin && (
                              <Button
                                size="sm"
                                onClick={() => handleJoin(division)}
                                disabled={joiningId === division.id}
                                data-testid={`join-session-${division.id}`}
                              >
                                {isAuthenticated ? "Join" : "Sign in to Join"}
                              </Button>
                            )}
                            {divStatus && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLeave(division)}
                                disabled={joiningId === division.id}
                                data-testid={`leave-session-${division.id}`}
                              >
                                Leave
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!divisionInfoSession} onOpenChange={(open) => !open && setDivisionInfoSession(null)}>
        <DialogContent data-testid="division-info-dialog">
          <DialogHeader>
            <DialogTitle>{divisionInfoSession?.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap text-left">
              {divisionInfoSession?.description || "No additional details for this division."}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
