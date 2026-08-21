import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/seo";
import { useAuth } from "@/lib/auth-context";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { DashboardHeader } from "./dashboard-header";
import { DashboardHero } from "./dashboard-hero";
import { LiveTodayCard } from "./live-today-card";
import { UpcomingSessionsCard } from "./upcoming-sessions-card";
import { SeasonProgressCard } from "./season-progress-card";
import { QuickActionsCard } from "./quick-actions-card";
import { RecentActivityCard } from "./recent-activity-card";
import { StatisticsCard } from "./statistics-card";

import {
  getMySessions,
  getOrganizationByUserSlug,
  getSessionRegistrations,
  getDashboardStats,
  getDashboardActivity,
} from "@/lib/api/organizer-sessions";
import type { TennisSession, SessionWithDetails } from "@shared/schema";

import {
  mockOrganiser,
  mockStatStrip,
  mockLiveSession,
  mockSeason,
  mockLeaderboard,
  mockQuickAnalytics,
  mockHighlight,
  type MockSession,
  type StatStripItem,
} from "@/lib/organiser-hub-mock-data";

// Real sessions take priority everywhere they're available. Live
// Session/Upcoming Sessions/Active Players/Attendance/Revenue/Activity
// Feed are all real now (dashboard/stats + dashboard/activity - see
// server/storage.ts getOrganizerDashboardStats/
// getRecentActivityForOrganization). Season Progress/Leaderboard and
// the Statistics/Highlight card still have no real backend to source
// from (no seasons or analytics-rollup endpoints exist yet), so those
// stay mock for now.
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

// NOTE: mock-data only for now (see organiser-hub-mock-data.ts). Every
// prop type mirrors the shape the real /api/organizer/* endpoints already
// return, so this component doesn't need to change shape when the data
// source does — only the imports at the top of OrganiserDashboardPage do.
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
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  // Real name/avatar from the authenticated user - role/organization
  // fields stay mock for now since there's no backend for those yet.
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null } : mockOrganiser;

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

  // Real only, capped at 6 - a full "everything upcoming" list already
  // exists at /organiser/sessions (the "View all" link). Backend already
  // excludes anything not "published" (draft/archived/completed/live
  // never show up here - see getUpcomingPublishedSessionsByOrganization).
  const upcomingSessions: MockSession[] = useMemo(
    () => (orgQuery.data?.upcomingSessions ?? []).slice(0, 6).map((s) => toMockSession(s)),
    [orgQuery.data]
  );

  const upcomingCount7Days = useMemo(() => {
    if (!mySessionsQuery.data) return null;
    const now = Date.now();
    const in7Days = now + 7 * 24 * 60 * 60 * 1000;
    return mySessionsQuery.data.filter((s) => {
      const start = new Date(s.startAt).getTime();
      return s.status === "published" && start >= now && start <= in7Days;
    }).length;
  }, [mySessionsQuery.data]);

  // Every stat is real now once its query has loaded - dashboardStatsQuery
  // covers players/attendance/revenue in one round trip (see
  // getOrganizerDashboardStats), live/upcoming come from mySessionsQuery.
  const statStrip: StatStripItem[] = mockStatStrip.map((stat) => {
    if (stat.key === "live" && mySessionsQuery.data) {
      const liveCount = mySessionsQuery.data.filter((s) => s.status === "live").length;
      return { ...stat, value: String(liveCount) };
    }
    if (stat.key === "upcoming" && upcomingCount7Days !== null) {
      return { ...stat, value: String(upcomingCount7Days) };
    }
    if (stat.key === "players" && dashboardStatsQuery.data) {
      return { ...stat, value: String(dashboardStatsQuery.data.activePlayers) };
    }
    if (stat.key === "attendance" && dashboardStatsQuery.data) {
      return { ...stat, value: `${dashboardStatsQuery.data.attendancePercent}%` };
    }
    if (stat.key === "revenue" && dashboardStatsQuery.data) {
      return { ...stat, value: `$${dashboardStatsQuery.data.revenueThisWeek.toFixed(0)}` };
    }
    return stat;
  });

  useEffect(() => {
    // Mock-data phase: nothing to actually await yet, but keeping a brief
    // loading state here means the Skeleton path is exercised and ready
    // for when this becomes a real fetch.
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  if (authLoading) return null;

  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardHeader>
            <CardTitle>Organiser access required</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            You need to be an approved organiser to view this page. Head to your profile to
            request organiser access.
          </CardContent>
        </Card>
      </div>
    );
  }

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
      <aside className="hidden xl:flex xl:w-64 shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto">
        <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} className="w-full" />
      </aside>

      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        <DashboardHeader
          organiser={organiser}
          profileHref={profileHref}
          onCreateSession={() => setLocation("/organiser/sessions/new")}
        />

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <DashboardHero organiser={organiser} stats={statStrip} />

            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-6">
                <LiveTodayCard
                  session={liveSession}
                  className="md:col-span-6 xl:col-span-8"
                  onEnterLive={() => liveSession && setLocation(`/organiser/sessions/${liveSession.id}/live`)}
                />
                <RecentActivityCard items={dashboardActivityQuery.data ?? []} className="md:col-span-6 xl:col-span-4" />

                <UpcomingSessionsCard
                  sessions={upcomingSessions}
                  onCreateSession={() => setLocation("/organiser/sessions/new")}
                  className="md:col-span-6 xl:col-span-8"
                />
                <SeasonProgressCard
                  seasonLabel={mockSeason.label}
                  weekLabel={mockSeason.weekLabel}
                  progressPercent={mockSeason.progressPercent}
                  leaderboard={mockLeaderboard}
                  className="md:col-span-6 xl:col-span-4"
                />

                <QuickActionsCard
                  organizationSlug={orgQuery.data?.slug || organiser.organizationSlug}
                  onCreateSession={() => setLocation("/organiser/sessions/new")}
                  className="md:col-span-3 xl:col-span-4"
                />
                <StatisticsCard
                  stats={mockQuickAnalytics}
                  highlight={mockHighlight.message}
                  className="md:col-span-3 xl:col-span-8"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <OrganiserMobileNav />
    </div>
  );
}
