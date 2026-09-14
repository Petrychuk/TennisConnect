import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu, Plus, CalendarRange, Users, MoreHorizontal, Archive, Trash2, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { getSeasons, archiveSeason, deleteSeason, type SeasonWithCounts } from "@/lib/api/organizer-sessions";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { seasonStatus, SEASON_STATUS_LABEL, SEASON_STATUS_STYLE, formatSeasonPeriod, type SeasonStatus } from "@/lib/season-utils";

type StatusFilter = "all" | SeasonStatus;

function SeasonRow({ season, onArchive, onDelete }: { season: SeasonWithCounts; onArchive: (s: SeasonWithCounts) => void; onDelete: (s: SeasonWithCounts) => void }) {
  const [, setLocation] = useLocation();
  const status = seasonStatus(season);
  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === season.type)?.label ?? season.type;
  const openDetails = () => setLocation(`/organiser/seasons/${season.id}`);

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors"
      data-testid={`organiser-season-row-${season.id}`}
    >
      <div className="min-w-0 flex-1 cursor-pointer" onClick={openDetails}>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-bold truncate" data-testid={`organiser-season-row-${season.id}-name`}>{season.name}</h3>
          <Badge variant="outline" className="text-[11px] font-medium shrink-0">{typeLabel}</Badge>
          <Badge className={cn("shrink-0", SEASON_STATUS_STYLE[status])} data-testid={`organiser-season-row-${season.id}-status`}>
            {SEASON_STATUS_LABEL[status]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1" data-testid={`organiser-season-row-${season.id}-period`}>
          {formatSeasonPeriod(season)}
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm shrink-0">
        <span className="flex items-center gap-1.5" data-testid={`organiser-season-row-${season.id}-sessions`}>
          <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-bold">{season.sessionsCount}</span>
          <span className="text-muted-foreground">Sessions</span>
        </span>
        <span className="flex items-center gap-1.5" data-testid={`organiser-season-row-${season.id}-players`}>
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-bold">{season.playersCount}</span>
          <span className="text-muted-foreground">Players</span>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <Button
          variant={status === "completed" ? "outline" : "default"}
          onClick={openDetails}
          className="flex-1 sm:flex-none"
          data-testid={`organiser-season-row-${season.id}-action`}
        >
          {status === "completed" ? "View" : "Manage"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0" data-testid={`organiser-season-row-${season.id}-menu`}>
              <MoreHorizontal className="w-4 h-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {season.sessionsCount > 0 ? (
              <DropdownMenuItem onClick={() => onArchive(season)} data-testid={`organiser-season-row-${season.id}-archive`}>
                <Archive className="w-4 h-4 mr-2" />
                Archive Season
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onDelete(season)} className="text-destructive focus:text-destructive" data-testid={`organiser-season-row-${season.id}-delete`}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Season
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function OrganiserSeasonsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null, isAdmin: user.isAdmin ?? false } : mockOrganiser;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [archiveTarget, setArchiveTarget] = useState<SeasonWithCounts | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeasonWithCounts | null>(null);

  const seasonsQuery = useQuery({
    queryKey: ["/api/organizer/seasons"],
    queryFn: getSeasons,
    enabled: isAuthenticated,
  });
  const seasons = seasonsQuery.data ?? [];

  const withStatus = useMemo(() => seasons.map((s) => ({ season: s, status: seasonStatus(s) })), [seasons]);
  const counts = {
    all: withStatus.length,
    active: withStatus.filter((s) => s.status === "active").length,
    upcoming: withStatus.filter((s) => s.status === "upcoming").length,
    completed: withStatus.filter((s) => s.status === "completed").length,
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return withStatus
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .filter((s) => !query || s.season.name.toLowerCase().includes(query))
      .map((s) => s.season);
  }, [withStatus, statusFilter, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/organizer/seasons"] });

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveSeason(archiveTarget.id);
      invalidate();
      toast({ title: "Season archived" });
    } catch (error: any) {
      toast({ title: "Couldn't archive season", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setArchiveTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSeason(deleteTarget.id);
      invalidate();
      toast({ title: "Season deleted" });
    } catch (error: any) {
      toast({ title: "Couldn't delete season", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardContent className="p-6 text-muted-foreground">
            You need to be an approved organiser to view this page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-seasons-page">
      <SEO
        title="Seasons | Organiser Hub | TennisConnect"
        description="Organise your sessions and track participation and results over time."
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

      <main id="main-content" className="flex-1 min-w-0 pb-16 md:pb-0">
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
          <div className="font-display font-bold">Seasons</div>
          <div className="flex items-center gap-1">
            <NotificationBell testId="organiser-header-bell-mobile" />
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Seasons</h1>
              <p className="text-muted-foreground mt-1">Organise your sessions and track participation and results over time.</p>
            </div>
            <Button className="gap-2 shrink-0" onClick={() => setLocation("/organiser/seasons/new")} data-testid="organiser-seasons-create">
              <Plus className="w-4 h-4" />
              Create Season
            </Button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="organiser-seasons-status-tabs">
            {([
              ["all", `All (${counts.all})`],
              ["active", `Active (${counts.active})`],
              ["upcoming", `Upcoming (${counts.upcoming})`],
              ["completed", `Completed (${counts.completed})`],
            ] as [StatusFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-sm font-medium shrink-0 transition-colors",
                  statusFilter === key ? "bg-primary text-foreground" : "border border-border text-muted-foreground hover:bg-accent/40"
                )}
                data-testid={`organiser-seasons-status-tab-${key}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search seasons by name..."
              className="pl-9"
              data-testid="organiser-seasons-search"
            />
          </div>

          {seasonsQuery.isLoading ? (
            <div className="space-y-3" data-testid="organiser-seasons-loading">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : seasons.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl border border-dashed border-border" data-testid="organiser-seasons-empty">
              <CalendarRange className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-semibold">No seasons yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Seasons help you organise multiple sessions and track results over time.
                </p>
                <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                  Running casual sessions? You don't need to create a season.
                </p>
              </div>
              <Button onClick={() => setLocation("/organiser/seasons/new")} data-testid="organiser-seasons-empty-create">
                <Plus className="w-4 h-4 mr-2" />
                Create Season
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-seasons-no-matches">
              No seasons match your search.
            </p>
          ) : (
            <div className="space-y-3" data-testid="organiser-seasons-list">
              {filtered.map((season) => (
                <SeasonRow key={season.id} season={season} onArchive={setArchiveTarget} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </div>
      </main>

      <OrganiserMobileNav />

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{archiveTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the season from your Seasons list, but its sessions, players, scores, and
              results are all preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="organiser-seasons-archive-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} data-testid="organiser-seasons-archive-confirm">
              Archive Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This season has no sessions attached, so it can be safely deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="organiser-seasons-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="organiser-seasons-delete-confirm">
              Delete Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
