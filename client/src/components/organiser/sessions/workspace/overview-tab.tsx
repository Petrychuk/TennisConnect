import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { SessionSummaryCard } from "./session-summary-card";
import { SessionDetailsCard } from "./session-details-card";
import { SessionQuickStatsCard } from "./session-quick-stats-card";
import { SessionStatusCard } from "./session-status-card";
import { SessionActionsCard } from "./session-actions-card";
import { SessionActivityCard } from "./session-activity-card";
import { SessionNotesCard } from "./session-notes-card";
import { useToast } from "@/hooks/use-toast";
import {
  mockSessionActivity,
  mockSessionQuickStats,
  mockSessionTopPlayers,
  mockSessionTopPlayersExtra,
  getSessionDetail,
  type SessionListItem,
} from "@/lib/organiser-sessions-mock-data";

interface OverviewTabProps {
  session: SessionListItem;
  onEdit?: () => void;
}

export function OverviewTab({ session, onEdit }: OverviewTabProps) {
  const detail = getSessionDetail(session);
  const { toast } = useToast();

  const quickStats = (
    <SessionQuickStatsCard
      stats={mockSessionQuickStats}
      topPlayers={mockSessionTopPlayers}
      extraCount={mockSessionTopPlayersExtra}
    />
  );

  return (
    <div data-testid="organiser-session-overview-tab">
      {/* Desktop (xl+): Summary+Status share a row, Details/Activity/Notes
          share the next row as three equal columns, Quick Stats closes it out. */}
      <div className="hidden xl:block space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <SessionSummaryCard session={session} className="col-span-2" />
          <SessionStatusCard session={session} onEdit={onEdit} />
        </div>
        <div className="grid grid-cols-3 gap-6">
          <SessionDetailsCard session={session} />
          <SessionActivityCard items={mockSessionActivity} />
          <SessionNotesCard initialNote={detail.notes} />
        </div>
        {quickStats}
      </div>

      {/* Tablet (md to xl): Summary full width, then Status+Actions as a
          pair, Details on its own row, then Activity+Notes as a pair. */}
      <div className="hidden md:block xl:hidden space-y-6">
        <SessionSummaryCard session={session} />
        <div className="grid grid-cols-2 gap-6">
          <SessionStatusCard session={session} showEditButton={false} />
          <SessionActionsCard onEdit={onEdit} />
        </div>
        <SessionDetailsCard session={session} />
        <div className="grid grid-cols-2 gap-6">
          <SessionActivityCard items={mockSessionActivity} />
          <SessionNotesCard initialNote={detail.notes} />
        </div>
        {quickStats}
      </div>

      {/* Mobile (<md): everything single-column. Status has no button of
          its own — Edit/Invite sit as a pair right below it instead. */}
      <div className="md:hidden space-y-6">
        <SessionSummaryCard session={session} />
        <SessionDetailsCard session={session} />
        <SessionStatusCard session={session} showEditButton={false} />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onEdit} data-testid="organiser-session-overview-edit-mobile">
            Edit Session
          </Button>
          <Button
            variant="outline"
            onClick={() => toast({ title: "Invite Players isn't wired up yet" })}
            data-testid="organiser-session-overview-invite-mobile"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Players
          </Button>
        </div>
        <SessionActivityCard items={mockSessionActivity} />
        <SessionNotesCard initialNote={detail.notes} />
        {quickStats}
      </div>
    </div>
  );
}
