import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Building2, ArrowRight, MapPin, Star, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLUBS_DATA } from "@/lib/dummy-data";

interface Club {
  id: string | number;
  name: string;
  location: string;
  description: string;
  services: string[];
  price: string;
  phone: string;
  website: string | null;
  image: string | null;
  rating: string | null;
}

export function HomeClubs() {
  const [items, setItems] = useState<Club[]>(
    CLUBS_DATA.slice(0, 3)
  );

  useEffect(() => {
    fetch("/api/clubs", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setItems(data.slice(0, 3));
        }
      })
      .catch(() => {
        console.log("Using fallback club data");
      });
  }, []);

  return (
    <section className="py-24 bg-black text-white relative overflow-hidden" id="tennis-club">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#DFFF00 1px, transparent 1px)", backgroundSize: "20px 20px" }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground mb-4"
            >
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Find a Home Court</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-display font-bold"
            >
              Tennis <span className="text-primary">Club</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-gray-300 mt-4 max-w-xl text-lg"
            >
              Top tennis clubs across Australia — book courts, join socials, find your home court.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/clubs">
              <Button
                className="hidden md:flex gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
                data-testid="clubs-view-all-button"
              >
                Explore Clubs <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {items.map((club, index) => (
            <motion.div
              key={club.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href="/clubs">
                <Card
                  className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full bg-zinc-900 text-white"
                  data-testid={`club-card-${club.id}`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-secondary/50">
                    {club.image && (
                      <img
                        src={club.image}
                        alt={club.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    )}
                    {club.rating && (
                      <div className="absolute top-3 right-3 bg-black/80 text-white rounded-full px-3 py-1 text-xs flex items-center gap-1 backdrop-blur">
                        <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                        {club.rating}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h3 className="font-bold text-xl mb-1 line-clamp-1">{club.name}</h3>
                      <div className="flex items-center gap-1 text-sm opacity-90">
                        <MapPin className="w-3 h-3" /> {club.location}
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <p className="text-sm text-gray-300 line-clamp-2 mb-4">{club.description}</p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(club.services || []).slice(0, 3).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] border-zinc-700 text-gray-300">
                          {s}
                        </Badge>
                      ))}
                      {(club.services || []).length > 3 && (
                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-gray-400">
                          +{(club.services || []).length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-end justify-between pt-3 border-t border-zinc-800">
                      <div>
                        <p className="text-xs text-gray-400">From</p>
                        <p className="text-xl font-display font-bold">
                          ${club.price}
                          <span className="text-xs text-gray-400 font-normal ml-1">/hr</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary group-hover:underline">View →</span>
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
          <Link href="/clubs">
            <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer">
              Explore Clubs <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
