import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayersStatStrip } from "./players/players-stat-strip";
import { PlayersToolbar } from "./players/players-toolbar";
import { PlayersTable } from "./players/players-table";
import { PlayersList } from "./players/players-list";
import { WaitingListCard } from "./players/waiting-list-card";
import { InvitePlayersCard } from "./players/invite-players-card";
import { CheckInSummaryCard } from "./players/checkin-summary-card";
import { PlayersQuickActionsCard } from "./players/players-quick-actions-card";
import { SessionActionsSheet } from "./session-actions-sheet";
import { InvitePlayersDialog } from "@/components/organiser/shared/invite-players-dialog";
import { getSessionRegistrations, inviteToSession, checkInRegistration, removeRegistration, moveRegistrationToWaitlist } from "@/lib/api/organizer-sessions";
import { toSessionPlayers } from "@/lib/api/session-adapter";
import { type SessionListItem, type SessionPlayer } from "@/lib/organiser-sessions-mock-data";

interface PlayersTabProps {
  session: SessionListItem;
  onEdit?: () => void;
}

type Bucket = "registered" | "checked-in" | "waiting" | "cancelled" | "invited";

export function PlayersTab({ session, onEdit }: PlayersTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>("registered");
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
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
  const visible = (query ? buckets[bucket].filter((p) => p.name.toLowerCase().includes(query)) : buckets[bucket]);

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
  const handleRemove = (player: SessionPlayer) => removeMutation.mutate(player.id);

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
    if (!player.isReal || !player.slug) {
      toast({ title: "No profile to view", description: "This is demo data, not a real player." });
      return;
    }
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
  const handleInvitePlayers = () => setInviteOpen(true);

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
    <div data-testid="organiser-session-players-tab">
      {/* Desktop (xl+) */}
      <div className="hidden xl:block space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar
          search={search}
          onSearchChange={setSearch}
          onCheckInAll={handleCheckInAll}
          checkInAllLoading={checkingInAll}
          onInvitePlayers={handleInvitePlayers}
          showAdvancedFilters
        />
        <PlayersTable players={visible} onCheckIn={handleCheckIn} onRemove={handleRemove} onMoveToWaiting={handleMoveToWaiting} onViewProfile={handleViewProfile} />
        {paginationText}
        <div className="grid grid-cols-2 gap-6">
          <WaitingListCard players={buckets.waiting} />
          <InvitePlayersCard sessionId={session.id} />
        </div>
      </div>

      {/* Tablet (md-xl) */}
      <div className="hidden md:block xl:hidden space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={handleCheckInAll} checkInAllLoading={checkingInAll} onInvitePlayers={handleInvitePlayers} />
        <PlayersList players={visible} onCheckIn={handleCheckIn} onRemove={handleRemove} onMoveToWaiting={handleMoveToWaiting} onViewProfile={handleViewProfile} />
        {paginationText}
        <WaitingListCard players={buckets.waiting} />
        <CheckInSummaryCard players={allPlayers} />
        <PlayersQuickActionsCard lastLabel="Manage Groups" lastIcon={Users2} onMore={() => setActionsSheetOpen(true)} />
      </div>

      {/* Mobile (<md) */}
      <div className="md:hidden space-y-6">
        <PlayersStatStrip session={session} players={allPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={handleCheckInAll} checkInAllLoading={checkingInAll} onInvitePlayers={handleInvitePlayers} />
        <PlayersList players={visible} onCheckIn={handleCheckIn} onRemove={handleRemove} onMoveToWaiting={handleMoveToWaiting} onViewProfile={handleViewProfile} />
        {paginationText}
        <WaitingListCard players={buckets.waiting} />
        <PlayersQuickActionsCard onMore={() => setActionsSheetOpen(true)} />
      </div>

      <SessionActionsSheet open={actionsSheetOpen} onOpenChange={setActionsSheetOpen} onEdit={onEdit} />

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
