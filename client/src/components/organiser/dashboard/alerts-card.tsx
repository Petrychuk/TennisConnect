import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertItem } from "@/lib/organiser-hub-mock-data";

interface AlertsCardProps {
  alerts: AlertItem[];
  className?: string;
}

export function AlertsCard({ alerts, className }: AlertsCardProps) {
  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)} data-testid="organiser-alerts-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Needs Your Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2" data-testid="organiser-alerts-empty">
            Nothing needs your attention right now.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-start gap-2.5 rounded-xl bg-destructive/5 px-3 py-2.5 text-sm"
                data-testid={`organiser-alert-${alert.id}`}
              >
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <span>{alert.message}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
