import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { SessionSummaryCard } from "./session-summary-card";
import { SessionDetailsCard } from "./session-details-card";
import { SessionQuickStatsCard } from "./session-quick-stats-card";
import { SessionStatusCard } from "./session-status-card";
import { SessionReadinessCard } from "./session-readiness-card";
import { SessionActionsCard } from "./session-actions-card";
import { SessionNotesCard } from "./session-notes-card";
import { DivisionsCard } from "./divisions-card";
import { useToast } from "@/hooks/use-toast";
import {
  mockSessionQuickStats,
  mockSessionTopPlayers,
  mockSessionTopPlayersExtra,
  mockSessionReadiness,
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
  const viewReadinessDetails = () => toast({ title: "Readiness details isn't wired up yet" });

  const quickStats = (
    <SessionQuickStatsCard
      stats={mockSessionQuickStats}
      topPlayers={mockSessionTopPlayers}
      extraCount={mockSessionTopPlayersExtra}
    />
  );

  const isMultiDivisionType = (session.type === "tournament" || session.type === "club-championship") && !session.parentSessionId;

  return (
    <div data-testid="organiser-session-overview-tab">
      {/* Desktop (xl+): Summary(2) + Status + Readiness in row 1, then
          Details/Actions/Notes as three equal columns, Quick Stats last. */}
      <div className="hidden xl:block space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <SessionSummaryCard session={session} className="col-span-2" />
          <SessionStatusCard session={session} onEdit={onEdit} />
          <SessionReadinessCard readiness={mockSessionReadiness} onViewDetails={viewReadinessDetails} />
        </div>
        {isMultiDivisionType && <DivisionsCard sessionId={session.id} />}
        <div className="grid grid-cols-3 gap-4">
          <SessionDetailsCard session={session} />
          <SessionActionsCard session={session} onEdit={onEdit} />
          <SessionNotesCard initialNote={detail.notes} />
        </div>
        {quickStats}
      </div>

      {/* Tablet (md to xl): Summary full width, Status+Readiness paired,
          Details+Notes paired, Actions as an icon grid, Quick Stats last. */}
      <div className="hidden md:block xl:hidden space-y-4">
        <SessionSummaryCard session={session} />
        <div className="grid grid-cols-2 gap-4">
          <SessionStatusCard session={session} showEditButton={false} />
          <SessionReadinessCard readiness={mockSessionReadiness} onViewDetails={viewReadinessDetails} />
        </div>
        {isMultiDivisionType && <DivisionsCard sessionId={session.id} />}
        <div className="grid grid-cols-2 gap-4">
          <SessionDetailsCard session={session} />
          <SessionNotesCard initialNote={detail.notes} />
        </div>
        <SessionActionsCard session={session} onEdit={onEdit} variant="grid" />
        {quickStats}
      </div>

      {/* Mobile (<md): everything single-column, Edit/Invite as a 2-button
          row right after Status+Readiness since Status has no button here. */}
      <div className="md:hidden space-y-6">
        <SessionSummaryCard session={session} />
        <SessionStatusCard session={session} showEditButton={false} />
        <SessionReadinessCard readiness={mockSessionReadiness} onViewDetails={viewReadinessDetails} />
        {isMultiDivisionType && <DivisionsCard sessionId={session.id} />}
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
        <SessionDetailsCard session={session} />
        <SessionNotesCard initialNote={detail.notes} />
        {quickStats}
      </div>
    </div>
  );
}
