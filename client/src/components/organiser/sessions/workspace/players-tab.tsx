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
import { canChangeRoster, canInviteToSession } from "@shared/sessionActions";
import { getSessionRegistrations, inviteToSession, checkInRegistration, removeRegistration, moveRegistrationToWaitlist } from "@/lib/api/organizer-sessions";
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
      await Promise.all(notYetCheckedIn.map((p) => checkInRegistration(session.id, p.id)));
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/sessions", session.id, "registrations"] });
    } catch {
      toast({ title: "Some players couldn't be checked in", variant: "destructive" });
    } finally {
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
  // Undefined hides the toolbar's Invite button (shared/sessionActions.ts).
  const handleInvitePlayers = canInviteToSession(session.status, session.endAt) ? () => setInviteOpen(true) : undefined;

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
          checkInAllLoading={checkingInAll}
          onInvitePlayers={handleInvitePlayers}
          level={level}
          onLevelChange={setLevel}
        />
        <PlayersTable players={visible} {...rowHandlers} timeZone={session.timeZone} />
        {paginationText}
        <div className="grid grid-cols-2 gap-6">
          <WaitingListCard players={buckets.waiting} timeZone={session.timeZone} />
          <InvitePlayersCard session={session} />
        </div>
      </div>

      {/* Tablet (md-xl) */}
      <div className="hidden md:block xl:hidden space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={checkInAll} checkInAllLoading={checkingInAll} onInvitePlayers={handleInvitePlayers} level={level} onLevelChange={setLevel} />
        <PlayersList players={visible} {...rowHandlers} timeZone={session.timeZone} />
        {paginationText}
        <WaitingListCard players={buckets.waiting} timeZone={session.timeZone} />
        <CheckInSummaryCard players={allPlayers} />
        <PlayersQuickActionsCard onMessageAll={onOpenMessages} onExport={onExport} onShowWaitingList={() => setBucket("waiting")} />
      </div>

      {/* Mobile (<md) */}
      <div className="md:hidden space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={checkInAll} checkInAllLoading={checkingInAll} onInvitePlayers={handleInvitePlayers} level={level} onLevelChange={setLevel} />
        <PlayersList players={visible} {...rowHandlers} timeZone={session.timeZone} />
        {paginationText}
        <WaitingListCard players={buckets.waiting} timeZone={session.timeZone} />
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
              Their registration is cancelled and the place becomes free. Nobody is moved up from the
              waiting list automatically - you can invite or register someone yourself.
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
    </div>
  );
}
