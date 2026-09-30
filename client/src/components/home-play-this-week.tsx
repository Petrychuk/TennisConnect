import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlaySessionCard } from "@/components/play/session-card";
import { EventQuickViewModal } from "@/components/play/EventQuickViewModal";
import { getPlaySessions } from "@/lib/api/play";
import { resolveDateFilterRange } from "@/lib/play-status";

// Spec ([PLAY] section 15, "Homepage Integration"): "Do not build
// another independent session discovery system on Home. Homepage can
// reuse the same published Play data." This replaces the previous
// home-play-this-week.tsx, which fetched its own separate endpoint,
// used its own card markup, and linked to the organisation page
// instead of opening the Event Quick View Modal - none of which
// matched Play itself. Now: same getPlaySessions() call Play's own
// page uses, same PlaySessionCard, same modal, just capped to a
// homepage-sized preview.
export function PlayThisWeek() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { from, to } = resolveDateFilterRange("this_week", "");

  const sessionsQuery = useQuery({
    queryKey: ["/api/play/sessions", "home-this-week", from?.toISOString(), to?.toISOString()],
    queryFn: () => getPlaySessions({ dateFrom: from?.toISOString(), dateTo: to?.toISOString() }),
  });
  const sessions = (sessionsQuery.data ?? []).slice(0, 4);

  if (sessionsQuery.isLoading) {
    return (
      <section className="py-24 px-4" data-testid="play-this-week-section">
        <div className="container mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </section>
    );
  }

  // Compact fallback instead of a large empty block (spec: homepage
  // should never show "a large empty Live block" when there's
  // nothing to show) - a short line pointing at Play itself, not a
  // whole empty section.
  if (sessions.length === 0) {
    return (
      <section className="py-16 px-4" data-testid="play-this-week-empty">
        <div className="container mx-auto max-w-4xl text-center space-y-3">
          <Sparkles className="w-6 h-6 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            New games are coming soon - check{" "}
            <Link href="/play" className="text-primary font-medium underline underline-offset-2">
              Play
            </Link>{" "}
            for what's available now.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 px-4" id="play-this-week" data-testid="play-this-week-section">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-foreground mb-4"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">THIS WEEK</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-display font-bold"
            >
              Play This Week
            </motion.h2>
          </div>
          <Button asChild variant="outline" data-testid="play-this-week-explore-all">
            <Link href="/play">
              Explore all <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
        </div>

        <div className="space-y-4">
          {sessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
            >
              <PlaySessionCard session={session} onView={() => setSelectedSessionId(session.id)} />
            </motion.div>
          ))}
        </div>
      </div>

      <EventQuickViewModal
        sessionId={selectedSessionId}
        onOpenChange={(open) => !open && setSelectedSessionId(null)}
      />
    </section>
  );
}
