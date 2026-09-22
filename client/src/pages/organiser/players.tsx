import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, ChevronRight, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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

import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import {
  type OrgPlayer,
} from "@/lib/organiser-players-mock-data";
import { getMyPlayers, inviteToOrganization } from "@/lib/api/organizer-sessions";
import { toOrgPlayers } from "@/lib/api/session-adapter";
import { InvitePlayersDialog } from "@/components/organiser/shared/invite-players-dialog";

type MobileFilter = "all" | "active" | "returning";

export default function OrganiserPlayersPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
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
  // Real total/active/returning only - was previously baselined on top
  // of the mock org's own fake figures (a fake "128 total", a fake
  // return rate, a fake avg rating with no real rating system behind
  // it), which would have kept disagreeing with the now-real-only list
  // below it. "Returning" = played more than one session - the
  // simplest honest reading of "participated more than once" given
  // sessionsPlayed is the one real signal available; there's no
  // separate per-season session count to scope this to "this season"
  // more precisely yet.
  const playersSummary = {
    totalPlayers: realCount,
    activeThisSeason: allPlayers.filter((p) => p.status === "active").length,
    returningPlayers: allPlayers.filter((p) => p.sessionsPlayed > 1).length,
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [mobileFilter, setMobileFilter] = useState<MobileFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allPlayers.filter((p) => {
      if (query && !p.name.toLowerCase().includes(query)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (levelFilter !== "all" && p.levelLabel !== levelFilter) return false;
      return true;
    });
  }, [allPlayers, search, statusFilter, levelFilter]);

  const mobileFiltered = useMemo(() => {
    if (mobileFilter === "active") return filtered.filter((p) => p.status === "active");
    if (mobileFilter === "returning") return filtered.filter((p) => p.sessionsPlayed > 1);
    return filtered;
  }, [filtered, mobileFilter]);

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
                onClick={() => setInviteOpen(true)}
                data-testid="organiser-players-page-invite"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Players
              </Button>
            </div>
          </div>

          <PlayersStatStrip summary={playersSummary} />

          {allPlayers.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-players-page-empty">
              <UserPlus className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No players yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Invite players or create a session to start building your tennis community.
                </p>
              </div>
              <Button onClick={() => setInviteOpen(true)} data-testid="organiser-players-page-empty-invite">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Players
              </Button>
            </div>
          ) : (
          <>
          {/* Desktop */}
          <div className="hidden xl:block space-y-6">
            <PlayersToolbar search={search} onSearchChange={setSearch} status={statusFilter} onStatusChange={setStatusFilter} level={levelFilter} onLevelChange={setLevelFilter} />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-players-page-no-matches">
                No players match your filters.
              </p>
            ) : (
              <>
                <PlayersTable players={filtered} />
                <p className="text-sm text-muted-foreground" data-testid="organiser-players-page-pagination">
                  Showing 1 to {Math.min(filtered.length, 10)} of {playersSummary.totalPlayers} players
                </p>
              </>
            )}
          </div>

          {/* Tablet */}
          <div className="hidden md:block xl:hidden space-y-6">
            <PlayersToolbar search={search} onSearchChange={setSearch} status={statusFilter} onStatusChange={setStatusFilter} level={levelFilter} onLevelChange={setLevelFilter} />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-players-page-no-matches-tablet">
                No players match your filters.
              </p>
            ) : (
              <>
                <PlayersList players={filtered} />
                <p className="text-sm text-muted-foreground" data-testid="organiser-players-page-pagination-tablet">
                  Showing 1 to {Math.min(filtered.length, 10)} of {playersSummary.totalPlayers} players
                </p>
              </>
            )}
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-6">
            <PlayersToolbar search={search} onSearchChange={setSearch} status={statusFilter} onStatusChange={setStatusFilter} level={levelFilter} onLevelChange={setLevelFilter} />
            <div className="flex items-center gap-2" data-testid="organiser-players-page-mobile-filters">
              {([
                ["all", `All (${playersSummary.totalPlayers})`],
                ["active", `Active (${playersSummary.activeThisSeason})`],
                ["returning", `Returning (${playersSummary.returningPlayers})`],
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
            {mobileFiltered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-players-page-no-matches-mobile">
                No players match your filters.
              </p>
            ) : (
              <>
                <PlayersList players={mobileFiltered} showSessions={false} />
                <p className="text-sm text-muted-foreground" data-testid="organiser-players-page-pagination-mobile">
                  Showing 1 to {Math.min(mobileFiltered.length, 10)} of {playersSummary.totalPlayers} players
                </p>
              </>
            )}
          </div>
          </>
          )}
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
