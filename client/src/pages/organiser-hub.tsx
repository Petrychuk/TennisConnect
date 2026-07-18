import { useState } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SEO from "@/components/seo";
import { useAuth } from "@/lib/auth-context";
import { TennisLoader } from "@/components/ui/tennisLoader";

import { DashboardHeader } from "@/components/organiser/dashboard-header";
import { DashboardHero } from "@/components/organiser/dashboard-hero";
import { LiveTodayCard } from "@/components/organiser/live-today-card";
import { UpcomingSessionsCard } from "@/components/organiser/upcoming-sessions-card";
import { SeasonProgressCard } from "@/components/organiser/season-progress-card";
import { QuickActionsCard } from "@/components/organiser/quick-actions-card";
import { RecentActivityCard } from "@/components/organiser/recent-activity-card";
import { StatisticsCard } from "@/components/organiser/statistics-card";

import {
  mockOrganiser,
  mockLiveToday,
  mockUpcomingSessions,
  mockSeasonProgress,
  mockStatistics,
  mockActivity,
} from "@/lib/organiser-hub-mock-data";

// NOTE: this page is intentionally mock-data only (feature/organiser-hub-dashboard).
// The previous functional dashboard — real Organization/Session CRUD against
// /api/organizer/* — lives in organizer-dashboard.tsx, currently unrouted.
// Wiring real data back in later is a matter of replacing the mock imports
// above with fetches that return the same shapes (see organiser-hub-mock-data.ts).
export default function OrganiserHubPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [createSessionNotice, setCreateSessionNotice] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <TennisLoader />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Organiser access required</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              You need to be an approved organiser to view this page. Head to your profile to
              request organiser access.
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Organiser Hub | TennisConnect"
        description="Your organising activity, sessions, and stats in one place."
        noIndex
      />
      <Navbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <DashboardHeader
          organizationName={mockOrganiser.organizationName}
          organizationSlug={mockOrganiser.organizationSlug}
          onCreateSession={() => setCreateSessionNotice(true)}
        />

        {createSessionNotice && (
          <div
            className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary"
            data-testid="organiser-hub-create-session-notice"
          >
            Session creation isn't wired up on this page yet — this is the mock-data pass. Use
            the previous dashboard for actual session management in the meantime.
          </div>
        )}

        <DashboardHero organiser={mockOrganiser} sessionsThisWeek={mockUpcomingSessions.length + mockLiveToday.length} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <LiveTodayCard sessions={mockLiveToday} className="md:col-span-2 lg:col-span-2" />
          <QuickActionsCard
            organizationSlug={mockOrganiser.organizationSlug}
            onCreateSession={() => setCreateSessionNotice(true)}
            className="lg:row-span-2"
          />

          <UpcomingSessionsCard sessions={mockUpcomingSessions} className="md:col-span-2 lg:col-span-2" />
          <SeasonProgressCard
            seasonLabel={mockSeasonProgress.seasonLabel}
            sessionsRun={mockSeasonProgress.sessionsRun}
            sessionsGoal={mockSeasonProgress.sessionsGoal}
            playersEngaged={mockSeasonProgress.playersEngaged}
            daysRemaining={mockSeasonProgress.daysRemaining}
          />

          <StatisticsCard
            totalSessions={mockStatistics.totalSessions}
            totalParticipants={mockStatistics.totalParticipants}
            averageAttendanceRate={mockStatistics.averageAttendanceRate}
            averageRating={mockStatistics.averageRating}
            className="md:col-span-2 lg:col-span-2"
          />
          <RecentActivityCard items={mockActivity} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
