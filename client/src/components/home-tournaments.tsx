import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Trophy, ArrowRight, MapPin, Calendar, Users, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Tournament {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  location: string;
  level: string;
  price: number;
  prizePool: string | null;
  maxParticipants: number;
  currentParticipants: number;
  coverImage: string;
  status: string;
  createdAt: string;
}

interface Props {
  variant: "recent" | "upcoming";
}

export function HomeTournaments({ variant }: Props) {
  const [items, setItems] = useState<Tournament[]>([]);

  useEffect(() => {
    fetch("/api/event-tournaments", { credentials: "include" })
      .then((r) => r.json())
      .then((data: Tournament[]) => {
        let filtered = (data || []).filter((t) => t.status === "upcoming");
        if (variant === "recent") {
          // Most recently added upcoming tournaments
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else {
          // Soonest by start date
          filtered.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        }
        setItems(filtered.slice(0, 3));
      })
      .catch(() => setItems([]));
  }, [variant]);

  if (!items.length) return null;

  const isRecent = variant === "recent";
  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

  const sectionId = isRecent ? "tennis-club" : "upcoming-tournaments";

  return (
    <section
      className={`py-24 relative overflow-hidden ${
        isRecent ? "bg-black text-white" : "bg-gradient-to-b from-background to-secondary/30"
      }`}
      id={sectionId}
    >
      {isRecent && (
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(#DFFF00 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        />
      )}

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
                isRecent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {isRecent ? "Just Announced" : "Coming Up"}
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-display font-bold"
            >
              {isRecent ? (
                <>
                  Tennis <span className="text-primary">Club</span>
                </>
              ) : (
                <>
                  Upcoming <span className="text-primary">Tournaments</span>
                </>
              )}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className={`mt-4 max-w-xl text-lg ${isRecent ? "text-gray-300" : "text-muted-foreground"}`}
            >
              {isRecent
                ? "Freshly announced tournaments across Australia — get in before the brackets fill up."
                : "Compete, climb the rankings, and meet the community. Filtered for what's happening soonest."}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/tournaments">
              <Button
                className={`hidden md:flex gap-2 font-bold rounded-full px-6 cursor-pointer ${
                  isRecent
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
                data-testid={`${sectionId}-view-all-button`}
              >
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {items.map((t, index) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href="/tournaments">
                <Card
                  className={`group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full ${
                    isRecent ? "bg-zinc-900 text-white" : ""
                  }`}
                  data-testid={`${sectionId}-card-${t.slug}`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-secondary/50">
                    <img
                      src={t.coverImage}
                      alt={t.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <Badge
                        className={`${
                          t.level === "Advanced"
                            ? "bg-red-500"
                            : t.level === "Intermediate"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        } text-white border-none`}
                      >
                        {t.level}
                      </Badge>
                    </div>
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h3 className="font-bold text-xl mb-1 line-clamp-1">{t.name}</h3>
                      <div className="flex items-center gap-3 text-sm opacity-90">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(t.startDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {t.location.split(",")[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <DollarSign className={`w-4 h-4 mx-auto mb-1 ${isRecent ? "text-primary" : "text-primary"}`} />
                        <p className="font-bold text-sm">${t.price}</p>
                        <p className={`text-[10px] ${isRecent ? "text-gray-400" : "text-muted-foreground"}`}>Entry</p>
                      </div>
                      <div>
                        <Trophy className={`w-4 h-4 mx-auto mb-1 ${isRecent ? "text-primary" : "text-primary"}`} />
                        <p className="font-bold text-sm">{t.prizePool || "—"}</p>
                        <p className={`text-[10px] ${isRecent ? "text-gray-400" : "text-muted-foreground"}`}>Prize</p>
                      </div>
                      <div>
                        <Users className={`w-4 h-4 mx-auto mb-1 ${isRecent ? "text-primary" : "text-primary"}`} />
                        <p className="font-bold text-sm">
                          {t.currentParticipants}/{t.maxParticipants}
                        </p>
                        <p className={`text-[10px] ${isRecent ? "text-gray-400" : "text-muted-foreground"}`}>Slots</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 md:hidden"
        >
          <Link href="/tournaments">
            <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer">
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
