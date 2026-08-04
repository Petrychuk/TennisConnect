import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, Plus, LayoutTemplate, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { SessionStatusTabs } from "@/components/organiser/sessions/session-status-tabs";
import { SessionFiltersBar } from "@/components/organiser/sessions/session-filters-bar";
import { SessionCard } from "@/components/organiser/sessions/session-card";
import { SessionsCalendarView } from "@/components/organiser/sessions/sessions-calendar-view";
import { SessionsEmptyState } from "@/components/organiser/sessions/sessions-empty-state";
import { NewSessionMenu } from "@/components/organiser/sessions/wizard/new-session-menu";
import { groupSessionsByBucket, type SessionBucket } from "@/components/organiser/sessions/session-utils";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { getMySessions, createSession, deleteSession } from "@/lib/api/organizer-sessions";
import { toSessionListItems } from "@/lib/api/session-adapter";
import { draftToInsertSession, createEmptyDraft } from "@/lib/organiser-session-wizard-types";
import type { SessionListItem } from "@/lib/organiser-sessions-mock-data";

export default function OrganiserSessionsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  // Real name/avatar from the authenticated user - role/organization
  // fields stay mock for now since there's no backend for those yet.
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null } : mockOrganiser;

  const sessionsQuery = useQuery({
    queryKey: ["/api/organizer/sessions/mine"],
    queryFn: getMySessions,
    enabled: isAuthenticated,
  });
  const sessions = useMemo(() => toSessionListItems(sessionsQuery.data ?? []), [sessionsQuery.data]);
  const [activeBucket, setActiveBucket] = useState<SessionBucket>("all");
  const [search, setSearch] = useState("");
  const [venue, setVenue] = useState("all");
  const [format, setFormat] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Real venues, derived from the organiser's own sessions - was
  // previously a hardcoded two-item list ("All Venues" / one fixed
  // venue) that predated there being more than one venue in the data
  // at all.
  const venueOptions = useMemo(() => {
    const names = Array.from(new Set(sessions.map((s) => s.location).filter((l): l is string => !!l)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59`).getTime() : null;
    return sessions.filter((s) => {
      if (query && !s.title.toLowerCase().includes(query)) return false;
      if (venue !== "all" && s.location !== venue) return false;
      if (format !== "all" && s.type !== format) return false;
      const startAt = new Date(s.startAt).getTime();
      if (from !== null && startAt < from) return false;
      if (to !== null && startAt > to) return false;
      return true;
    });
  }, [sessions, search, venue, format, dateFrom, dateTo]);

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

  const invalidateSessions = () => queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });

  const handleDuplicate = async (session: SessionListItem) => {
    try {
      // Same shape a "blank" wizard draft would build, seeded with this
      // session's own details - a real draft copy in the database, not
      // just a client-side clone.
      const draft = { ...createEmptyDraft(), name: `${session.title} (Copy)`, venue: session.location, maxPlayers: session.maxParticipants ?? 24 };
      await createSession(draftToInsertSession(draft) as any);
      invalidateSessions();
      toast({ title: "Session duplicated", description: `"${session.title}" was copied as a new draft.` });
    } catch (error: any) {
      toast({ title: "Couldn't duplicate session", description: error?.message ?? "Please try again.", variant: "destructive" });
    }
  };

  const handleDelete = async (session: SessionListItem) => {
    try {
      await deleteSession(session.id);
      invalidateSessions();
      toast({ title: "Draft deleted", description: `"${session.title}" was removed.` });
    } catch (error: any) {
      toast({ title: "Couldn't delete draft", description: error?.message ?? "Please try again.", variant: "destructive" });
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

      <aside className="hidden xl:flex xl:w-64 shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto">
        <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} className="w-full" />
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
              <OrganiserSidebarNav organiser={organiser} profileHref={profileHref} />
            </SheetContent>
          </Sheet>
          <div className="w-9 h-9 md:hidden" aria-hidden="true" />

          <div className="flex items-center gap-1.5 font-display font-bold">
            Sessions
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell testId="organiser-header-bell-mobile" />
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

          {sessionsQuery.isLoading ? (
            <div className="space-y-3" data-testid="organiser-sessions-loading">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : sessions.length === 0 ? (
            <SessionsEmptyState onCreateSession={() => setLocation("/organiser/sessions/new")} />
          ) : (
            <>
              <SessionStatusTabs value={activeBucket} onValueChange={setActiveBucket} counts={counts} />
              <SessionFiltersBar
                search={search}
                onSearchChange={setSearch}
                venue={venue}
                onVenueChange={setVenue}
                venueOptions={venueOptions}
                format={format}
                onFormatChange={setFormat}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                calendarOpen={calendarOpen}
                onCalendarOpenChange={setCalendarOpen}
              />

              {calendarOpen ? (
                <SessionsCalendarView sessions={visible} />
              ) : visible.length === 0 ? (
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
