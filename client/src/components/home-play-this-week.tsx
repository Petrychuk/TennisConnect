import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, MapPin, ArrowRight, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WeekSession {
  id: string;
  title: string;
  type: string;
  location: string | null;
  startAt: string;
  organizationName: string;
  organizationSlug: string;
  maxParticipants: number | null;
  spotsLeft: number | null;
  registeredCount: number;
}

// Renders nothing until there is at least one published session in the next
// 7 days, so the homepage stays clean before any Organizer has gone live.
export function PlayThisWeek() {
  const [sessions, setSessions] = useState<WeekSession[] | null>(null);

  useEffect(() => {
    fetch("/api/organizer/sessions/this-week")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
  }, []);

  if (!sessions || sessions.length === 0) return null;

  return (
    <section className="py-24 px-4" id="play-this-week" data-testid="play-this-week-section">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground mb-4"
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sessions.slice(0, 6).map((session, index) => {
            const isFull = session.spotsLeft !== null && session.spotsLeft <= 0;
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/organisations/${session.organizationSlug}`}>
                  <Card
                    className="h-full cursor-pointer hover:shadow-lg transition-all duration-300"
                    data-testid={`play-this-week-card-${session.id}`}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-lg line-clamp-1">{session.title}</h3>
                        <Badge variant="secondary" className="capitalize shrink-0">
                          {session.type.replace("-", " ")}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4" />
                          {new Date(session.startAt).toLocaleString(undefined, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {session.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {session.location}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {isFull ? "Waiting list open" : "Spots available"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground pt-2 border-t flex items-center justify-between">
                        <span>by {session.organizationName}</span>
                        <span className="font-bold text-primary flex items-center gap-1">
                          Join <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}