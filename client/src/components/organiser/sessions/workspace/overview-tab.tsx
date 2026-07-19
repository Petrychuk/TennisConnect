import { SessionSummaryCard } from "./session-summary-card";
import { SessionDetailsCard } from "./session-details-card";
import { SessionQuickStatsCard } from "./session-quick-stats-card";
import { SessionStatusCard } from "./session-status-card";
import { SessionActivityCard } from "./session-activity-card";
import { SessionNotesCard } from "./session-notes-card";
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" data-testid="organiser-session-overview-tab">
      <div className="xl:col-span-2 space-y-6">
        <SessionSummaryCard session={session} />
        <SessionDetailsCard session={session} />
        <SessionQuickStatsCard
          stats={mockSessionQuickStats}
          topPlayers={mockSessionTopPlayers}
          extraCount={mockSessionTopPlayersExtra}
        />
      </div>

      <div className="space-y-6">
        <SessionStatusCard session={session} onEdit={onEdit} />
        <SessionActivityCard items={mockSessionActivity} />
        <SessionNotesCard initialNote={detail.notes} />
      </div>
    </div>
  );
}
