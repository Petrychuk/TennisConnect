import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Heart, ArrowRight, MapPin, Star, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RecreationService {
  id: string;
  slug: string;
  name: string;
  type: string;
  provider: string;
  location: string;
  duration: string;
  price: number;
  currency: string;
  description: string;
  coverImage: string;
  rating: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  Massage: "bg-rose-500",
  Recovery: "bg-blue-500",
  Yoga: "bg-emerald-500",
  Physio: "bg-violet-500",
};

export function HomeRecreation() {
  const [items, setItems] = useState<RecreationService[]>([]);

  useEffect(() => {
    fetch("/api/recreation", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setItems((data || []).slice(0, 4)))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <section className="py-24 bg-background relative overflow-hidden" id="recreation">
      <div className="absolute bottom-0 -right-20 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-4"
            >
              <Heart className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Recover & Recharge</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-display font-bold"
            >
              Body. Mind. <span className="text-primary">Performance.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground mt-4 max-w-xl text-lg"
            >
              Sports massage, cryotherapy, physio and yoga — designed for tennis bodies and booked through TennisConnect.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/recreation">
              <Button
                className="hidden md:flex gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
                data-testid="recreation-view-all-button"
              >
                All Services <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((svc, index) => (
            <motion.div
              key={svc.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/recreation/${svc.slug}`}>
                <Card
                  className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                  data-testid={`recreation-card-${svc.slug}`}
                >
                  <div className="relative aspect-square overflow-hidden bg-secondary/50">
                    <img
                      src={svc.coverImage}
                      alt={svc.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge className={`${TYPE_COLORS[svc.type] || "bg-black/80"} text-white border-none`}>
                        {svc.type}
                      </Badge>
                    </div>
                    {svc.rating && (
                      <div className="absolute top-3 right-3 bg-black/80 text-white rounded-full px-2 py-1 text-xs flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" />
                        {svc.rating}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-bold text-base line-clamp-1">{svc.name}</h3>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {svc.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {svc.duration}
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-xl font-display font-bold">
                        ${svc.price}
                        <span className="text-xs text-muted-foreground font-normal ml-1">{svc.currency}</span>
                      </p>
                      <span className="text-xs font-bold text-primary group-hover:underline">Book →</span>
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
          <Link href="/recreation">
            <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer">
              All Services <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
