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
import { DashboardHero } from "./dashboard-hero";
import { LiveTodayCard } from "./live-today-card";
import { UpcomingSessionsCard } from "./upcoming-sessions-card";
import { QuickActionsCard } from "./quick-actions-card";
import { RecentActivityCard } from "./recent-activity-card";
import { StatisticsCard } from "./statistics-card";
import { CardSkeleton, CardUnavailable, DashboardWarning, WelcomeEmptyState } from "./dashboard-states";
import {
  attendanceTileValue,
  countTileValue,
  countUpcoming7Days,
  failedSources,
  failureMessage,
  isNewOrganiser,
  sourceStatus,
} from "@/lib/organiserDashboard";

import {
  getMySessions,
  getOrganizationByUserSlug,
  getSessionRegistrations,
  getDashboardStats,
  getDashboardActivity,
} from "@/lib/api/organizer-sessions";
import type { TennisSession, SessionWithDetails } from "@shared/schema";

import type { MockSession, StatStripItem, QuickStat } from "@/lib/organiser-hub-mock-data";
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
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8" data-testid="organiser-dashboard-skeleton">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
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

/** The four headline tiles. value null = still loading; error = request failed. */
const STAT_STRIP: Omit<StatStripItem, "value">[] = [
  { key: "live", label: "Live Session", sublabel: "Today" },
  { key: "upcoming", label: "Upcoming Sessions", sublabel: "Next 7 days" },
  { key: "players", label: "Active Players", sublabel: "This season" },
  { key: "attendance", label: "Attendance", sublabel: "This season" },
];

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
  const dashboardStatsQuery = useQuery({
    queryKey: ["/api/organizer/dashboard/stats"],
    queryFn: getDashboardStats,
    enabled: isAuthenticated,
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

  // Real only, capped at 4 - enough to feel useful without overflowing
  // or unbalancing the grid next to Quick Actions in the same row. A
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
      .slice(0, 4)
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
    stats: sourceStatus(dashboardStatsQuery),
    activity: sourceStatus(dashboardActivityQuery),
  };
  const sessions = mySessionsQuery.data ?? [];
  const liveSessions = sessions.filter((s) => s.status === "live");
  const statStrip: StatStripItem[] = STAT_STRIP.map((stat) => {
    if (stat.key === "live") {
      return {
        ...stat,
        value: countTileValue(statuses.sessions, liveSessions.length),
        // One live session: straight to it (Live page on Staging, the
        // workspace elsewhere). Several: the Live bucket of the list.
        href: statuses.sessions !== "ready"
          ? undefined
          : liveSessions.length === 1
            ? liveAvailableFor(liveMode, liveSessions[0]) ? `/organiser/sessions/${liveSessions[0].id}/live` : `/organiser/sessions/${liveSessions[0].id}`
            : "/organiser/sessions?bucket=live",
      };
    }
    if (stat.key === "upcoming") {
      return { ...stat, value: countTileValue(statuses.sessions, countUpcoming7Days(sessions)), href: statuses.sessions === "ready" ? "/organiser/sessions?bucket=upcoming" : undefined };
    }
    if (stat.key === "players") {
      return { ...stat, value: countTileValue(statuses.stats, dashboardStatsQuery.data?.activePlayers), href: statuses.stats === "ready" ? "/organiser/players" : undefined };
    }
    return {
      ...stat,
      value: attendanceTileValue(statuses.stats, dashboardStatsQuery.data?.attendancePercent),
      href: statuses.stats === "ready" ? "/organiser/reports" : undefined,
    };
  });
  const failed = failedSources(statuses);
  const retryFailed = () => {
    if (failed.includes("sessions")) mySessionsQuery.refetch();
    if (failed.includes("stats")) dashboardStatsQuery.refetch();
    if (failed.includes("activity")) dashboardActivityQuery.refetch();
  };
  const retrying = mySessionsQuery.isFetching || dashboardStatsQuery.isFetching || dashboardActivityQuery.isFetching;
  const firstLoad = statuses.sessions === "loading" && statuses.stats === "loading";
  const newOrganiser = isNewOrganiser(statuses.sessions, mySessionsQuery.data);
  const goCreate = () => setLocation("/organiser/sessions/new");

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-dashboard">
      <SEO
        title="Organiser Hub | TennisConnect"
        description="Your organising activity, sessions, and stats in one place."
        noIndex
      />

      {/* Persistent sidebar — true desktop only (xl+). Tablet, in either
          orientation, gets the collapsible hamburger version instead
          (see DashboardHeader) so it doesn't cramp the content grid. */}
      <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-72")}>
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
      <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
        <DashboardHeader
          organiser={organiser}
          profileHref={profileHref}
          onCreateSession={() => setLocation("/organiser/sessions/new")}
        />

        {firstLoad ? (
          <DashboardSkeleton />
        ) : (
          <>
            <DashboardHero organiser={organiser} stats={statStrip} />

            {failed.length > 0 && <DashboardWarning message={failureMessage(failed)} onRetry={retryFailed} retrying={retrying} />}

            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-6">
                {statuses.sessions === "loading" ? (
                  <CardSkeleton testId="organiser-live-skeleton" className="md:col-span-6 xl:col-span-8" height="h-72" />
                ) : statuses.sessions === "error" ? (
                  <CardUnavailable testId="organiser-live-unavailable" title="Live Session" className="md:col-span-6 xl:col-span-8" />
                ) : newOrganiser ? (
                  <WelcomeEmptyState onCreateSession={goCreate} className="md:col-span-6 xl:col-span-8" />
                ) : (
                  <LiveTodayCard
                    session={liveSession}
                    nextUpcoming={upcomingSessions[0] ?? null}
                    className="md:col-span-6 xl:col-span-8"
                    onEnterLive={liveAvailableFor(liveMode, realLiveSession) ? () => liveSession && setLocation(`/organiser/sessions/${liveSession.id}/live`) : undefined}
                    onManageCheckIn={(id) => setLocation(`/organiser/sessions/${id}?tab=players`)}
                    onOpenSession={(id) => setLocation(`/organiser/sessions/${id}`)}
                  />
                )}
                {statuses.activity === "loading" ? (
                  <CardSkeleton testId="organiser-activity-skeleton" className="md:col-span-6 xl:col-span-4" height="h-72" />
                ) : statuses.activity === "error" ? (
                  <CardUnavailable testId="organiser-activity-unavailable" title="Recent Activity" className="md:col-span-6 xl:col-span-4" />
                ) : (
                  <RecentActivityCard items={dashboardActivityQuery.data ?? []} className="md:col-span-6 xl:col-span-4" />
                )}

                {/* A new organiser's welcome card already carries the Create Session
                    CTA, so the empty Upcoming card is left out rather than repeating it. */}
                {statuses.sessions === "loading" ? (
                  <CardSkeleton testId="organiser-upcoming-skeleton" className="md:col-span-6 xl:col-span-8" />
                ) : statuses.sessions === "error" ? (
                  <CardUnavailable testId="organiser-upcoming-unavailable" title="Upcoming Sessions" className="md:col-span-6 xl:col-span-8" />
                ) : newOrganiser ? null : (
                  <UpcomingSessionsCard
                    sessions={upcomingSessions}
                    onCreateSession={goCreate}
                    onManage={(id) => setLocation(`/organiser/sessions/${id}`)}
                    className="md:col-span-6 xl:col-span-8"
                  />
                )}
                <QuickActionsCard
                  organizationSlug={orgQuery.data?.slug ?? null}
                  upcomingSessions={upcomingSessions}
                  onCreateSession={goCreate}
                  onCheckIn={(id) => setLocation(`/organiser/sessions/${id}?tab=players`)}
                  className={newOrganiser ? "md:col-span-6 xl:col-span-12" : "md:col-span-6 xl:col-span-4"}
                />

                {statuses.sessions === "ready" && !newOrganiser && (
                  <StatisticsCard stats={quickAnalytics} className="md:col-span-6 xl:col-span-12" />
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
