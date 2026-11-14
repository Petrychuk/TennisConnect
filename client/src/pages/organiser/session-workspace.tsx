import { useEffect, useState } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Send,
  UserPlus,
  Megaphone,
  ListPlus,
  Download,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { canAnnounceToSession, canArchiveSession, canInviteToSession } from "@shared/sessionActions";
import { publishSession, archiveSession, cancelSession, inviteToSession, broadcastToSession, getSessionRegistrations, createSessionDivision } from "@/lib/api/organizer-sessions";
import { InvitePlayersDialog } from "@/components/organiser/shared/invite-players-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { OrganiserAccessGate, OrganiserLayout } from "@/components/organiser/ui/organiser-layout";
import { useLiveAvailable } from "@/lib/use-live-available";
import { sessionCategoryOf } from "@shared/sessionCategories";
import { csvFileName, downloadCsv, playersCsv } from "@/lib/organiser-export";

import { OverviewTab } from "@/components/organiser/sessions/workspace/overview-tab";
import { PlayersTab } from "@/components/organiser/sessions/workspace/players-tab";
import { FormatRulesTab } from "@/components/organiser/sessions/workspace/format-rules-tab";
import { RoundsTab } from "@/components/organiser/sessions/workspace/rounds-tab";
import { MessagesTab } from "@/components/organiser/sessions/workspace/messages-tab";
import { ResultsTab } from "@/components/organiser/sessions/workspace/results-tab";
import { SettingsTab } from "@/components/organiser/sessions/workspace/settings-tab";
import { bucketFor, canEditSession, sessionEditPath, sessionStatusLabel } from "@/components/organiser/sessions/session-utils";
import { isReadyToStart } from "@shared/sessionLifecycle";
import { friendlyApiError } from "@/lib/apiError";

import { useQuery } from "@tanstack/react-query";
import { getSessionById } from "@/lib/api/organizer-sessions";
import { toSessionListItem } from "@/lib/api/session-adapter";
import { TennisBallSpinner } from "@/components/ui/tennisLoader";
import { formatInTimeZone } from "@/lib/timezone";

const WORKSPACE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "players", label: "Players" },
  { key: "format", label: "Format & Rules" },
  { key: "rounds", label: "Rounds" },
  { key: "messages", label: "Messages" },
  // "Photos" hidden (Phase 2): its only control was a disabled "Upload
  // Photos" button - there's no photo upload for sessions yet.
  { key: "results", label: "Results" },
  { key: "settings", label: "Settings" },
] as const;

type WorkspaceTabKey = (typeof WORKSPACE_TABS)[number]["key"];

export default function OrganiserSessionWorkspacePage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/organiser/sessions/:id");
  const sessionQuery = useQuery({
    queryKey: ["/api/organizer/sessions", params?.id],
    queryFn: () => getSessionById(params!.id),
    enabled: !!params?.id,
  });
  const liveAvailable = useLiveAvailable(sessionQuery.data);
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
      downloadCsv(csvFileName(session.title), playersCsv(registrations, session.timeZone));
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

  const handleDuplicate = () => {
    if (!session) return;
    if (isDivision && session.parentSessionId) {
      setDuplicating(true);
      createSessionDivision(session.parentSessionId, {
        title: `${session.title} (copy)`,
        cloneFromDivisionId: session.id,
      })
        .then((copy) => {
          queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.parentSessionId, "divisions"] });
          toast({ title: "Division duplicated", description: "Saved as a new draft division." });
          setLocation(`/organiser/sessions/${copy.id}`);
        })
        .catch((error: any) => {
          toast({ title: "Couldn't duplicate", description: error?.message ?? "Please try again.", variant: "destructive" });
        })
        .finally(() => setDuplicating(false));
      return;
    }
    // Goes through the real wizard (pre-filled) instead of silently
    // POSTing a near-copy directly - see session-new.tsx's own comment
    // on the duplicateFrom param for why: values actually carry over
    // now, and it gets a real review + publish step instead of being
    // left stuck in "draft" status forever (which is exactly what this
    // page's old version did - createSession with no matching
    // publishSession call).
    setLocation(`/organiser/sessions/new?duplicateFrom=${session.id}`);
  };

  const handleShare = () => {
    if (!session) return;
    // The session's own public page (/play/:id). It used to copy
    // "/player/<organisation slug>", which isn't a page at all.
    // Same rule as GET /api/play/sessions/:id: published or live, and public.
    if (!["published", "live"].includes(session.status)) {
      toast({ title: "No public link right now", description: "A session has a public page while it's published or live." });
      return;
    }
    if (sessionQuery.data?.visibility && sessionQuery.data.visibility !== "public") {
      toast({ title: "This session isn't public", description: "Only public sessions have a shareable page. Use Invite Players instead." });
      return;
    }
    const url = `${window.location.origin}/play/${session.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast({ title: "Link copied", description: "Anyone with the link can see the session and register." }))
      .catch(() => toast({ title: "Couldn't copy the link", description: url, variant: "destructive" }));
  };

  // Cancelling tells every registered player (server: notifyActiveRegistrants),
  // so it asks first. Only before the session has finished.
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const handleCancel = async () => {
    if (!session || cancelling) return;
    setCancelling(true);
    try {
      await cancelSession(session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions/mine"] });
      toast({ title: "Session cancelled", description: "Everyone registered has been sent a cancellation message." });
    } catch (error: any) {
      toast({ title: "Couldn't cancel", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setCancelling(false);
      setConfirmCancelOpen(false);
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
      toast({ title: "Couldn't publish", description: friendlyApiError(error), variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };
  const [tab, setTab] = useState<WorkspaceTabKey>("overview");
  const session = sessionQuery.data ? toSessionListItem(sessionQuery.data) : undefined;
  // A division's workspace is deliberately stripped down - format/rules
  // and messaging both live at the container level, not per-division.
  const isDivision = !!session?.parentSessionId;
  // Coaching & Fitness sessions have no rounds or scores
  // (shared/sessionCategories.ts), so no Rounds / Results tabs and no Live.
  const usesLiveRounds = sessionCategoryOf(session?.type).usesLiveRounds;
  const visibleTabs = WORKSPACE_TABS.filter(
    (t) =>
      !(isDivision && (t.key === "format" || t.key === "messages")) &&
      !(!usesLiveRounds && (t.key === "rounds" || t.key === "results")),
  );

  useEffect(() => {
    const requested = new URLSearchParams(search).get("tab");
    if (requested && visibleTabs.some((t) => t.key === requested)) {
      setTab(requested as WorkspaceTabKey);
    }
  }, [search]);

  // Clicking a tab only ever updated the in-memory `tab` state - the
  // URL's own ?tab= param never followed along, so it stayed stuck at
  // whatever it was when the page first loaded (e.g. "settings" if
  // Edit was how you got here) no matter which tab you actually
  // switched to afterward. replaceState (not setLocation/pushState) so
  // switching tabs doesn't pile up separate Back-button history entries
  // for every tab visited.
  const handleTabChange = (v: string) => {
    setTab(v as WorkspaceTabKey);
    if (params?.id) {
      window.history.replaceState(null, "", `/organiser/sessions/${params.id}?tab=${v}`);
    }
  };

  if (sessionQuery.isLoading || !isAuthenticated) {
    return (
      <OrganiserAccessGate>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <TennisBallSpinner />
        </div>
      </OrganiserAccessGate>
    );
  }


  if (!session) {
    return (
      <OrganiserAccessGate>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background gap-4" data-testid="organiser-session-not-found">
          <p className="text-muted-foreground">Session not found.</p>
          <Button asChild variant="outline">
            <Link href="/organiser/sessions">Back to Sessions</Link>
          </Button>
        </div>
      </OrganiserAccessGate>
    );
  }

  const bucket = bucketFor(session);

  const goEdit = () => setLocation(sessionEditPath(session));
  const goLive = () => setLocation(`/organiser/sessions/${session.id}/live`);

  // Same state -> action mapping as the Sessions list card, so a session
  // never presents different actions depending on where you opened it from.
  // Without TC Live (Production) the session is run from the Players tab
  // (check-in) instead of a "coming soon" page.
  const goPlayers = () => handleTabChange("players");
  const primaryAction =
    bucket === "draft"
      ? { label: "Continue Setup", onClick: goEdit, icon: undefined }
      : (bucket === "completed" || bucket === "archived") && usesLiveRounds
      ? { label: "View Results", onClick: () => handleTabChange("results"), icon: undefined }
      : bucket === "completed" || bucket === "archived"
      ? { label: "View Players", onClick: goPlayers, icon: undefined }
      : liveAvailable && usesLiveRounds && bucket !== "live" && isReadyToStart(session)
      ? { label: "Start Live", onClick: goLive, icon: Play } // Ready to Start: the organiser starts it
      : liveAvailable && usesLiveRounds
      ? { label: "Enter Live Session", onClick: goLive, icon: Play } // live, registration-open, upcoming
      : { label: "Manage Players", onClick: goPlayers, icon: undefined };

  return (
    <OrganiserLayout
      testId="organiser-session-workspace"
      seoTitle={`${session.title} | Organiser Hub | TennisConnect`}
      seoDescription={`Manage ${session.title} — registration, players, rounds, and results.`}
      mobileTitle="Session Details"
    >

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 md:space-y-4 max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm flex-wrap" data-testid="organiser-session-breadcrumb">
            <Link href="/organiser/sessions" className="text-primary-text hover:underline">
              Sessions
            </Link>
            {parentSessionQuery.data && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <Link
                  href={`/organiser/sessions/${parentSessionQuery.data.id}`}
                  className="text-primary-text hover:underline truncate max-w-[200px]"
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
                <Badge className={bucket === "live" ? "bg-primary text-foreground" : "bg-primary/10 text-primary-text"} data-testid="organiser-session-status-badge">
                  {sessionStatusLabel(session, bucket).toUpperCase()}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatInTimeZone(session.startAt, session.timeZone, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {formatInTimeZone(session.startAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}
                  {session.endAt && ` - ${formatInTimeZone(session.endAt, session.timeZone, { hour: "numeric", minute: "2-digit" })}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {session.location}
                </span>
              </div>
            </div>

            {/* Actions: the More menu is available at every width (tablet and
                phone used to get only a sheet of "isn't wired up yet" toasts). */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                className="hidden xl:inline-flex"
                onClick={handleShare}
                data-testid="organiser-session-share-button"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More session actions" data-testid="organiser-session-more-button">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {session.status === "draft" && (
                    <DropdownMenuItem onClick={handlePublish} disabled={publishing} data-testid="organiser-session-more-publish">
                      <Send className="w-4 h-4 mr-2" />
                      {publishing ? "Publishing..." : "Publish Session"}
                    </DropdownMenuItem>
                  )}
                  {canEditSession(session) && (
                    <DropdownMenuItem onClick={goEdit} data-testid="organiser-session-more-edit">
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Session
                    </DropdownMenuItem>
                  )}
                  {canInviteToSession(session.status, session.endAt) && (
                    <DropdownMenuItem onClick={() => setInviteOpen(true)} data-testid="organiser-session-more-invite">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite Players
                    </DropdownMenuItem>
                  )}
                  {canAnnounceToSession(session.status) && (
                    <DropdownMenuItem onClick={() => setAnnounceOpen(true)} data-testid="organiser-session-more-announce">
                      <Megaphone className="w-4 h-4 mr-2" />
                      Send Announcement
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleTabChange("players")} data-testid="organiser-session-more-waitlist">
                    <ListPlus className="w-4 h-4 mr-2" />
                    Manage Waitlist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShare} data-testid="organiser-session-more-share">
                    <Share2 className="w-4 h-4 mr-2" />
                    Copy Share Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPlayers} data-testid="organiser-session-more-export">
                    <Download className="w-4 h-4 mr-2" />
                    Export Player List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating} data-testid="organiser-session-more-duplicate">
                    <Copy className="w-4 h-4 mr-2" />
                    {duplicating ? "Duplicating..." : "Duplicate"}
                  </DropdownMenuItem>
                  {["published", "pending_review"].includes(session.status) && (
                    <DropdownMenuItem onClick={() => setConfirmCancelOpen(true)} className="text-destructive" data-testid="organiser-session-more-cancel">
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Session
                    </DropdownMenuItem>
                  )}
                  {/* Not while live: End Session closes the scores first. */}
                  {canArchiveSession(session.status) && (
                    <DropdownMenuItem onClick={() => setConfirmArchiveOpen(true)} disabled={archiving} data-testid="organiser-session-more-archive">
                      <Archive className="w-4 h-4 mr-2" />
                      {archiving ? "Archiving..." : "Archive"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={primaryAction.onClick} className="hidden xl:inline-flex" data-testid="organiser-session-primary-action">
                {primaryAction.icon && <primaryAction.icon className="w-4 h-4 mr-2" />}
                {primaryAction.label}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={handleTabChange}>
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
              <OverviewTab
                session={session}
                onEdit={canEditSession(session) ? goEdit : undefined}
                onInvite={canInviteToSession(session.status, session.endAt) ? () => setInviteOpen(true) : undefined}
                isDivision={isDivision}
              />
            </TabsContent>
            <TabsContent value="players" className="mt-4">
              <PlayersTab session={session} onOpenMessages={isDivision ? undefined : () => handleTabChange("messages")} onExport={handleExportPlayers} />
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
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent data-testid="organiser-session-cancel-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              "{session.title}" will be cancelled and taken off Play. Everyone registered ({session.registeredCount}) gets a
              cancellation message. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="organiser-session-cancel-keep">Keep Session</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling} data-testid="organiser-session-cancel-confirm">
              {cancelling ? "Cancelling..." : "Cancel Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
        <AlertDialogContent data-testid="organiser-session-archive-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this session?</AlertDialogTitle>
            <AlertDialogDescription>
              It moves to the Archived tab on your Sessions list. Players and results are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmArchiveOpen(false);
                handleArchive();
              }}
              data-testid="organiser-session-archive-confirm"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OrganiserLayout>
  );
}
