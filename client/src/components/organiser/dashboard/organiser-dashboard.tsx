import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/seo";
import { useAuth } from "@/lib/auth-context";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { DashboardHeader } from "./dashboard-header";
import { LiveTodayCard } from "./live-today-card";
import { UpcomingSessionsCard } from "./upcoming-sessions-card";
import { QuickActionsCard } from "./quick-actions-card";
import { RecentActivityCard } from "./recent-activity-card";
import { StatisticsCard } from "./statistics-card";
import { CardSkeleton, CardUnavailable, DashboardWarning, WelcomeEmptyState } from "./dashboard-states";
import {
  failedSources,
  failureMessage,
  isNewOrganiser,
  sourceStatus,
} from "@/lib/organiserDashboard";

import {
  getMySessions,
  getOrganizationByUserSlug,
  getSessionRegistrations,
  getDashboardActivity,
} from "@/lib/api/organizer-sessions";
import type { TennisSession, SessionWithDetails } from "@shared/schema";

import type { MockSession, QuickStat } from "@/lib/organiser-hub-mock-data";
import bgImage from "/assets/images/subtle_abstract_tennis-themed_background_with_lime_green_accents.webp";
import { OrganiserAccessGate, useOrganiserIdentity } from "@/components/organiser/ui/organiser-layout";
import { liveAvailableFor, useLiveMode } from "@/lib/use-live-available";

// Every number on the dashboard is real (Phase 2): /sessions/mine,
// /dashboard/stats and /dashboard/activity (server/storage.ts
// getOrganizerDashboardStats / getRecentActivityForOrganization). While
// a request is loading its tile shows a skeleton, and after an error it
// says so - it never falls back to invented figures (the old
// mockStatStrip showed "1 / 3 / 87 / 91%").
function toMockSession(session: TennisSession | SessionWithDetails, checkedInCount = 0): MockSession {
  const details = "registeredCount" in session ? session : null;
  return {
    id: session.id,
    title: session.title,
    type: (["social", "round-robin", "clinic", "tournament"].includes(session.type ?? "")
      ? session.type
      : "social") as MockSession["type"],
    status: session.status as MockSession["status"],
    location: session.location ?? "",
    timeZone: session.timeZone ?? "Australia/Sydney",
    coverImage: session.coverImage ?? null,
    startAt: new Date(session.startAt).toISOString(),
    registeredCount: details?.registeredCount ?? 0,
    checkedInCount,
    waitingCount: details?.waitlistedCount ?? 0,
    maxParticipants: session.maxParticipants ?? null,
  };
}

function DashboardSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-6" data-testid="organiser-dashboard-skeleton">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Skeleton className="h-56 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}

export function OrganiserDashboard() {
  return (
    <OrganiserAccessGate>
      <OrganiserDashboardContent />
    </OrganiserAccessGate>
  );
}

function OrganiserDashboardContent() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const { organiser, profileHref } = useOrganiserIdentity();
  // Per session (TC_LIVE_ENABLED=internal only covers internal test sessions).
  const liveMode = useLiveMode();

  const mySessionsQuery = useQuery({
    queryKey: ["/api/organizer/sessions/mine"],
    queryFn: getMySessions,
    enabled: isAuthenticated,
  });
  const orgQuery = useQuery({
    queryKey: ["/api/organizer/organizations/by-user", user?.slug],
    queryFn: () => getOrganizationByUserSlug(user!.slug!),
    enabled: isAuthenticated && !!user?.slug,
  });
  const dashboardActivityQuery = useQuery({
    queryKey: ["/api/organizer/dashboard/activity"],
    queryFn: () => getDashboardActivity(8),
    enabled: isAuthenticated,
  });

  const realLiveSession = useMemo(
    () => mySessionsQuery.data?.find((s) => s.status === "live"),
    [mySessionsQuery.data]
  );

  // Only fetched when there's actually a live session to show real
  // check-in numbers for - registeredCount/waitlistedCount come from
  // the enriched org query instead, this is just for checkedInCount,
  // which needs the individual registrations.
  const liveRegistrationsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", realLiveSession?.id, "registrations"],
    queryFn: () => getSessionRegistrations(realLiveSession!.id),
    enabled: !!realLiveSession,
  });

  // No mock fallback anymore - "nothing live right now" is a real,
  // handled empty state (see LiveTodayCard), not a fake session.
  const liveSession: MockSession | null = realLiveSession
    ? toMockSession(
        realLiveSession,
        (liveRegistrationsQuery.data ?? []).filter((r) => r.checkedInAt).length
      )
    : null;

  // Real only, capped at 3 - sits in the compact column next to the
  // TC Live banner. A
  // full "everything upcoming" list already exists at /organiser/sessions
  // (the "View all" link). Backend already excludes anything not
  // "published" (draft/archived/completed/live never show up here -
  // see getUpcomingPublishedSessionsByOrganization).
  // From /sessions/mine (every session this organiser created), not the
  // organisation's public list: an organiser whose organisation doesn't
  // exist yet (it is created with their first session) still sees them.
  const upcomingSessions: MockSession[] = useMemo(() => {
    const now = Date.now();
    return (mySessionsQuery.data ?? [])
      .filter((s) => s.status === "published" && new Date(s.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 3)
      .map((s) => toMockSession(s));
  }, [mySessionsQuery.data]);

  // Real, computed directly from mySessionsQuery (which already carries
  // registeredCount/maxParticipants per session) rather than a mock -
  // deliberately no week-over-week delta (see QuickStat's own comment):
  // that needs two periods of history, and a plain honest number beats
  // a fabricated trend arrow. Only sessions that actually happened
  // (live/completed/archived) count - draft/pending_review haven't
  // happened, and a cancelled/rejected session was never a real outcome.
  const quickAnalytics: QuickStat[] = useMemo(() => {
    if (!mySessionsQuery.data) return [];
    const now = Date.now();
    const in7Days = now - 7 * 24 * 60 * 60 * 1000;
    const recent = mySessionsQuery.data.filter((s) => {
      const start = new Date(s.startAt).getTime();
      return ["live", "completed", "archived"].includes(s.status) && start >= in7Days && start <= now;
    });
    if (recent.length === 0) return [];

    const avgPlayers = recent.reduce((sum, s) => sum + s.registeredCount, 0) / recent.length;
    const capacityRates = recent
      .filter((s) => !!s.maxParticipants)
      .map((s) => s.registeredCount / s.maxParticipants!);
    const avgCapacity = capacityRates.length > 0 ? (capacityRates.reduce((a, b) => a + b, 0) / capacityRates.length) * 100 : null;

    const stats: QuickStat[] = [
      { key: "avg-players", label: "Avg. Players", value: avgPlayers.toFixed(1) },
    ];
    if (avgCapacity !== null) {
      stats.push({ key: "avg-capacity", label: "Avg. Capacity", value: `${Math.round(avgCapacity)}%` });
    }
    return stats;
  }, [mySessionsQuery.data]);

  // Each source is judged on its own (organiserDashboard.ts): a failed
  // sessions request must not blank the player figures that did load.
  const statuses = {
    sessions: sourceStatus(mySessionsQuery),
    activity: sourceStatus(dashboardActivityQuery),
  };
  const failed = failedSources(statuses);
  const retryFailed = () => {
    if (failed.includes("sessions")) mySessionsQuery.refetch();
    if (failed.includes("activity")) dashboardActivityQuery.refetch();
  };
  const retrying = mySessionsQuery.isFetching || dashboardActivityQuery.isFetching;
  const firstLoad = statuses.sessions === "loading" && statuses.activity === "loading";
  const newOrganiser = isNewOrganiser(statuses.sessions, mySessionsQuery.data);
  const goCreate = () => setLocation("/organiser/sessions/new");
  // Activity sits in the right column under Upcoming and spans the two left
  // blocks below TC Live (Quick Actions + Quick Analytics), so it is as tall as them.
  // With no sessions yet there is no right column: it takes the full row.
  const activityPlacement = newOrganiser
    ? "md:col-span-6 xl:col-span-12 xl:col-start-1 xl:row-start-3"
    : "md:col-span-6 xl:col-span-4 xl:col-start-9 xl:row-start-2 xl:row-span-2";

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-dashboard">
      {/* Same page background as the player and coach profiles: the faint lime
          tennis texture, fixed behind the content. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          mixBlendMode: "multiply",
        }}
      />
      <SEO
        title="Organiser Hub | TennisConnect"
        description="Your organising activity, sessions, and stats in one place."
        noIndex
      />

      {/* Persistent sidebar — true desktop only (xl+). Tablet, in either
          orientation, gets the collapsible hamburger version instead
          (see DashboardHeader) so it doesn't cramp the content grid. */}
      <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 z-10 h-screen overflow-hidden transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-72")}>
        <OrganiserSidebarNav
          organiser={organiser}
          profileHref={profileHref}
          className="w-full"
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      {/* Same landmark pattern as the Organiser Hub pages this dashboard
          sits alongside (sessions.tsx, players.tsx, etc.) - <aside>
          above and <OrganiserMobileNav /> below both stay siblings of
          this <main>, not children of it. */}
      <main id="main-content" className="relative z-10 flex-1 min-w-0 pb-16 md:pb-0">
        <DashboardHeader
          organiser={organiser}
          profileHref={profileHref}
          onCreateSession={() => setLocation("/organiser/sessions/new")}
        />

        {firstLoad ? (
          <DashboardSkeleton />
        ) : (
          <>
            {failed.length > 0 && <DashboardWarning message={failureMessage(failed)} onRetry={retryFailed} retrying={retrying} />}

            {/* Desktop (xl): left column = TC Live, Quick Actions, Quick Analytics;
                right column = Upcoming Sessions (level with TC Live), then Activity
                Feed spanning the two left blocks below TC Live's row. Mobile keeps
                the DOM order: Live, Upcoming, Quick Actions, Activity, Analytics. */}
            <div className="px-4 sm:px-6 lg:px-8 py-4" data-testid="organiser-dashboard-content">
              <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-2">
                {statuses.sessions === "loading" ? (
                  <CardSkeleton testId="organiser-live-skeleton" className="md:col-span-6 xl:col-span-8 xl:col-start-1 xl:row-start-1 xl:h-[340px]" height="h-64" />
                ) : statuses.sessions === "error" ? (
                  <CardUnavailable testId="organiser-live-unavailable" title="Live Session" className="md:col-span-6 xl:col-span-8 xl:col-start-1 xl:row-start-1" />
                ) : newOrganiser ? (
                  <WelcomeEmptyState onCreateSession={goCreate} className="md:col-span-6 xl:col-span-12 xl:col-start-1 xl:row-start-1" />
                ) : (
                  <LiveTodayCard
                    session={liveSession}
                    nextUpcoming={upcomingSessions[0] ?? null}
                    className="md:col-span-6 xl:col-span-8 xl:col-start-1 xl:row-start-1"
                    onEnterLive={liveAvailableFor(liveMode, realLiveSession) ? () => liveSession && setLocation(`/organiser/sessions/${liveSession.id}/live`) : undefined}
                    onManageCheckIn={(id) => setLocation(`/organiser/sessions/${id}?tab=players`)}
                    onOpenSession={(id) => setLocation(`/organiser/sessions/${id}`)}
                  />
                )}

                {/* A new organiser's welcome card already carries the Create Session
                    CTA, so the empty Upcoming card is left out rather than repeating it. */}
                {statuses.sessions === "loading" ? (
                  <CardSkeleton testId="organiser-upcoming-skeleton" className="md:col-span-6 xl:col-span-4 xl:col-start-9 xl:row-start-1 xl:h-[340px]" />
                ) : statuses.sessions === "error" ? (
                  <CardUnavailable testId="organiser-upcoming-unavailable" title="Upcoming Sessions" className="md:col-span-6 xl:col-span-4 xl:col-start-9 xl:row-start-1" />
                ) : newOrganiser ? null : (
                  <UpcomingSessionsCard
                    sessions={upcomingSessions}
                    onManage={(id) => setLocation(`/organiser/sessions/${id}`)}
                    className="md:col-span-6 xl:col-span-4 xl:col-start-9 xl:row-start-1 xl:h-[340px]"
                  />
                )}

                <QuickActionsCard
                  organizationSlug={orgQuery.data?.slug ?? null}
                  upcomingSessions={upcomingSessions}
                  onCheckIn={(id) => setLocation(`/organiser/sessions/${id}?tab=players`)}
                  className={newOrganiser ? "md:col-span-6 xl:col-span-12 xl:col-start-1 xl:row-start-2" : "md:col-span-6 xl:col-span-8 xl:col-start-1 xl:row-start-2"}
                />

                {statuses.activity === "loading" ? (
                  <CardSkeleton testId="organiser-activity-skeleton" className={activityPlacement} height="h-40" />
                ) : statuses.activity === "error" ? (
                  <CardUnavailable testId="organiser-activity-unavailable" title="Recent Activity" className={activityPlacement} />
                ) : (
                  <RecentActivityCard items={dashboardActivityQuery.data ?? []} className={activityPlacement} />
                )}

                {statuses.sessions === "ready" && !newOrganiser && (
                  <StatisticsCard stats={quickAnalytics} className="md:col-span-6 xl:col-span-8 xl:col-start-1 xl:row-start-3" />
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <OrganiserMobileNav />
    </div>
  );
}
