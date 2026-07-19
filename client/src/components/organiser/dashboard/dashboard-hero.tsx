import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Users, CalendarDays, UsersRound, Percent, DollarSign } from "lucide-react";
import type { OrganiserUser, StatStripItem } from "@/lib/organiser-hub-mock-data";

interface DashboardHeroProps {
  organiser: OrganiserUser;
  stats: StatStripItem[];
}

const STAT_ICON: Record<string, typeof Users> = {
  live: Users,
  upcoming: CalendarDays,
  players: UsersRound,
  attendance: Percent,
  revenue: DollarSign,
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({ stat }: { stat: StatStripItem }) {
  const Icon = STAT_ICON[stat.key] ?? Users;
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow" data-testid={`organiser-stat-strip-${stat.key}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight truncate">{stat.value}</p>
          <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
          <p className="text-[11px] text-muted-foreground/70 truncate">{stat.sublabel}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardHero({ organiser, stats }: DashboardHeroProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4" data-testid="organiser-dashboard-hero">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2">
          {greeting()}, {organiser.name}! <span aria-hidden>👋</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your tennis community today.
        </p>
      </motion.div>

      {/* Mobile — single row, swipeable, loops around */}
      <motion.div
        className="sm:hidden mt-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Carousel opts={{ loop: true, align: "start" }} data-testid="organiser-stat-strip-carousel">
          <CarouselContent className="-ml-3">
            {stats.map((stat) => (
              <CarouselItem key={stat.key} className="pl-3 basis-[70%]">
                <StatCard stat={stat} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </motion.div>

      {/* Tablet & desktop — grid */}
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mt-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <StatCard stat={stat} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
