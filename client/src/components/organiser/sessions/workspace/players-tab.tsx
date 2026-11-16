import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { PlayersStatStrip } from "./players/players-stat-strip";
import { PlayersToolbar } from "./players/players-toolbar";
import { PlayersTable } from "./players/players-table";
import { PlayersList } from "./players/players-list";
import { WaitingListCard } from "./players/waiting-list-card";
import { InvitePlayersCard } from "./players/invite-players-card";
import { CheckInSummaryCard } from "./players/checkin-summary-card";
import { PlayersQuickActionsCard } from "./players/players-quick-actions-card";
import { QuickMessageModal } from "@/components/messaging/QuickMessageModal";
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
import { InvitePlayersDialog } from "@/components/organiser/shared/invite-players-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { canChangeRoster, canInviteToSession } from "@shared/sessionActions";
import { waitlistPromotionOpen } from "@shared/sessionLifecycle";
import { getSessionRegistrations, inviteToSession, checkInRegistration, removeRegistration, moveRegistrationToWaitlist, lateRegisterPlayer } from "@/lib/api/organizer-sessions";
import { apiErrorInfo } from "@/lib/api-error";
import { toSessionPlayers } from "@/lib/api/session-adapter";
import { type SessionListItem, type SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface PlayersTabProps {
  session: SessionListItem;
  /** Switches the workspace to its Messages tab (not for divisions). */
  onOpenMessages?: () => void;
  onExport: () => void;
}

type Bucket = "registered" | "checked-in" | "waiting" | "cancelled" | "invited";

export function PlayersTab({ session, onOpenMessages, onExport }: PlayersTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>("registered");
  const [level, setLevel] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [checkingInAll, setCheckingInAll] = useState(false);

  const registrationsQuery = useQuery({
    queryKey: ["/api/organizer/sessions", session.id, "registrations"],
    queryFn: () => getSessionRegistrations(session.id),
  });

  // Real registrations only now - this used to pad the list with a
  // fixed mock "crowd" (8 fake players, always the same names/levels)
  // alongside whatever real registrations existed, which is exactly
  // why a session capped at 4 players showed "8 Registered".
  const allPlayers: SessionPlayer[] = useMemo(
    () => toSessionPlayers(registrationsQuery.data ?? []),
    [registrationsQuery.data]
  );

  const buckets: Record<Bucket, SessionPlayer[]> = useMemo(() => {
    const registered = allPlayers.filter((p) => p.status === "registered");
    return {
      registered,
      "checked-in": registered.filter((p) => p.checkedIn),
      waiting: allPlayers.filter((p) => p.status === "waiting"),
      cancelled: allPlayers.filter((p) => p.status === "cancelled"),
      invited: allPlayers.filter((p) => p.status === "invited"),
    };
  }, [allPlayers]);

  const query = search.trim().toLowerCase();
  const visible = buckets[bucket].filter(
    (p) => (!query || p.name.toLowerCase().includes(query)) && (level === "all" || p.levelLabel === level),
  );

  const checkInMutation = useMutation({
    mutationFn: (registrationId: string) => checkInRegistration(session.id, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "registrations"] });
    },
    onError: () => {
      toast({ title: "Couldn't check that player in", variant: "destructive" });
    },
  });

  const handleCheckIn = (player: SessionPlayer) => checkInMutation.mutate(player.id);

  const removeMutation = useMutation({
    mutationFn: (registrationId: string) => removeRegistration(session.id, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "registrations"] });
      toast({ title: "Player removed" });
    },
    onError: () => {
      toast({ title: "Couldn't remove that player", variant: "destructive" });
    },
  });
  // Removing a registration can't be undone from here, so it asks first.
  const [removeTarget, setRemoveTarget] = useState<SessionPlayer | null>(null);
  const handleRemove = (player: SessionPlayer) => setRemoveTarget(player);
  // The site's own message composer (POST /api/messages); was a
  // "Message - coming soon" toast.
  const [messageTarget, setMessageTarget] = useState<SessionPlayer | null>(null);
  const handleMessage = (player: SessionPlayer) => setMessageTarget(player);

  const moveToWaitingMutation = useMutation({
    mutationFn: (registrationId: string) => moveRegistrationToWaitlist(session.id, registrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "registrations"] });
      toast({ title: "Moved to the waiting list" });
    },
    onError: () => {
      toast({ title: "Couldn't move that player", variant: "destructive" });
    },
  });
  const handleMoveToWaiting = (player: SessionPlayer) => moveToWaitingMutation.mutate(player.id);

  const handleViewProfile = (player: SessionPlayer) => {
    if (!player.slug) return;
    window.open(`/${player.role === "coach" ? "coach" : "player"}/${player.slug}`, "_blank", "noopener,noreferrer");
  };

  const handleCheckInAll = async () => {
    const notYetCheckedIn = buckets.registered.filter((p) => !p.checkedIn);
    if (notYetCheckedIn.length === 0) return;
    setCheckingInAll(true);
    try {
      // TC-215 / OH-AUDIT-014: use allSettled so one failure doesn't mask the
      // rest. Always invalidate afterward (some may have succeeded).
      const results = await Promise.allSettled(
        notYetCheckedIn.map((p) => checkInRegistration(session.id, p.id))
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === 0) {
        toast({ title: `All ${notYetCheckedIn.length} players checked in` });
      } else if (failed.length === notYetCheckedIn.length) {
        toast({ title: "Check-in failed — please try again", variant: "destructive" });
      } else {
        const ok = notYetCheckedIn.length - failed.length;
        toast({
          title: `${ok} of ${notYetCheckedIn.length} players checked in`,
          description: `${failed.length} failed — you can retry with the Check-in All button`,
          variant: "destructive",
        });
      }
    } finally {
      // Always refresh: even a partial batch changed the roster.
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "registrations"] });
      setCheckingInAll(false);
    }
  };
  // After Finish the roster is a record (shared/sessionActions.ts
  // canChangeRoster): no check-in, remove or move to the waiting list - the
  // server refuses them too. Undefined hides each control.
  const rosterOpen = canChangeRoster(session.status);
  const rowHandlers = {
    onCheckIn: rosterOpen ? handleCheckIn : undefined,
    onRemove: rosterOpen ? handleRemove : undefined,
    onMessage: handleMessage,
    onMoveToWaiting: rosterOpen ? handleMoveToWaiting : undefined,
    onViewProfile: handleViewProfile,
  };
  const checkInAll = rosterOpen ? handleCheckInAll : undefined;
  // Disabled while the list loads: pressed before it, Check-in All saw nobody
  // to check in and did nothing at all (ORG-WSP-003).
  const checkInAllBusy = checkingInAll || registrationsQuery.isLoading;
  // TC-213: until the registration cutoff free places go to the waiting list
  // automatically. After it the organiser adds players themselves - "Move to
  // Registered" on the waiting list, or the Add dialog - and skipping the
  // waiting list needs an explicit, audited confirmation (server-enforced).
  const lateAddOpen =
    rosterOpen &&
    (session.status === "published" || session.status === "live") &&
    !waitlistPromotionOpen({ status: session.status, startAt: session.startAt, registrationClosesAt: session.registrationClosesAt ?? null });
  const [overrideTarget, setOverrideTarget] = useState<{ userId: string; name: string; ahead: number; nextName: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  /** true = added; false = handed to the override confirmation. Throws with the server's message otherwise. */
  const lateAdd = async (userId: string, name: string, override?: { reason: string }): Promise<boolean> => {
    try {
      await lateRegisterPlayer(session.id, { userId, ...(override ? { overrideWaitlist: true, reason: override.reason } : {}) });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "registrations"] });
      toast({ title: `${name} added to the session`, description: "They've been sent a message." });
      return true;
    } catch (error) {
      const info = apiErrorInfo(error);
      if (info.code === "waitlist_override_required" && !override) {
        const next = buckets.waiting.find((p) => p.userId === info.body?.nextUserId);
        setOverrideReason("");
        setOverrideTarget({ userId, name, ahead: Number(info.body?.ahead ?? 1), nextName: next?.name ?? "the next player" });
        return false;
      }
      throw new Error(info.message);
    }
  };

  const handleMoveToRegistered = async (player: { id: string; name: string; userId?: string }) => {
    if (!player.userId) return;
    setMovingId(player.id);
    try {
      await lateAdd(player.userId, player.name);
    } catch (error: any) {
      toast({ title: `Couldn't add ${player.name}`, description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setMovingId(null);
    }
  };
  const moveToRegistered = lateAddOpen ? handleMoveToRegistered : undefined;

  const confirmOverride = async () => {
    if (!overrideTarget || !overrideReason.trim()) return;
    setOverrideBusy(true);
    try {
      await lateAdd(overrideTarget.userId, overrideTarget.name, { reason: overrideReason.trim() });
      setOverrideTarget(null);
    } catch (error: any) {
      toast({ title: `Couldn't add ${overrideTarget.name}`, description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setOverrideBusy(false);
    }
  };

  // Undefined hides the toolbar's Invite button (shared/sessionActions.ts).
  // After the cutoff the same button adds players instead of inviting them.
  const handleInvitePlayers = lateAddOpen || canInviteToSession(session.status, session.endAt) ? () => setInviteOpen(true) : undefined;

  const bucketTabs: { key: Bucket; label: string }[] = [
    { key: "registered", label: "Registered" },
    { key: "checked-in", label: "Checked In" },
    { key: "waiting", label: "Waiting List" },
    { key: "cancelled", label: "Cancelled" },
    { key: "invited", label: "Invited" },
  ];

  const bucketTabsList = (
    <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
      <TabsList className="justify-start overflow-x-auto max-w-full whitespace-nowrap h-auto p-1 scrollbar-hide" data-testid="organiser-players-bucket-tabs">
        {bucketTabs.map((b) => (
          <TabsTrigger key={b.key} value={b.key} className="gap-1" data-testid={`organiser-players-bucket-tab-${b.key}`}>
            {b.label}
            <span className="text-[11px] text-muted-foreground">({buckets[b.key].length})</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  const paginationText = (
    <p className="text-sm text-muted-foreground" data-testid="organiser-players-pagination">
      Show 1 to {visible.length} of {visible.length} players
    </p>
  );

  return (
    <div data-testid="organiser-session-players-tab" data-roster={rosterOpen ? "open" : "final"}>
      {!rosterOpen && (
        <p className="mb-4 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground" data-testid="organiser-players-final-note">
          This session is {session.status}. The player list is final - nobody can be checked in, removed or moved now.
        </p>
      )}
      {/* Desktop (xl+) */}
      <div className="hidden xl:block space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar
          search={search}
          onSearchChange={setSearch}
          onCheckInAll={checkInAll}
          checkInAllLoading={checkInAllBusy}
          onInvitePlayers={handleInvitePlayers}
          level={level}
          onLevelChange={setLevel}
        />
        <PlayersTable players={visible} {...rowHandlers} timeZone={session.timeZone} />
        {paginationText}
        <div className="grid grid-cols-2 gap-6">
          <WaitingListCard players={buckets.waiting} timeZone={session.timeZone} onMoveToRegistered={moveToRegistered} movingId={movingId} />
          <InvitePlayersCard session={session} />
        </div>
      </div>

      {/* Tablet (md-xl) */}
      <div className="hidden md:block xl:hidden space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={checkInAll} checkInAllLoading={checkInAllBusy} onInvitePlayers={handleInvitePlayers} level={level} onLevelChange={setLevel} />
        <PlayersList players={visible} {...rowHandlers} timeZone={session.timeZone} />
        {paginationText}
        <WaitingListCard players={buckets.waiting} timeZone={session.timeZone} onMoveToRegistered={moveToRegistered} movingId={movingId} />
        <CheckInSummaryCard players={allPlayers} />
        <PlayersQuickActionsCard onMessageAll={onOpenMessages} onExport={onExport} onShowWaitingList={() => setBucket("waiting")} />
      </div>

      {/* Mobile (<md) */}
      <div className="md:hidden space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={checkInAll} checkInAllLoading={checkInAllBusy} onInvitePlayers={handleInvitePlayers} level={level} onLevelChange={setLevel} />
        <PlayersList players={visible} {...rowHandlers} timeZone={session.timeZone} />
        {paginationText}
        <WaitingListCard players={buckets.waiting} timeZone={session.timeZone} onMoveToRegistered={moveToRegistered} movingId={movingId} />
        <PlayersQuickActionsCard onMessageAll={onOpenMessages} onExport={onExport} onShowWaitingList={() => setBucket("waiting")} />
      </div>

      {messageTarget?.userId && (
        <QuickMessageModal
          open
          onOpenChange={(open) => !open && setMessageTarget(null)}
          recipient={{ id: messageTarget.userId, name: messageTarget.name, type: messageTarget.role === "coach" ? "coach" : "player" }}
          title={`Message ${messageTarget.name}`}
          description={`About "${session.title}". They'll get it in their TennisConnect inbox.`}
        />
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent data-testid="organiser-players-remove-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name} from this session?</AlertDialogTitle>
            <AlertDialogDescription>
              Their registration is cancelled. Until registration closes, the first player on the waiting
              list takes the place automatically and is told. After that the place stays free - you can add
              a player yourself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) removeMutation.mutate(removeTarget.id);
                setRemoveTarget(null);
              }}
              data-testid="organiser-players-remove-confirm"
            >
              Remove Player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lateAddOpen ? (
        <InvitePlayersDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title={`Add a Player to ${session.title}`}
          description="Registration has closed. A player you add gets a place straight away if there's room. The waiting list comes first unless you confirm skipping it."
          onInvite={async (userId, name) => ((await lateAdd(userId, name)) ? undefined : false)}
          searchContext={{ sessionId: session.id }}
          alreadyConnectedLabel="Already in this session"
          actionLabel="Add"
          pendingLabel="Adding..."
          doneLabel="Added"
        />
      ) : (
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
      )}

      <AlertDialog open={!!overrideTarget} onOpenChange={(open) => !open && !overrideBusy && setOverrideTarget(null)}>
        <AlertDialogContent data-testid="organiser-players-override-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Skip the waiting list for {overrideTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {overrideTarget?.ahead === 1
                ? `${overrideTarget?.nextName} is waiting ahead of them.`
                : `${overrideTarget?.ahead} players are waiting ahead of them, starting with ${overrideTarget?.nextName}.`}{" "}
              They keep their places on the waiting list. This is recorded with your name, the time and your reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="organiser-players-override-reason">Reason</Label>
            <Textarea
              id="organiser-players-override-reason"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Partner of a player who withdrew at the last minute"
              className="min-h-20"
              data-testid="organiser-players-override-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={overrideBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={overrideBusy || !overrideReason.trim()}
              onClick={(e) => {
                e.preventDefault();
                void confirmOverride();
              }}
              data-testid="organiser-players-override-confirm"
            >
              Add {overrideTarget?.name}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
