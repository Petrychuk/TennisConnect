import type { OrganiserUser } from "@/lib/organiser-hub-mock-data";
import { cn } from "@/lib/utils";

interface DashboardHeroProps {
  organiser: OrganiserUser;
  className?: string;
  testId?: string;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Greeting only. The separate KPI row (Live / Upcoming / Active Players /
// Attendance) was removed from Home on purpose - the same numbers live in
// TC Live, Upcoming Sessions and Reports. Nothing on the backend changed.
export function DashboardHero({ organiser, className, testId = "organiser-dashboard-hero" }: DashboardHeroProps) {
  return (
    <h1 className={cn("text-xl sm:text-2xl font-display font-bold flex items-center gap-2 min-w-0", className)} data-testid={testId}>
      <span className="truncate">{greeting()}, {organiser.name}!</span> <span aria-hidden>👋</span>
    </h1>
  );
}
