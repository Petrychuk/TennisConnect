import { useEffect, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Menu,
  ChevronRight,
  Share2,
  MoreHorizontal,
  Play,
  Pencil,
  Copy,
  Archive,
  Calendar,
  MapPin,
  Loader2,
  Send,
  UserPlus,
  Megaphone,
  ListPlus,
  Download,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { publishSession, archiveSession, inviteToSession, broadcastToSession, getSessionRegistrations, createSessionDivision, createSession } from "@/lib/api/organizer-sessions";
import { createEmptyDraft, draftToInsertSession } from "@/lib/organiser-session-wizard-types";
import { InvitePlayersDialog } from "@/components/organiser/shared/invite-players-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { NotificationBell } from "@/components/organiser/ui/notification-bell";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { OverviewTab } from "@/components/organiser/sessions/workspace/overview-tab";
import { PlayersTab } from "@/components/organiser/sessions/workspace/players-tab";
import { RegistrationTab } from "@/components/organiser/sessions/workspace/registration-tab";
import { FormatRulesTab } from "@/components/organiser/sessions/workspace/format-rules-tab";
import { RoundsTab } from "@/components/organiser/sessions/workspace/rounds-tab";
import { MessagesTab } from "@/components/organiser/sessions/workspace/messages-tab";
import { PhotosTab } from "@/components/organiser/sessions/workspace/photos-tab";
import { ResultsTab } from "@/components/organiser/sessions/workspace/results-tab";
import { SettingsTab } from "@/components/organiser/sessions/workspace/settings-tab";
import { bucketFor } from "@/components/organiser/sessions/session-utils";

import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import { useQuery } from "@tanstack/react-query";
import { getSessionById } from "@/lib/api/organizer-sessions";
import { toSessionListItem } from "@/lib/api/session-adapter";

const WORKSPACE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "players", label: "Players" },
  { key: "registration", label: "Registration" },
  { key: "format", label: "Format & Rules" },
  { key: "rounds", label: "Rounds" },
  { key: "messages", label: "Messages" },
  { key: "photos", label: "Photos" },
  { key: "results", label: "Results" },
  { key: "settings", label: "Settings" },
] as const;

type WorkspaceTabKey = (typeof WORKSPACE_TABS)[number]["key"];

const BUCKET_BADGE_LABEL: Record<string, string> = {
  live: "LIVE",
  "registration-open": "REGISTRATION OPEN",
  upcoming: "UPCOMING",
  draft: "DRAFT",
  completed: "COMPLETED",
  archived: "ARCHIVED",
};

export default function OrganiserSessionWorkspacePage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id");
  const sessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", params?.id],
    queryFn: () => getSessionById(params!.id),
    enabled: !!params?.id,
  });
  // Only fetched when this session is actually a division - powers the
  // "Sessions > Parent Event > This Division" breadcrumb so it's quick
  // to get back to the container from inside one of its divisions.
  const parentSessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", sessionQuery.data?.parentSessionId],
    queryFn: () => getSessionById(sessionQuery.data!.parentSessionId!),
    enabled: !!sessionQuery.data?.parentSessionId,
  });
  const search = useSearch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  const handleExportPlayers = async () => {
    if (!session) return;
    try {
      const registrations = await getSessionRegistrations(session.id);
      const header = "Name,Profile,Status,Registered At\n";
      const rows = registrations
        .map((r) => [r.userName, r.userSlug, r.status, new Date(r.createdAt).toLocaleString()].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-players.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Couldn't export player list", description: error?.message ?? "Please try again.", variant: "destructive" });
    }
  };

  const handleSendAnnouncement = async () => {
    if (!session || !announceMessage.trim() || sendingAnnouncement) return;
    setSendingAnnouncement(true);
    try {
      const result = await broadcastToSession(session.id, announceMessage.trim());
      toast({ title: "Announcement sent", description: `Delivered to ${result.sentTo} registered player${result.sentTo === 1 ? "" : "s"}.` });
      setAnnounceMessage("");
      setAnnounceOpen(false);
    } catch (error: any) {
      toast({ title: "Couldn't send announcement", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleArchive = async () => {
    if (!session || archiving) return;
    setArchiving(true);
    try {
      await archiveSession(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      toast({ title: "Archived", description: "Moved to the Archived tab on your Sessions list." });
    } catch (error: any) {
      toast({ title: "Couldn't archive", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!session || duplicating) return;
    setDuplicating(true);
    try {
      if (isDivision && session.parentSessionId) {
        const copy = await createSessionDivision(session.parentSessionId, {
          title: `${session.title} (copy)`,
          cloneFromDivisionId: session.id,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.parentSessionId, "divisions"] });
        toast({ title: "Division duplicated", description: "Saved as a new draft division." });
        setLocation(`/organiser/sessions/${copy.id}`);
      } else {
        // Same shape a "blank" wizard draft would build, seeded with
        // this session's own details - same pattern the Sessions list's
        // own Duplicate already uses, a real draft copy in the
        // database, not just a client-side clone.
        const draft = { ...createEmptyDraft(), name: `${session.title} (Copy)`, venue: session.location, maxPlayers: session.maxParticipants ?? 24 };
        const copy = await createSession(draftToInsertSession(draft) as any);
        queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
        toast({ title: "Session duplicated", description: "Saved as a new draft." });
        setLocation(`/organiser/sessions/${copy.id}`);
      }
    } catch (error: any) {
      toast({ title: "Couldn't duplicate", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setDuplicating(false);
    }
  };

  const handlePublish = async () => {
    if (!session || publishing) return;
    setPublishing(true);
    try {
      const updated = await publishSession(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      if (session.parentSessionId) {
        queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.parentSessionId, "divisions"] });
      }
      toast(
        updated.status === "published"
          ? { title: "Published", description: "It's live now - players can register." }
          : { title: "Sent for review", description: "It'll go live once an admin approves it." }
      );
    } catch (error: any) {
      toast({ title: "Couldn't publish", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";
  // Real name/avatar from the authenticated user - role/organization
  // fields stay mock for now since there's no backend for those yet.
  const organiser = user ? { ...mockOrganiser, name: user.name, avatar: user.avatar ?? null } : mockOrganiser;
  const [tab, setTab] = useState<WorkspaceTabKey>("overview");
  const session = sessionQuery.data ? toSessionListItem(sessionQuery.data) : undefined;
  // A division's workspace is deliberately stripped down - format/rules
  // and messaging both live at the container level, not per-division.
  const isDivision = !!session?.parentSessionId;
  const visibleTabs = isDivision ? WORKSPACE_TABS.filter((t) => t.key !== "format" && t.key !== "messages") : WORKSPACE_TABS;

  useEffect(() => {
    const requested = new URLSearchParams(search).get("tab");
    if (requested && visibleTabs.some((t) => t.key === requested)) {
      setTab(requested as WorkspaceTabKey);
    }
  }, [search]);

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

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4">
        <p className="text-muted-foreground">Session not found.</p>
        <Button asChild variant="outline">
          <Link href="/organiser/sessions">Back to Sessions</Link>
        </Button>
      </div>
    );
  }

  const bucket = bucketFor(session);

  const goEdit = () => setLocation(`/organiser/sessions/${session.id}/edit`);
  const goLive = () => setLocation(`/organiser/sessions/${session.id}/live`);

  // Same state -> action mapping as the Sessions list card, so a session
  // never presents different actions depending on where you opened it from.
  const primaryAction =
    bucket === "draft"
      ? { label: "Continue Setup", onClick: goEdit, icon: undefined }
      : bucket === "live"
      ? { label: "Enter Live Session", onClick: goLive, icon: Play }
      : bucket === "completed"
      ? { label: "View Results", onClick: () => setTab("results"), icon: undefined }
      : bucket === "archived"
      ? { label: "View History", onClick: () => setTab("results"), icon: undefined }
      : { label: "Enter Live Session", onClick: goLive, icon: Play }; // registration-open / upcoming — session hasn't started, button still points at Live for when it does

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-session-workspace">
      <SEO
        title={`${session.title} | Organiser Hub | TennisConnect`}
        description={`Manage ${session.title} — registration, players, rounds, and results.`}
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

          <div className="font-display font-bold">Session Details</div>

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

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 md:space-y-4 max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm flex-wrap" data-testid="organiser-session-breadcrumb">
            <Link href="/organiser/sessions" className="text-primary hover:underline">
              Sessions
            </Link>
            {parentSessionQuery.data && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <Link
                  href={`/organiser/sessions/${parentSessionQuery.data.id}`}
                  className="text-primary hover:underline truncate max-w-[200px]"
                  data-testid="organiser-session-breadcrumb-parent"
                >
                  {parentSessionQuery.data.title}
                </Link>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground truncate">{session.title}</span>
          </div>

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-bold">{session.title}</h1>
                <Badge className={bucket === "live" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}>
                  {BUCKET_BADGE_LABEL[bucket]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(session.startAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {new Date(session.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {session.endAt && ` - ${new Date(session.endAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {session.location}
                </span>
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  if (!session.organizationSlug) {
                    toast({ title: "Publish this session first", description: "It needs to be public before there's a link to share." });
                    return;
                  }
                  const url = `${window.location.origin}/player/${session.organizationSlug}`;
                  navigator.clipboard
                    .writeText(url)
                    .then(() => toast({ title: "Link copied", description: "Players can find this on the organiser's Organising tab." }))
                    .catch(() => toast({ title: "Couldn't copy the link", description: url, variant: "destructive" }));
                }}
                data-testid="organiser-session-share-button"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="organiser-session-more-button">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {session.status === "draft" && (
                    <DropdownMenuItem onClick={handlePublish} disabled={publishing}>
                      <Send className="w-4 h-4 mr-2" />
                      {publishing ? "Publishing..." : "Publish Session"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={goEdit}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Session
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Players
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAnnounceOpen(true)}>
                    <Megaphone className="w-4 h-4 mr-2" />
                    Send Announcement
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation(`/organiser/sessions/${session.id}?tab=registration`)}>
                    <ListPlus className="w-4 h-4 mr-2" />
                    Manage Waitlist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPlayers}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Player List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
                    <Copy className="w-4 h-4 mr-2" />
                    {duplicating ? "Duplicating..." : "Duplicate"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleArchive} disabled={archiving}>
                    <Archive className="w-4 h-4 mr-2" />
                    {archiving ? "Archiving..." : "Archive"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={primaryAction.onClick} data-testid="organiser-session-primary-action">
                {primaryAction.icon && <primaryAction.icon className="w-4 h-4 mr-2" />}
                {primaryAction.label}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as WorkspaceTabKey)}>
            <TabsList className="justify-start overflow-x-auto max-w-full whitespace-nowrap h-auto p-1 scrollbar-hide" data-testid="organiser-session-workspace-tabs">
              {visibleTabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1" data-testid={`organiser-session-workspace-tab-${t.key}`}>
                  {t.label}
                  {t.key === "players" && (
                    <span className="text-[11px] text-muted-foreground">({session.registeredCount})</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <OverviewTab session={session} onEdit={goEdit} isDivision={isDivision} />
            </TabsContent>
            <TabsContent value="players" className="mt-4">
              <PlayersTab session={session} onEdit={goEdit} />
            </TabsContent>
            <TabsContent value="registration" className="mt-4">
              <RegistrationTab session={session} onEnterLive={goLive} />
            </TabsContent>
            <TabsContent value="format" className="mt-4">
              <FormatRulesTab session={session} />
            </TabsContent>
            <TabsContent value="rounds" className="mt-4">
              <RoundsTab session={session} />
            </TabsContent>
            <TabsContent value="messages" className="mt-4">
              <MessagesTab session={session} />
            </TabsContent>
            <TabsContent value="photos" className="mt-4">
              <PhotosTab />
            </TabsContent>
            <TabsContent value="results" className="mt-4">
              <ResultsTab session={session} />
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <SettingsTab session={session} />
            </TabsContent>
          </Tabs>

          {/* Tablet/mobile — the primary action lives at the bottom instead
              of the header (Share/More are desktop-only), matching the mockup. */}
          <div className="xl:hidden">
            <Button onClick={primaryAction.onClick} className="w-full" size="lg" data-testid="organiser-session-primary-action-mobile">
              {primaryAction.icon && <primaryAction.icon className="w-4 h-4 mr-2" />}
              {primaryAction.label}
            </Button>
          </div>
        </div>
      </div>

      <OrganiserMobileNav />

      <InvitePlayersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={`Invite Players to ${session.title}`}
        description="Search for players on TennisConnect and invite them to this session."
        onInvite={async (userId) => {
          await inviteToSession(session.id, userId);
          queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "registrations"] });
        }}
        searchContext={{ sessionId: session.id }}
        alreadyConnectedLabel="Already joined"
      />

      <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
        <DialogContent data-testid="organiser-session-announcement-dialog">
          <DialogHeader>
            <DialogTitle>Send Announcement</DialogTitle>
            <DialogDescription>Goes straight to every registered player's inbox for {session.title}.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={announceMessage}
            onChange={(e) => setAnnounceMessage(e.target.value)}
            placeholder="Post an update to everyone registered for this session..."
            className="min-h-28"
            data-testid="organiser-session-announcement-input"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnounceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendAnnouncement} disabled={!announceMessage.trim() || sendingAnnouncement} data-testid="organiser-session-announcement-send">
              {sendingAnnouncement ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
