import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Calendar, Users, Percent, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatisticsCardProps {
  totalSessions: number;
  totalParticipants: number;
  averageAttendanceRate: number;
  averageRating: number;
  className?: string;
}

export function StatisticsCard({
  totalSessions,
  totalParticipants,
  averageAttendanceRate,
  averageRating,
  className,
}: StatisticsCardProps) {
  const stats = [
    { label: "Total Sessions", value: totalSessions, icon: Calendar, testId: "organiser-hub-stat-sessions" },
    { label: "Total Participants", value: totalParticipants, icon: Users, testId: "organiser-hub-stat-participants" },
    { label: "Avg. Attendance", value: `${averageAttendanceRate}%`, icon: Percent, testId: "organiser-hub-stat-attendance" },
    { label: "Avg. Rating", value: averageRating.toFixed(1), icon: Star, testId: "organiser-hub-stat-rating" },
  ];

  return (
    <Card className={cn(className)} data-testid="organiser-hub-statistics-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-4 h-4 text-primary" />
          Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-border/60 p-3 text-center"
                data-testid={stat.testId}
              >
                <div className="w-8 h-8 mx-auto rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
