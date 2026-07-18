import { OrganiserProfile } from "@/lib/organiser-hub-mock-data";

interface DashboardHeroProps {
  organiser: OrganiserProfile;
  sessionsThisWeek: number;
}

function getInitial(name: string) {
  return name?.trim()?.[0]?.toUpperCase() || "O";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// The "thesis" of the page: a court-line motif (the white service-box
// lines) rendered in CSS over the brand gradient, rather than a stock
// photo or a generic stat-card hero.
export function DashboardHero({ organiser, sessionsThisWeek }: DashboardHeroProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary via-primary to-[hsl(78,60%,30%)] text-primary-foreground px-6 py-8 sm:px-10 sm:py-10"
      data-testid="organiser-hub-hero"
    >
      {/* Court lines motif */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.15] pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 800 300"
        aria-hidden="true"
      >
        <rect x="20" y="20" width="760" height="260" fill="none" stroke="white" strokeWidth="3" />
        <line x1="20" y1="150" x2="780" y2="150" stroke="white" strokeWidth="3" />
        <line x1="240" y1="20" x2="240" y2="280" stroke="white" strokeWidth="2" />
        <line x1="560" y1="20" x2="560" y2="280" stroke="white" strokeWidth="2" />
        <line x1="240" y1="90" x2="560" y2="90" stroke="white" strokeWidth="2" />
        <line x1="240" y1="210" x2="560" y2="210" stroke="white" strokeWidth="2" />
      </svg>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 border-2 border-white/40 flex items-center justify-center text-2xl sm:text-3xl font-bold shrink-0">
          {getInitial(organiser.name)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary-foreground/80 font-medium">{greeting()}</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold truncate">{organiser.name}</h2>
          <p className="text-sm text-primary-foreground/80 mt-1">
            Organising for {organiser.organizationName} · Member since {organiser.memberSince}
          </p>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end gap-1 sm:gap-0 shrink-0">
          <span className="text-3xl sm:text-4xl font-bold" data-testid="organiser-hub-sessions-this-week">
            {sessionsThisWeek}
          </span>
          <span className="text-xs uppercase tracking-wide text-primary-foreground/80">
            sessions this week
          </span>
        </div>
      </div>
    </div>
  );
}
