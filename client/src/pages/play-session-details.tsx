import { useRoute, useLocation, Link } from "wouter";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Users, CalendarDays, Clock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from "@/lib/timezone";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { PLAY_STATUS_LABEL, PLAY_STATUS_STYLE } from "@/lib/play-status";
import { getPlaySessionById, joinSession, leaveSession } from "@/lib/api/play";

function formatLabel(type: string): string {
  return SESSION_TYPE_OPTIONS.find((t) => t.key === type)?.label ?? type;
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function PlaySessionDetailsPage() {
  const [, params] = useRoute("/play/:id");
  const sessionId = params?.id;
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
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
      toast({ title: waitlisted ? "You're on the waiting list" : "You're registered!" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't register", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveSession(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions", sessionId] });
      toast({ title: "Registration cancelled" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't cancel", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="play-session-details-loading">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="min-h-screen bg-background" data-testid="play-session-details-not-found">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center max-w-lg">
          <p className="font-semibold text-lg">This session isn't available</p>
          <p className="text-sm text-muted-foreground mt-1">
            It may have been cancelled, or it's no longer open for discovery.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/play")} data-testid="play-session-details-back-to-play">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Play
          </Button>
        </div>
      </div>
    );
  }

  const spotsLeft = session.maxParticipants != null ? session.maxParticipants - session.registeredCount : null;

  let actionButton: ReactNode;
  if (!isAuthenticated) {
    actionButton = (
      <Button className="w-full sm:w-auto" onClick={() => setLocation("/auth")} data-testid="play-session-details-signin-to-register">
        Sign in to Register
      </Button>
    );
  } else if (session.myRegistrationStatus === "registered") {
    actionButton = (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <Badge className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 justify-center py-2 px-4" data-testid="play-session-details-registered-badge">
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Registered
        </Badge>
        <Button variant="outline" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="play-session-details-cancel-registration">
          {leaveMutation.isPending ? "Cancelling..." : "Cancel Registration"}
        </Button>
      </div>
    );
  } else if (session.myRegistrationStatus === "waitlisted") {
    actionButton = (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 justify-center py-2 px-4">
          On Waiting List
        </Badge>
        <Button variant="outline" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="play-session-details-leave-waitlist">
          {leaveMutation.isPending ? "Leaving..." : "Leave Waiting List"}
        </Button>
      </div>
    );
  } else if (session.playStatus === "closed") {
    actionButton = <Button className="w-full sm:w-auto" disabled data-testid="play-session-details-closed">Registration Closed</Button>;
  } else if (session.playStatus === "full") {
    actionButton = <Button className="w-full sm:w-auto" disabled data-testid="play-session-details-full">Full</Button>;
  } else if (session.playStatus === "waitlist") {
    actionButton = (
      <Button className="w-full sm:w-auto" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="play-session-details-join-waitlist">
        {joinMutation.isPending ? "Joining..." : "Join Waiting List"}
      </Button>
    );
  } else {
    actionButton = (
      <Button className="w-full sm:w-auto" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="play-session-details-register">
        {joinMutation.isPending ? "Registering..." : "Register"}
      </Button>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="play-session-details-page">
      <SEO title={`${session.title} | TennisConnect`} description={session.description ?? `Join ${session.title}, organised by ${session.organizationName}.`} />
      <Navbar />

      <main id="main-content" className="container mx-auto px-4 py-6 max-w-3xl">
        <Link href="/play" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="play-session-details-back-link">
          <ArrowLeft className="w-4 h-4" /> Back to Play
        </Link>

        <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden bg-muted mb-5">
          {session.coverImage ? (
            <img src={session.coverImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
              <span className="text-5xl">🎾</span>
            </div>
          )}
          <Badge className={cn("absolute top-3 left-3 font-semibold", PLAY_STATUS_STYLE[session.playStatus])} data-testid="play-session-details-status">
            {PLAY_STATUS_LABEL[session.playStatus]}
          </Badge>
        </div>

        <h1 className="text-2xl sm:text-3xl font-display font-bold" data-testid="play-session-details-title">{session.title}</h1>

        {(session.seasonName || session.seriesName) && (
          <p className="text-xs text-muted-foreground mt-1" data-testid="play-session-details-season-context">
            Part of {[session.seasonName, session.seriesName].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="secondary">{formatLabel(session.type)}</Badge>
          <Badge variant="outline">{session.skillLevel ?? "All Levels"}</Badge>
          {session.courtsCount != null && <Badge variant="outline">{session.courtsCount} courts</Badge>}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <div className="flex items-center gap-2.5 text-sm">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            {formatInTimeZone(session.startAt, session.timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            {formatInTimeZone(session.startAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}
            {session.endAt && <> – {formatInTimeZone(session.endAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}</>}
          </div>
          {session.location && (
            <div className="flex items-center gap-2.5 text-sm sm:col-span-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              {session.location}
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            {session.maxParticipants != null ? (
              <span>
                {session.registeredCount} / {session.maxParticipants} players
                {spotsLeft != null && spotsLeft > 0 && <span className="text-green-600 dark:text-green-400 font-medium"> · {spotsLeft} spots remaining</span>}
              </span>
            ) : (
              <span>{session.registeredCount} players</span>
            )}
          </div>
        </div>

        {session.description && (
          <div className="mt-6">
            <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">About</h2>
            <p className="text-sm text-foreground/90 whitespace-pre-line">{session.description}</p>
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Organised by</h2>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10 shrink-0">
                  {session.organizationLogo && <AvatarImage src={session.organizationLogo} alt="" />}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(session.organizationName)}</AvatarFallback>
                </Avatar>
                <span className="font-medium truncate">{session.organizationName}</span>
              </div>
              <Button variant="outline" size="sm" asChild data-testid="play-session-details-view-organizer">
                <Link href={`/play?organizer=${session.organizationId}`}>Their sessions</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 sticky bottom-4">
          <Card className="shadow-lg">
            <CardContent className="p-4 flex items-center justify-center">{actionButton}</CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
