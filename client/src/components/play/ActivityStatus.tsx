import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAY_STATUS_LABEL, PLAY_STATUS_STYLE } from "@/lib/play-status";
import type { PublicSessionStatus } from "@shared/schema";

// Spec [PLAY] section 14 ("Reusable Event Components"): a single
// player-facing status badge, used by both PlaySessionCard and
// EventQuickViewModal instead of each inlining PLAY_STATUS_LABEL/
// PLAY_STATUS_STYLE separately.
export function ActivityStatus({
  status,
  className,
  "data-testid": dataTestId,
}: {
  status: PublicSessionStatus;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <Badge className={cn(PLAY_STATUS_STYLE[status], className)} data-testid={dataTestId}>
      {PLAY_STATUS_LABEL[status]}
    </Badge>
  );
}
