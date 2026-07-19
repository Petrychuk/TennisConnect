import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlayersStatStrip } from "./players/players-stat-strip";
import { PlayersToolbar } from "./players/players-toolbar";
import { PlayersTable } from "./players/players-table";
import { PlayersList } from "./players/players-list";
import { WaitingListCard } from "./players/waiting-list-card";
import { InvitePlayersCard } from "./players/invite-players-card";
import { GroupOverviewCard } from "./players/group-overview-card";
import { CheckInSummaryCard } from "./players/checkin-summary-card";
import { PlayersQuickActionsCard } from "./players/players-quick-actions-card";
import { SessionActionsSheet } from "./session-actions-sheet";
import {
  mockSessionPlayers,
  mockWaitingList,
  mockGroupOverview,
  type SessionListItem,
  type SessionPlayer,
} from "@/lib/organiser-sessions-mock-data";

interface PlayersTabProps {
  session: SessionListItem;
  onEdit?: () => void;
}

type Bucket = "registered" | "checked-in" | "waiting" | "cancelled" | "invited";

export function PlayersTab({ session, onEdit }: PlayersTabProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<Bucket>("registered");
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);

  const buckets: Record<Bucket, SessionPlayer[]> = useMemo(() => {
    const registered = mockSessionPlayers.filter((p) => p.status === "registered");
    return {
      registered,
      "checked-in": registered.filter((p) => p.checkedIn),
      waiting: mockSessionPlayers.filter((p) => p.status === "waiting"),
      cancelled: mockSessionPlayers.filter((p) => p.status === "cancelled"),
      invited: mockSessionPlayers.filter((p) => p.status === "invited"),
    };
  }, []);

  const query = search.trim().toLowerCase();
  const visible = (query ? buckets[bucket].filter((p) => p.name.toLowerCase().includes(query)) : buckets[bucket]);

  const handleCheckIn = (player: SessionPlayer) =>
    toast({ title: "Checked in", description: `${player.name} would be marked as checked in.` });
  const handleCheckInAll = () => toast({ title: "Check-in All isn't wired up yet" });
  const handleInvitePlayers = () => toast({ title: "Invite Players isn't wired up yet" });

  const bucketTabs: { key: Bucket; label: string }[] = [
    { key: "registered", label: "Registered" },
    { key: "checked-in", label: "Checked In" },
    { key: "waiting", label: "Waiting List" },
    { key: "cancelled", label: "Cancelled" },
    { key: "invited", label: "Invited" },
  ];

  const bucketTabsList = (
    <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
      <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap h-auto p-1 scrollbar-hide" data-testid="organiser-players-bucket-tabs">
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
        <PlayersStatStrip session={session} players={mockSessionPlayers} />
        {bucketTabsList}
        <PlayersToolbar
          search={search}
          onSearchChange={setSearch}
          onCheckInAll={handleCheckInAll}
          onInvitePlayers={handleInvitePlayers}
          showAdvancedFilters
        />
        <PlayersTable players={visible} onCheckIn={handleCheckIn} />
        {paginationText}
        <div className="grid grid-cols-2 gap-6">
          <WaitingListCard players={mockWaitingList} />
          <InvitePlayersCard sessionId={session.id} />
        </div>
      </div>

      {/* Tablet (md-xl) */}
      <div className="hidden md:block xl:hidden space-y-6">
        <PlayersStatStrip session={session} players={mockSessionPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={handleCheckInAll} onInvitePlayers={handleInvitePlayers} />
        <PlayersList players={visible} onCheckIn={handleCheckIn} />
        {paginationText}
        <WaitingListCard players={mockWaitingList} />
        <div className="grid grid-cols-2 gap-6">
          <GroupOverviewCard groups={mockGroupOverview} />
          <CheckInSummaryCard players={mockSessionPlayers} />
        </div>
        <PlayersQuickActionsCard lastLabel="Manage Groups" lastIcon={Users2} onMore={() => setActionsSheetOpen(true)} />
      </div>

      {/* Mobile (<md) */}
      <div className="md:hidden space-y-6">
        <PlayersStatStrip session={session} players={mockSessionPlayers} />
        {bucketTabsList}
        <PlayersToolbar search={search} onSearchChange={setSearch} onCheckInAll={handleCheckInAll} onInvitePlayers={handleInvitePlayers} />
        <PlayersList players={visible} onCheckIn={handleCheckIn} />
        {paginationText}
        <WaitingListCard players={mockWaitingList} />
        <PlayersQuickActionsCard onMore={() => setActionsSheetOpen(true)} />
      </div>

      <SessionActionsSheet open={actionsSheetOpen} onOpenChange={setActionsSheetOpen} onEdit={onEdit} />
    </div>
  );
}
