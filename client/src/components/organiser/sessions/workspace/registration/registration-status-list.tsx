import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Bucket } from "./types";

interface RegistrationStatusListProps {
  active: Bucket;
  onSelect: (bucket: Bucket) => void;
  counts: Record<Bucket, number>;
}

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "registered", label: "Registered" },
  { key: "waiting", label: "Waiting List" },
  { key: "invited", label: "Invited" },
  { key: "cancelled", label: "Cancelled" },
  { key: "no-response", label: "No Response" },
];

export function RegistrationStatusList({ active, onSelect, counts }: RegistrationStatusListProps) {
  return (
    <Card className="shadow-sm" data-testid="organiser-registration-status-list">
      <CardHeader>
        <CardTitle className="text-base">Registration Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => onSelect(b.key)}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left transition-colors",
              active === b.key ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/40"
            )}
            data-testid={`organiser-registration-status-${b.key}`}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", active === b.key ? "bg-primary" : "bg-muted-foreground")} />
            <span className="flex-1">{b.label}</span>
            <span className="text-muted-foreground">({counts[b.key]})</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
