import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, ChevronRight, Download, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { PlayersStatStrip } from "@/components/organiser/players/players-stat-strip";
import { PlayersToolbar } from "@/components/organiser/players/players-toolbar";
import { PlayersTable } from "@/components/organiser/players/players-table";
import { PlayersList } from "@/components/organiser/players/players-list";
import { TopPlayersCard } from "@/components/organiser/players/top-players-card";
import { RecentNewPlayersCard } from "@/components/organiser/players/recent-new-players-card";

import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import {
  mockOrgPlayers,
  mockOrgPlayersSummary,
  mockTopPlayersBySessions,
  mockTopPlayersByWinRate,
  mockRecentNewPlayers,
  type OrgPlayer,
} from "@/lib/organiser-players-mock-data";
import { getMyPlayers, inviteToOrganization } from "@/lib/api/organizer-sessions";
import { toOrgPlayers } from "@/lib/api/session-adapter";
import { InvitePlayersDialog } from "@/components/organiser/shared/invite-players-dialog";

type MobileFilter = "all" | "active" | "new";

export default function OrganiserPlayersPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const { toast } = useToast();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  // Real name/avatar from the authenticated user - role/organization
  // fields stay mock for now since there's no backend for those yet.
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false } : mockOrganiser;

  const myPlayersQuery = useQuery({
    queryKey: ["/api/organizer/players/mine"],
    queryFn: getMyPlayers,
    enabled: isAuthenticated,
  });

  // Real players only now - was padding the list with the mock
  // "crowd" (same pattern already removed from the session-level
  // Players/Registration tabs earlier), which is exactly why test
  // players kept reappearing here even after being cleaned up
  // elsewhere: this page's own list was never touched.
  const allPlayers: OrgPlayer[] = useMemo(
    () => toOrgPlayers(myPlayersQuery.data ?? []),
    [myPlayersQuery.data]
  );

  const realCount = myPlayersQuery.data?.length ?? 0;
  // Real total only - was previously baselined on top of the mock
  // org's own fake "128 total" figure, which would have kept
  // disagreeing with the now-real-only list below it.
  const playersSummary = {
    ...mockOrgPlayersSummary,
    totalPlayers: realCount,
    activeThisSeason: allPlayers.filter((p) => p.status === "active").length,
    // No real "joined this month" tracking exists yet - 0 is honest,
    // a fabricated count isn't.
    newThisMonth: 0,
  };

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "grid">("table");
  const [mobileFilter, setMobileFilter] = useState<MobileFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? allPlayers.filter((p) => p.name.toLowerCase().includes(query)) : allPlayers;
  }, [allPlayers, search]);

  const mobileFiltered = useMemo(() => {
    if (mobileFilter === "active") return filtered.filter((p) => p.status === "active");
    if (mobileFilter === "new") return allPlayers.slice(0, playersSummary.newThisMonth > filtered.length ? filtered.length : playersSummary.newThisMonth).filter((p) => filtered.includes(p));
    return filtered;
  }, [filtered, mobileFilter, allPlayers]);

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
            <CardTitle asChild><h1>Organiser access required</h1></CardTitle>
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
    <div className="min-h-screen flex bg-background" data-testid="organiser-players-page">
      <SEO
        title="Players | Organiser Hub | TennisConnect"
        description="All players who have joined your sessions."
        noIndex
      />

      <aside className={cn("hidden xl:flex shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto transition-[width] duration-200", sidebarCollapsed ? "xl:w-20" : "xl:w-64")}>
        <OrganiserSidebarNav
          organiser={organiser}
          profileHref={profileHref}
          className="w-full"
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      {/* See sessions.tsx's own comment on this same pattern - <aside>
          above and <OrganiserMobileNav /> below both stay siblings of
          this <main>, not children of it. */}
      <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
        {/* Compact bar — tablet & mobile */}
        <div className="flex xl:hidden items-center justify-between px-4 h-14 border-b border-border bg-card">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" data-testid="organiser-sidebar-trigger">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
              <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} />
            </SheetContent>
          </Sheet>
          <div className="w-9 h-9 md:hidden" aria-hidden="true" />

          <div className="font-display font-bold">Players</div>

          <div className="flex items-center gap-1">
            <NotificationBell testId="organiser-header-bell-mobile" />
            <Link href={profileHref}>
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={organiser.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {organiser.name[0]}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex items-center gap-1.5 text-sm" data-testid="organiser-players-page-breadcrumb">
            <Link href="/organiser" className="text-primary-text hover:underline">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Players</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Players</h1>
              <p className="text-muted-foreground mt-1">All players who have joined your sessions.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => toast({ title: "Export List isn't wired up yet" })}
                data-testid="organiser-players-page-export"
              >
                <Download className="w-4 h-4 mr-2" />
                Export List
              </Button>
              <Button
                onClick={() => setInviteOpen(true)}
                data-testid="organiser-players-page-invite"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Players
              </Button>
            </div>
          </div>

          <PlayersStatStrip summary={playersSummary} />

          {/* Desktop */}
          <div className="hidden xl:block space-y-6">
            <PlayersToolbar search={search} onSearchChange={setSearch} view={view} onViewChange={setView} showAdvancedFilters />
            <PlayersTable players={filtered} />
            <p className="text-sm text-muted-foreground" data-testid="organiser-players-page-pagination">
              Showing 1 to {Math.min(filtered.length, 10)} of {playersSummary.totalPlayers} players
            </p>
            <div className="grid grid-cols-3 gap-6">
              <TopPlayersCard
                title="Top Players by Sessions"
                testId="organiser-players-page-top-sessions"
                entries={mockTopPlayersBySessions.map((p) => ({ id: p.id, name: p.name, value: String(p.sessionsPlayed) }))}
              />
              <TopPlayersCard
                title="Top Win Rate"
                testId="organiser-players-page-top-winrate"
                entries={mockTopPlayersByWinRate.map((p) => ({ id: p.id, name: p.name, value: `${p.winRate}%` }))}
              />
              <RecentNewPlayersCard players={mockRecentNewPlayers} />
            </div>
          </div>

          {/* Tablet */}
          <div className="hidden md:block xl:hidden space-y-6">
            <PlayersToolbar search={search} onSearchChange={setSearch} />
            <PlayersList players={filtered} />
            <p className="text-sm text-muted-foreground" data-testid="organiser-players-page-pagination-tablet">
              Showing 1 to {Math.min(filtered.length, 10)} of {playersSummary.totalPlayers} players
            </p>
            <div className="grid grid-cols-2 gap-6">
              <TopPlayersCard
                title="Top Sessions"
                testId="organiser-players-page-top-sessions-tablet"
                entries={mockTopPlayersBySessions.slice(0, 3).map((p) => ({ id: p.id, name: p.name, value: String(p.sessionsPlayed) }))}
              />
              <TopPlayersCard
                title="Top Win Rate"
                testId="organiser-players-page-top-winrate-tablet"
                entries={mockTopPlayersByWinRate.slice(0, 3).map((p) => ({ id: p.id, name: p.name, value: `${p.winRate}%` }))}
              />
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-6">
            <PlayersToolbar search={search} onSearchChange={setSearch} />
            <div className="flex items-center gap-2" data-testid="organiser-players-page-mobile-filters">
              {([
                ["all", `All (${playersSummary.totalPlayers})`],
                ["active", `Active (${playersSummary.activeThisSeason})`],
                ["new", `New (${playersSummary.newThisMonth})`],
              ] as [MobileFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMobileFilter(key)}
                  className={
                    mobileFilter === key
                      ? "px-4 py-1.5 rounded-xl bg-primary text-foreground text-sm font-medium"
                      : "px-4 py-1.5 rounded-xl border border-border text-sm font-medium text-muted-foreground"
                  }
                  data-testid={`organiser-players-page-mobile-filter-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <PlayersList players={mobileFiltered} showSessions={false} />
            <p className="text-sm text-muted-foreground" data-testid="organiser-players-page-pagination-mobile">
              Showing 1 to {Math.min(mobileFiltered.length, 10)} of {playersSummary.totalPlayers} players
            </p>
          </div>
        </div>
      </main>

      <OrganiserMobileNav />

      <InvitePlayersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite Players"
        description="Search for players on TennisConnect and invite them to join your community."
        onInvite={(userId) => inviteToOrganization(userId).then(() => {})}
        searchContext={{ community: true }}
        alreadyConnectedLabel="Already a member"
      />
    </div>
  );
}
