import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";

interface RankedEntry {
  id: string;
  name: string;
  value: string;
}

interface TopPlayersCardProps {
  title: string;
  entries: RankedEntry[];
  testId: string;
}

export function TopPlayersCard({ title, entries, testId }: TopPlayersCardProps) {
  return (
    <Card className="shadow-sm" data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-xs font-medium text-primary flex items-center gap-0.5 cursor-pointer" data-testid={`${testId}-view-all`}>
          View all
          <ChevronRight className="w-3 h-3" />
        </span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {entries.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3" data-testid={`${testId}-entry-${entry.id}`}>
            <span className="w-4 text-xs font-bold text-muted-foreground text-center shrink-0">{i + 1}</span>
            <Avatar className="h-7 w-7 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{entry.name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm flex-1 truncate">{entry.name}</span>
            <span className="text-sm font-semibold">{entry.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
