import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, Bell, Plus, LayoutTemplate, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { SessionStatusTabs } from "@/components/organiser/sessions/session-status-tabs";
import { SessionFiltersBar } from "@/components/organiser/sessions/session-filters-bar";
import { SessionCard } from "@/components/organiser/sessions/session-card";
import { SessionsEmptyState } from "@/components/organiser/sessions/sessions-empty-state";
import { NewSessionMenu } from "@/components/organiser/sessions/wizard/new-session-menu";
import { groupSessionsByBucket, type SessionBucket } from "@/components/organiser/sessions/session-utils";

import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { mockSessionsList, type SessionListItem } from "@/lib/organiser-sessions-mock-data";

export default function OrganiserSessionsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";

  const [sessions, setSessions] = useState<SessionListItem[]>(mockSessionsList);
  const [activeBucket, setActiveBucket] = useState<SessionBucket>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? sessions.filter((s) => s.title.toLowerCase().includes(query)) : sessions;
  }, [sessions, search]);

  const grouped = useMemo(() => groupSessionsByBucket(filtered), [filtered]);
  const counts: Record<SessionBucket, number> = {
    all: filtered.length,
    live: grouped.live.length,
    "registration-open": grouped["registration-open"].length,
    upcoming: grouped.upcoming.length,
    draft: grouped.draft.length,
    completed: grouped.completed.length,
    archived: grouped.archived.length,
  };

  const visible = activeBucket === "all" ? filtered : grouped[activeBucket];

  const handleDuplicate = (session: SessionListItem) => {
    const copy: SessionListItem = {
      ...session,
      id: `${session.id}-copy-${Date.now()}`,
      title: `${session.title} (Copy)`,
      status: "draft",
      registrationOpen: false,
      registeredCount: 0,
      checkedInCount: 0,
      waitingCount: 0,
      progressPercent: 0,
      progressLabel: "Not published",
      resultsPublished: false,
    };
    setSessions((prev) => [copy, ...prev]);
  };

  const handleDelete = (session: SessionListItem) => {
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    toast({ title: "Draft deleted", description: `"${session.title}" was removed.` });
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
    <div className="min-h-screen flex bg-background" data-testid="organiser-sessions-page">
      <SEO
        title="Sessions | Organiser Hub | TennisConnect"
        description="Manage all your tennis sessions in one place."
        noIndex
      />

      <aside className="hidden xl:flex xl:w-64 shrink-0 border-r border-border">
        <OrganiserSidebarNav organiser={mockOrganiser} profileHref={profileHref} className="w-full" />
      </aside>

      <div className="flex-1 min-w-0 pb-16 md:pb-0">
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
              <OrganiserSidebarNav organiser={mockOrganiser} profileHref={profileHref} />
            </SheetContent>
          </Sheet>
          <div className="w-9 h-9 md:hidden" aria-hidden="true" />

          <div className="flex items-center gap-1.5 font-display font-bold">
            Sessions
          </div>

          <div className="flex items-center gap-1">
            <Link href="/messages">
              <Button variant="ghost" size="icon" className="relative" data-testid="organiser-header-bell-mobile">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
              </Button>
            </Link>
            <Button size="icon" className="h-8 w-8" onClick={() => setLocation("/organiser/sessions/new")} data-testid="organiser-sessions-new-mobile">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Sessions</h1>
              <p className="text-muted-foreground mt-1">Manage all your tennis sessions in one place.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Button variant="outline" className="gap-2" data-testid="organiser-sessions-templates-button" onClick={() => toast({ title: "Templates isn't wired up yet" })}>
                <LayoutTemplate className="w-4 h-4" />
                Templates
              </Button>
              <NewSessionMenu className="gap-2" />
            </div>
          </div>

          {sessions.length === 0 ? (
            <SessionsEmptyState onCreateSession={() => setLocation("/organiser/sessions/new")} />
          ) : (
            <>
              <SessionStatusTabs value={activeBucket} onValueChange={setActiveBucket} counts={counts} />
              <SessionFiltersBar search={search} onSearchChange={setSearch} />

              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center" data-testid="organiser-sessions-bucket-empty">
                  No sessions here.
                </p>
              ) : (
                <div className="space-y-3" data-testid="organiser-sessions-list">
                  {visible.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <OrganiserMobileNav />
    </div>
  );
}
