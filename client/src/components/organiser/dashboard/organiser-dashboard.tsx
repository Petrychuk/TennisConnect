import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SEO from "@/components/seo";
import { useAuth } from "@/lib/auth-context";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { DashboardHeader } from "./dashboard-header";
import { DashboardHero } from "./dashboard-hero";
import { TodaysFocusCard } from "./todays-focus-card";
import { LiveTodayCard } from "./live-today-card";
import { UpcomingSessionsCard } from "./upcoming-sessions-card";
import { SeasonProgressCard } from "./season-progress-card";
import { QuickActionsCard } from "./quick-actions-card";
import { RecentActivityCard } from "./recent-activity-card";
import { StatisticsCard } from "./statistics-card";
import { AlertsCard } from "./alerts-card";
import { AiAssistantCard } from "./ai-assistant-card";

import {
  mockOrganiser,
  mockStatStrip,
  mockTodaysFocus,
  mockLiveSession,
  mockLiveSessionState,
  mockSessions,
  mockSeason,
  mockLeaderboard,
  mockActivity,
  mockQuickAnalytics,
  mockHighlight,
  mockAlerts,
  mockAiRecommendations,
} from "@/lib/organiser-hub-mock-data";

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
  const [createSessionNotice, setCreateSessionNotice] = useState(false);
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";

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
      <aside className="hidden xl:flex xl:w-64 shrink-0 border-r border-border">
        <OrganiserSidebarNav organiser={mockOrganiser} profileHref={profileHref} className="w-full" />
      </aside>

      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        <DashboardHeader
          organiser={mockOrganiser}
          profileHref={profileHref}
          onCreateSession={() => setCreateSessionNotice(true)}
        />

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <DashboardHero organiser={mockOrganiser} stats={mockStatStrip} />

            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
              {createSessionNotice && (
                <div
                  className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary"
                  data-testid="organiser-create-session-notice"
                >
                  Session creation isn't wired up on this page yet — this is the mock-data pass.
                </div>
              )}

              {/*
                A single grid with per-card `order` classes rather than
                three separate grids — the mobile sequence genuinely
                differs from desktop (Today's Session -> Activity ->
                Sessions -> Analytics -> Quick Actions), it isn't just the
                desktop grid reflowed into one column.
              */}
              <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-6">
                <TodaysFocusCard
                  focus={mockTodaysFocus}
                  className="md:col-span-6 xl:col-span-12 order-1"
                />

                <LiveTodayCard
                  session={mockLiveSession}
                  liveState={mockLiveSessionState}
                  className="md:col-span-6 xl:col-span-8 order-2 xl:order-4"
                  onEnterLive={() => setCreateSessionNotice(true)}
                />

                <AlertsCard
                  alerts={mockAlerts}
                  className="md:col-span-6 xl:col-span-4 order-3 xl:order-2"
                />

                <RecentActivityCard
                  items={mockActivity}
                  className="md:col-span-6 xl:col-span-4 order-4 xl:order-5"
                />

                <UpcomingSessionsCard
                  sessions={mockSessions}
                  className="md:col-span-6 xl:col-span-8 order-5 xl:order-6"
                />

                <SeasonProgressCard
                  seasonLabel={mockSeason.label}
                  weekLabel={mockSeason.weekLabel}
                  progressPercent={mockSeason.progressPercent}
                  leaderboard={mockLeaderboard}
                  className="md:col-span-6 xl:col-span-4 order-6 xl:order-7"
                />

                <StatisticsCard
                  stats={mockQuickAnalytics}
                  highlight={mockHighlight.message}
                  className="md:col-span-6 xl:col-span-8 order-7 xl:order-9"
                />

                <QuickActionsCard
                  onCreateSession={() => setCreateSessionNotice(true)}
                  className="md:col-span-3 xl:col-span-4 order-8 xl:order-8"
                />

                <AiAssistantCard
                  recommendations={mockAiRecommendations}
                  className="md:col-span-3 xl:col-span-4 order-9 xl:order-3"
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
