import { ArrowUpDown, MessageSquare, Trash2, UserCircle, type LucideIcon } from "lucide-react";
import type { SessionPlayer } from "@/lib/organiser-sessions-mock-data";

// Shared by the Players table (desktop) and list (tablet/phone) so both
// offer the same, real actions for a registration in a given state.

export const LEVEL_BADGE_STYLE: Record<SessionPlayer["levelLabel"], string> = {
  Advanced: "bg-primary/20 text-primary-text",
  Intermediate: "bg-secondary text-secondary-foreground",
  Beginner: "bg-secondary text-secondary-foreground",
  Social: "bg-muted text-muted-foreground",
};

export const STATUS_BADGE_STYLE: Record<SessionPlayer["status"], string> = {
  registered: "bg-primary/20 text-primary-text",
  waiting: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  invited: "bg-accent text-accent-foreground",
  "no-response": "bg-muted text-muted-foreground",
};

export const STATUS_LABEL: Record<SessionPlayer["status"], string> = {
  registered: "Registered",
  waiting: "Waiting",
  cancelled: "Cancelled",
  invited: "Invited",
  "no-response": "No Response",
};

export interface PlayerRowAction {
  key: "move-to-waiting" | "message" | "view-profile" | "remove";
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  onSelect: () => void;
}

interface Handlers {
  onMoveToWaiting?: (player: SessionPlayer) => void;
  onMessage?: (player: SessionPlayer) => void;
  onViewProfile?: (player: SessionPlayer) => void;
  onRemove?: (player: SessionPlayer) => void;
}

/** Only actions that apply to this player's state and have a real handler. */
export function playerRowActions(player: SessionPlayer, h: Handlers): PlayerRowAction[] {
  const actions: PlayerRowAction[] = [];
  if (h.onMoveToWaiting && player.status === "registered") {
    actions.push({ key: "move-to-waiting", label: "Move to Waiting List", icon: ArrowUpDown, onSelect: () => h.onMoveToWaiting!(player) });
  }
  if (h.onMessage && player.userId) {
    actions.push({ key: "message", label: "Message", icon: MessageSquare, onSelect: () => h.onMessage!(player) });
  }
  if (h.onViewProfile && player.slug) {
    actions.push({ key: "view-profile", label: "View Profile", icon: UserCircle, onSelect: () => h.onViewProfile!(player) });
  }
  if (h.onRemove && player.status !== "cancelled") {
    actions.push({ key: "remove", label: "Remove from Session", icon: Trash2, destructive: true, onSelect: () => h.onRemove!(player) });
  }
  return actions;
}
