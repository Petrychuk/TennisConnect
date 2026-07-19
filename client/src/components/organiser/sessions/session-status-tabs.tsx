import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BUCKET_LABEL, BUCKET_ORDER, type SessionBucket } from "./session-utils";

interface SessionStatusTabsProps {
  value: SessionBucket;
  onValueChange: (value: SessionBucket) => void;
  counts: Record<SessionBucket, number>;
}

export function SessionStatusTabs({ value, onValueChange, counts }: SessionStatusTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as SessionBucket)}>
      <TabsList
        className="w-full justify-start overflow-x-auto whitespace-nowrap h-auto p-1 scrollbar-hide"
        data-testid="organiser-sessions-status-tabs"
      >
        {BUCKET_ORDER.map((bucket) => (
          <TabsTrigger key={bucket} value={bucket} className="gap-1" data-testid={`organiser-sessions-status-tab-${bucket}`}>
            {BUCKET_LABEL[bucket]}
            {counts[bucket] > 0 && (
              <span className="text-[11px] text-muted-foreground">({counts[bucket]})</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
