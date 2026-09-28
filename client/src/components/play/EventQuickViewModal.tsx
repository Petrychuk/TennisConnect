import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Trophy, DollarSign, CheckCircle2, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatInTimeZone } from "@/lib/timezone";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { RECOMMENDATION_REASON_TEXT } from "@/lib/play-status";
import { ActivityStatus } from "./ActivityStatus";
import { getPlaySessionById, joinSession, leaveSession } from "@/lib/api/play";

function formatLabel(type: string): string {
  const known = SESSION_TYPE_OPTIONS.find((t) => t.key === type)?.label;
  if (known) return known;
  // Externally discovered types not in the option list ("cardio-tennis").
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// Same 4 formats the Play page's own "Competitions" quick filter
// groups - reused here to pick "Join Competition" vs "Join Session"
// wording (spec §10), rather than duplicating the list a second time.
const COMPETITION_TYPES = new Set(["tournament", "league", "club-championship", "junior-event"]);

interface EventQuickViewModalProps {
  sessionId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Set only when opened from a "Recommended for You" card - shows a
      small explanation banner (spec section 11), never a separate
      AI-recommendation modal. */
  recommendation?: { score: number; reasons: string[] } | null;
  /** Fires once the join/waitlist mutation actually succeeds - lets a
      caller (e.g. play.tsx) fire its own play_recommendation_join
      analytics event without this modal needing to know analytics
      exist at all. */
  onJoinSuccess?: (sessionId: string) => void;
}

// Spec §9: clicking a Play card opens this instead of navigating to a
// separate details page. Reuses the exact same join/leave mutations
// and action-button state machine already built for
// play-session-details.tsx (that page itself is untouched - kept
// around for any direct/shared link to a specific session, just no
// longer how the normal Play discovery flow gets here).
export function EventQuickViewModal({ sessionId, onOpenChange, recommendation, onJoinSuccess }: EventQuickViewModalProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["/api/play/sessions", sessionId],
    queryFn: () => getPlaySessionById(sessionId!),
    enabled: !!sessionId,
    retry: false,
  });
  const session = sessionQuery.data;

  const joinMutation = useMutation({
    mutationFn: () => joinSession(sessionId!),
    onSuccess: ({ waitlisted }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions"] });
      toast({ title: waitlisted ? "You're on the waiting list" : "You're registered!" });
      if (sessionId) onJoinSuccess?.(sessionId);
    },
    onError: (error: any) => {
      toast({ title: "Couldn't register", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveSession(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions"] });
      toast({ title: "Registration cancelled" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't cancel", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  let actionButton: ReactNode = null;
  const isCompetition = session ? COMPETITION_TYPES.has(session.type) : false;
  const joinLabel = isCompetition ? "Join Competition" : "Join Session";

  if (session) {
    if (session.sourceType === "EXTERNAL") {
      // [PLAY][AI] TC Discovery Agent, section 19 - external activities
      // never show Join/Register (no TennisConnect registration
      // integration exists for them), regardless of sign-in state -
      // this is a link out, not an action TennisConnect can fulfil.
      actionButton = (
        <Button className="w-full" asChild data-testid="event-modal-view-original">
          <a href={session.externalSourceUrl ?? "#"} target="_blank" rel="noopener noreferrer">
            View original <ExternalLink className="w-4 h-4 ml-1.5" />
          </a>
        </Button>
      );
    } else if (!isAuthenticated) {
      actionButton = (
        <Button className="w-full" onClick={() => setLocation("/auth")} data-testid="event-modal-signin">
          Sign in to Register
        </Button>
      );
    } else if (session.myRegistrationStatus === "registered") {
      actionButton = (
        <div className="flex flex-col gap-2 w-full">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 justify-center py-2" data-testid="event-modal-registered-badge">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Registered
          </Badge>
          <Button variant="outline" className="w-full" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="event-modal-cancel">
            {leaveMutation.isPending ? "Cancelling..." : "Cancel Registration"}
          </Button>
        </div>
      );
    } else if (session.myRegistrationStatus === "waitlisted") {
      actionButton = (
        <div className="flex flex-col gap-2 w-full">
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 justify-center py-2">
            On Waiting List
          </Badge>
          <Button variant="outline" className="w-full" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="event-modal-leave-waitlist">
            {leaveMutation.isPending ? "Leaving..." : "Leave Waiting List"}
          </Button>
        </div>
      );
    } else if (session.playStatus === "closed") {
      actionButton = <Button className="w-full" disabled data-testid="event-modal-closed">Registration Closed</Button>;
    } else if (session.playStatus === "full") {
      actionButton = <Button className="w-full" disabled data-testid="event-modal-full">Full</Button>;
    } else if (session.playStatus === "waitlist") {
      actionButton = (
        <Button className="w-full" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="event-modal-join-waitlist">
          {joinMutation.isPending ? "Joining..." : "Join Waiting List"}
        </Button>
      );
    } else {
      actionButton = (
        <Button className="w-full" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="event-modal-join">
          {joinMutation.isPending ? "Joining..." : joinLabel}
        </Button>
      );
    }
  }

  return (
    <Dialog open={!!sessionId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="event-quick-view-modal">
        {sessionQuery.isLoading ? (
          <div className="space-y-3">
            <DialogTitle className="sr-only">Loading session…</DialogTitle>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !session ? (
          <>
            <DialogHeader>
              <DialogTitle>This session isn't available</DialogTitle>
              <DialogDescription>It may have been cancelled, or it's no longer open for discovery.</DialogDescription>
            </DialogHeader>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle data-testid="event-modal-title">{session.title}</DialogTitle>
              <DialogDescription>
                {session.sourceType === "EXTERNAL" ? (
                  <span className="text-primary font-medium">Found by TennisConnect</span>
                ) : (
                  session.organizationName
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {recommendation && recommendation.score > 0 && (
                <div className="bg-primary/5 rounded-lg px-3 py-2 text-sm" data-testid="event-modal-recommendation-banner">
                  <span className="font-semibold text-primary">✨ Great match for you</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {recommendation.reasons.map((r) => RECOMMENDATION_REASON_TEXT[r] ?? r).join(" · ")}
                  </span>
                </div>
              )}
              <ActivityStatus status={session.playStatus} data-testid="event-modal-status" />

              {(session.seasonName || session.seriesName) && (
                <p className="text-xs text-muted-foreground" data-testid="event-modal-season-series">
                  Part of {[session.seasonName, session.seriesName].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p className="flex items-center gap-2" data-testid="event-modal-datetime">
                  📅 {formatInTimeZone(session.startAt, session.timeZone, { weekday: "short", day: "numeric", month: "short" })}
                  {" · "}
                  {formatInTimeZone(session.startAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}
                  {session.endAt && ` – ${formatInTimeZone(session.endAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}`}
                </p>
                {session.location && (
                  <p className="flex items-center gap-2 min-w-0" data-testid="event-modal-location">
                    <MapPin className="w-4 h-4 shrink-0" /> <span className="truncate">{session.location}</span>
                  </p>
                )}
                {session.type && (
                  <p className="flex items-center gap-2" data-testid="event-modal-format">
                    🎾 {formatLabel(session.type)}
                  </p>
                )}
                <p className="flex items-center gap-2" data-testid="event-modal-level">
                  🎯 {session.skillLevel ?? (session.sourceType === "EXTERNAL" ? "Level not stated" : "All Levels")}
                </p>
                <p className="flex items-center gap-2" data-testid="event-modal-players">
                  <Users className="w-4 h-4 shrink-0" />
                  {session.maxParticipants != null
                    ? `${session.registeredCount} / ${session.maxParticipants} players`
                    : `${session.registeredCount} players`}
                </p>
                {session.price && (
                  <p className="flex items-center gap-2" data-testid="event-modal-price">
                    <DollarSign className="w-4 h-4 shrink-0" /> {session.price}
                  </p>
                )}
              </div>

              {session.description && (
                <div data-testid="event-modal-description">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">About</p>
                  <p className="text-sm text-muted-foreground">{session.description}</p>
                </div>
              )}

              {session.sourceType === "EXTERNAL" ? (
                <div className="pt-2 border-t border-border/60 space-y-0.5" data-testid="event-modal-source-info">
                  <p className="text-sm">
                    Source: <span className="font-medium">{session.organizationName}</span>
                  </p>
                  {session.externalLastCheckedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last checked: {formatInTimeZone(session.externalLastCheckedAt, session.timeZone, { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2 border-t border-border/60" data-testid="event-modal-organiser">
                  <Avatar className="h-7 w-7 shrink-0">
                    {session.organizationLogo && <AvatarImage src={session.organizationLogo} alt="" />}
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials(session.organizationName)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    Organised by <span className="text-foreground font-medium">{session.organizationName}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2">{actionButton}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
