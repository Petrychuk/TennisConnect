import { useState, type ReactNode } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  MapPin,
  Users,
} from "lucide-react";
import courtImage from "/assets/images/cinematic_tennis_court_abstract_background.webp";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from "@/lib/timezone";
import { SESSION_TYPE_OPTIONS, sessionFormatLabel } from "@/lib/organiser-session-wizard-types";
import { PLAY_STATUS_LABEL, PLAY_STATUS_STYLE } from "@/lib/play-status";
import { getPlaySessionById, joinSession, leaveSession } from "@/lib/api/play";
import { FormattedPolicyText, SessionPoliciesList } from "@/components/play/session-policies";
import { SessionVenueCard } from "@/components/play/session-venue-card";
import { ShareSessionButton } from "@/components/play/share-session-button";
import { PoliciesAgreement } from "@/components/play/policies-agreement";
import { sessionCategoryOf } from "@shared/sessionCategories";
import { hasAnyPolicy, type SessionPolicies } from "@shared/sessionPolicies";

/*
  The public page of a session - the one place a player sees and joins it
  (Play's cards, the organiser's public page and shared links all lead here).

  Top to bottom: the session's own banner (or the standard court photo) with
  its name and a short description; the booking card (price, places, ONE main
  action for the real state); date, time, venue, format, level and length at
  a glance; the details; rules & policies as collapsible sections (only the
  ones the organiser filled in); who organises it; where it is, on a map.
  On a phone the booking card comes straight after the banner.
*/

function formatTypeLabel(type: string): string {
  return SESSION_TYPE_OPTIONS.find((t) => t.key === type)?.label ?? type;
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** The wizard's "Format: ..." summary line is shown as the Format fact - not repeated as text. */
function storyParagraphs(description: string | null): string[] {
  const lines = (description ?? "").replace(/\r\n?/g, "\n").split("\n");
  if (lines[0]?.trim().startsWith("Format:")) lines.shift();
  return lines.join("\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function durationLabel(startAt: string, endAt: string | null): string | null {
  if (!endAt) return null;
  const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
  if (!(minutes > 0)) return null;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${minutes} min`;
}

export default function PlaySessionDetailsPage() {
  const [, params] = useRoute("/play/:id");
  const sessionId = params?.id;
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["/api/play/sessions", sessionId],
    queryFn: () => getPlaySessionById(sessionId!),
    enabled: !!sessionId,
    retry: false,
  });
  const session = sessionQuery.data;

  const joinMutation = useMutation({
    mutationFn: () => joinSession(sessionId!, agreed),
    onSuccess: ({ waitlisted }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions"] });
      toast({ title: waitlisted ? "You're on the waiting list" : "You're registered!" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't register", description: error?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveSession(sessionId!),
    onSuccess: () => {
      setAgreed(false);
      queryClient.invalidateQueries({ queryKey: ["/api/play/sessions"] });
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
        <div className="container mx-auto px-4 pt-24 pb-8 max-w-6xl space-y-4">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="min-h-screen bg-background" data-testid="play-session-details-not-found">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 pb-16 text-center max-w-lg">
          <p className="font-semibold text-lg">This session isn't available</p>
          <p className="text-sm text-muted-foreground mt-1">It may have been cancelled, or it's no longer open for discovery.</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/play")} data-testid="play-session-details-back-to-play">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Play
          </Button>
        </div>
      </div>
    );
  }

  const pagePath = `/play/${session.id}`;
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}${pagePath}` : pagePath;
  const category = sessionCategoryOf(session.type);
  const paragraphs = storyParagraphs(session.description);
  // A short first paragraph is the banner's blurb; the rest is Session Details.
  const blurb = paragraphs[0] && paragraphs[0].length <= 280 ? paragraphs[0].replace(/\*\*/g, "") : null;
  const details = blurb ? paragraphs.slice(1) : paragraphs;
  const policies = session.policies as SessionPolicies | undefined;
  const hasPolicies = !!policies && hasAnyPolicy(policies);
  const formatFact = category.usesMatchFormat
    ? sessionFormatLabel({ matchMode: session.matchMode, category: session.category, description: session.description })
    : null;
  const roundsSub = session.plannedRoundsCount ? `${session.plannedRoundsCount} rounds` : null;
  const duration = durationLabel(session.startAt, session.endAt);
  const priceValue = session.price ? Number(session.price) : 0;
  const priceLabel = priceValue > 0 ? `${session.currency} ${priceValue.toFixed(2)}` : "Free";
  const spotsLeft = session.maxParticipants != null ? session.maxParticipants - session.registeredCount : null;
  const authHref = (tab?: "register") => `/auth?${tab ? "tab=register&" : ""}returnTo=${encodeURIComponent(pagePath)}`;

  // ---------- The one main action, for the real state ----------
  const needsAgreement = hasPolicies && isAuthenticated;
  const joinDisabled = joinMutation.isPending || (needsAgreement && !agreed);
  let note: ReactNode = null;
  let action: ReactNode;
  // From its start time a session is archived for players and guests: shown
  // on a direct link, but nobody can join, leave or cancel any more (the API
  // refuses too - shared/sessionLifecycle.ts). The organiser still runs it.
  const archived = session.playStatus === "archived";
  // Registration window closed before the start: places can't be cancelled either.
  const registrationClosed = session.playStatus === "closed";
  if (archived) {
    note = <p className="text-sm text-muted-foreground" data-testid="play-session-details-archived-note">This session has started, so it's archived - registration is closed.</p>;
    action =
      session.myRegistrationStatus === "registered" || session.myRegistrationStatus === "waitlisted" ? (
        <div className="flex flex-row items-stretch gap-2">
          <Badge className="flex-1 bg-muted text-muted-foreground justify-center py-2" data-testid="play-session-details-registered-badge">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> {session.myRegistrationStatus === "registered" ? "You played" : "Was on the waiting list"}
          </Badge>
          <Button variant="outline" className="flex-1" disabled data-testid="play-session-details-cancel-registration">
            Cancel
          </Button>
        </div>
      ) : (
        <Button className="w-full" disabled data-testid="play-session-details-archived">
          Session finished
        </Button>
      );
  } else if (session.externalSourceUrl) {
    action = (
      <Button className="w-full" asChild data-testid="play-session-details-view-original">
        <a href={session.externalSourceUrl} target="_blank" rel="noopener noreferrer">Register on the organiser's site</a>
      </Button>
    );
  } else if (!isAuthenticated) {
    // Joining needs an account: sign in, or create one - both come back here.
    note = <p className="text-sm text-muted-foreground">Sign in or create a free account to join this session.</p>;
    action = (
      <div className="grid gap-2">
        <Button className="w-full" onClick={() => setLocation(authHref())} data-testid="play-session-details-signin-to-register">
          Sign in to join
        </Button>
        <Button variant="outline" className="w-full" onClick={() => setLocation(authHref("register"))} data-testid="play-session-details-create-account">
          Create an account
        </Button>
      </div>
    );
  } else if (session.myRegistrationStatus === "registered") {
    action = (
      <div className="flex flex-row items-stretch gap-2">
        <Badge className="flex-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 justify-center py-2" data-testid="play-session-details-registered-badge">
          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Registered
        </Badge>
        <Button variant="outline" className="flex-1" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending || registrationClosed} data-testid="play-session-details-cancel-registration">
          {leaveMutation.isPending ? "Cancelling..." : "Cancel"}
        </Button>
      </div>
    );
  } else if (session.myRegistrationStatus === "waitlisted") {
    note = <p className="text-sm text-muted-foreground">You'll get a place automatically if one opens up.</p>;
    action = (
      <div className="flex flex-row items-stretch gap-2">
        <Badge className="flex-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 justify-center py-2">On Waiting List</Badge>
        <Button variant="outline" className="flex-1" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending || registrationClosed} data-testid="play-session-details-leave-waitlist">
          {leaveMutation.isPending ? "Leaving..." : "Leave"}
        </Button>
      </div>
    );
  } else if (session.playStatus === "live") {
    action = <Button className="w-full" disabled data-testid="play-session-details-live">Session in progress</Button>;
  } else if (session.playStatus === "upcoming") {
    action = (
      <Button className="w-full" disabled data-testid="play-session-details-not-open">
        {session.registrationOpensAt
          ? `Registration opens ${formatInTimeZone(session.registrationOpensAt, session.timeZone, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
          : "Registration not open yet"}
      </Button>
    );
  } else if (session.playStatus === "closed") {
    action = <Button className="w-full" disabled data-testid="play-session-details-closed">Registration Closed</Button>;
  } else if (session.playStatus === "full") {
    note = <p className="text-sm text-muted-foreground">All places are taken and there's no waiting list.</p>;
    action = <Button className="w-full" disabled data-testid="play-session-details-full">Registration Closed</Button>;
  } else if (session.playStatus === "waitlist") {
    note = (
      <p className="text-sm text-muted-foreground" data-testid="play-session-details-waitlist-note">
        All places are taken. You can still join the waiting list - you'll move up automatically if a place opens.
      </p>
    );
    action = (
      <Button className="w-full" onClick={() => joinMutation.mutate()} disabled={joinDisabled} data-testid="play-session-details-join-waitlist">
        <Clock className="w-4 h-4 mr-1.5" aria-hidden />
        {joinMutation.isPending ? "Joining..." : "Join Waiting List"}
      </Button>
    );
  } else {
    action = (
      <Button className="w-full" onClick={() => joinMutation.mutate()} disabled={joinDisabled} data-testid="play-session-details-register">
        {joinMutation.isPending ? "Joining..." : "Join Session"}
      </Button>
    );
  }
  const offersJoin = !session.externalSourceUrl && isAuthenticated && !session.myRegistrationStatus && (session.playStatus === "waitlist" || session.playStatus === "open" || session.playStatus === "almost_full");

  const city = session.timeZone.split("/").pop()?.replace(/_/g, " ");
  const facts: { icon: typeof CalendarDays; value: ReactNode; sub?: ReactNode; testId?: string }[] = [
    {
      icon: CalendarDays,
      value: formatInTimeZone(session.startAt, session.timeZone, { weekday: "short", day: "numeric", month: "short" }),
      sub: (
        <>
          {formatInTimeZone(session.startAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}
          {session.endAt && <> – {formatInTimeZone(session.endAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}</>}
        </>
      ),
      testId: "play-session-details-when",
    },
    ...(session.location ? [{ icon: MapPin, value: session.location, sub: city, testId: "play-session-details-where" }] : []),
    ...(formatFact ? [{ icon: Layers, value: formatFact, sub: roundsSub, testId: "play-session-details-match-format" }] : []),
    { icon: BarChart3, value: session.skillLevel ?? "All levels", testId: "play-session-details-level" },
    ...(duration ? [{ icon: Clock, value: duration, sub: session.courtsCount != null ? `${session.courtsCount} courts` : undefined }] : []),
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="play-session-details-page">
      <SEO
        title={`${session.title} | TennisConnect`}
        description={(blurb ?? paragraphs[0] ?? `Join ${session.title}, organised by ${session.organizationName}.`).slice(0, 200)}
        image={session.coverImage && /^https:\/\//.test(session.coverImage) ? session.coverImage : undefined}
        canonical={pagePath}
      />
      <Navbar />

      <main id="main-content" className="pb-24 lg:pb-14">
        {/* ---------- Banner: full width, the session's own image (or the standard court photo) ---------- */}
        <section className="relative isolate overflow-hidden bg-foreground pt-20" data-testid="play-session-details-hero">
          <img src={session.coverImage || courtImage} alt="" aria-hidden className={cn("absolute inset-0 -z-10 h-full w-full object-cover", archived && "grayscale")} />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/45 to-black/70 lg:bg-gradient-to-r lg:from-black/75 lg:via-black/40 lg:to-black/10" aria-hidden />

          <div className="container mx-auto max-w-6xl px-4 pt-4 pb-20 sm:pb-24">
            <div className="flex items-center justify-between gap-3">
              <Link href="/play" className="inline-flex min-h-11 sm:min-h-0 items-center gap-1.5 text-sm text-white/80 hover:text-white" data-testid="play-session-details-back-link">
                <ArrowLeft className="w-4 h-4" /> Back to Play
              </Link>
              {!archived && <ShareSessionButton url={pageUrl} title={session.title} />}
            </div>

            <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10">
              <div className="min-w-0 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white text-foreground hover:bg-white" data-testid="play-session-details-format">{formatTypeLabel(session.type)}</Badge>
                  {/* Category (shared/sessionCategories.ts) and the player-facing status. */}
                  <Badge variant="outline" className="border-white/40 bg-white/10 text-white" data-testid="play-session-details-category">{category.label}</Badge>
                  <Badge className={cn("font-semibold", PLAY_STATUS_STYLE[session.playStatus])} data-testid="play-session-details-status">
                    {PLAY_STATUS_LABEL[session.playStatus]}
                  </Badge>
                </div>
                <h1 className="mt-3 text-3xl sm:text-5xl font-display font-bold leading-tight break-words" data-testid="play-session-details-title">{session.title}</h1>
                {(session.seasonName || session.seriesName) && (
                  <p className="mt-1 text-xs text-white/75" data-testid="play-session-details-season-context">
                    Part of {[session.seasonName, session.seriesName].filter(Boolean).join(" · ")}
                  </p>
                )}
                {blurb && <p className="mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-white/90 line-clamp-4" data-testid="play-session-details-blurb">{blurb}</p>}
              </div>

              {/* ---------- Booking card: on the banner, right after the title on a phone ---------- */}
              <aside className="rounded-2xl bg-card text-card-foreground p-5 shadow-xl space-y-3" data-testid="play-session-details-booking">
                <p className="text-2xl font-display font-bold" data-testid="play-session-details-price">{priceLabel}</p>
                <p className="flex items-center gap-2 text-sm" data-testid="play-session-details-spots">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                  {session.maxParticipants != null ? (
                    <span>
                      {session.registeredCount} / {session.maxParticipants} players
                      {spotsLeft != null && spotsLeft > 0 ? (
                        !archived && <span className="text-green-600 dark:text-green-400 font-medium"> · {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left</span>
                      ) : (
                        <span className="font-medium"> · {archived ? "Archived" : "Registration Closed"}</span>
                      )}
                    </span>
                  ) : (
                    <span>{session.registeredCount} players</span>
                  )}
                </p>
                {note}
                {offersJoin && hasPolicies && !archived && (
                  <PoliciesAgreement checked={agreed} onCheckedChange={setAgreed} testId="play-session-details-agree" />
                )}
                {action}
                {priceValue > 0 && !archived && <p className="text-xs text-muted-foreground">Paid to the organiser directly.</p>}
              </aside>
            </div>
          </div>
        </section>

        <div className="container mx-auto max-w-6xl px-4">
          {/* ---------- Key facts: one light strip over the banner's edge ---------- */}
          <section
            className="relative z-10 -mt-12 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:flex lg:divide-x lg:divide-border lg:gap-0"
            data-testid="play-session-details-facts"
          >
            {facts.map((fact, i) => (
              <div key={i} className={cn("flex min-w-0 items-center gap-3 lg:flex-1 lg:px-5 lg:first:pl-1 lg:last:pr-1", i === 0 && "col-span-2 sm:col-span-1")} data-testid={fact.testId}>
                <fact.icon className="h-5 w-5 shrink-0 text-primary-text" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate">{fact.value}</p>
                  {fact.sub && <p className="text-sm text-muted-foreground leading-tight mt-0.5 truncate">{fact.sub}</p>}
                </div>
              </div>
            ))}
          </section>

          <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
            {/* ---------- Left: details and who organises it ---------- */}
            <div className="space-y-5 min-w-0">
              {details.length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-5" data-testid="play-session-details-about">
                  <h2 className="flex items-center gap-2.5 text-lg font-semibold mb-3">
                    <FileText className="w-5 h-5 text-primary-text" aria-hidden /> Session Details
                  </h2>
                  <FormattedPolicyText text={details.join("\n\n")} />
                </section>
              )}

              <section className="rounded-2xl border border-border bg-card p-4" data-testid="play-session-details-organiser">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-11 w-11 shrink-0">
                      {session.organizationLogo && <AvatarImage src={session.organizationLogo} alt="" />}
                      <AvatarFallback className="bg-primary/10 text-primary-text font-bold">{initials(session.organizationName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Organised by</p>
                      {/* The organiser's public page (/organisations/:slug). External
                          events have no TennisConnect organisation, so no slug. */}
                      {session.organizationSlug ? (
                        <Link href={`/organisations/${session.organizationSlug}`} className="font-semibold truncate block hover:underline" data-testid="play-session-details-organizer-page">
                          {session.organizationName}
                        </Link>
                      ) : (
                        <span className="font-semibold truncate block">{session.organizationName}</span>
                      )}
                    </div>
                  </div>
                  {session.organizationSlug ? (
                    <Button variant="ghost" size="icon" asChild aria-label={`${session.organizationName} - all sessions`} data-testid="play-session-details-view-organizer">
                      <Link href={`/organisations/${session.organizationSlug}`}>
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild data-testid="play-session-details-view-organizer">
                      <Link href={`/play?organizer=${session.organizationId}`}>Their sessions</Link>
                    </Button>
                  )}
                </div>
              </section>
            </div>

            {/* ---------- Right: rules & policies (collapsed), then where it is ---------- */}
            <div className="space-y-5 min-w-0">
              {hasPolicies && (
                <section id="session-policies" className="scroll-mt-24" data-testid="play-session-details-policies-section">
                  <h2 className="sr-only">Rules &amp; policies</h2>
                  <SessionPoliciesList policies={policies} variant="accordion" testId="play-session-details-policies" />
                </section>
              )}
              {session.location && <SessionVenueCard sessionId={session.id} venue={session.location} timeZone={session.timeZone} />}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
