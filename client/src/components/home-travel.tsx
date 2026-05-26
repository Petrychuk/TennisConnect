import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Plane, ArrowRight, MapPin, Calendar, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TravelPackage {
  id: string;
  slug: string;
  title: string;
  destination: string;
  duration: string;
  price: number;
  currency: string;
  description: string;
  coverImage: string;
  startDate: string | null;
  spotsLeft: number;
  isFeatured: boolean;
}

export function HomeTravel() {
  const [items, setItems] = useState<TravelPackage[]>([]);

  useEffect(() => {
    fetch("/api/travel", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setItems((data || []).slice(0, 3)))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "TBA";

  return (
    <section className="py-24 bg-gradient-to-b from-secondary/20 to-background relative overflow-hidden" id="travel">
      <div className="absolute -top-40 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-4"
            >
              <Plane className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Tennis Travel</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-display font-bold"
            >
              Train. Travel. <span className="text-primary">Transform.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground mt-4 max-w-xl text-lg"
            >
              Curated tennis getaways — from Mallorca to Bali. Train with pros, recover in paradise.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/travel">
              <Button
                className="hidden md:flex gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
                data-testid="travel-view-all-button"
              >
                Browse Packages <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((pkg, index) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/travel/${pkg.slug}`}>
                <Card
                  className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                  data-testid={`travel-card-${pkg.slug}`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-secondary/50">
                    <img
                      src={pkg.coverImage}
                      alt={pkg.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />

                    {pkg.isFeatured && (
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-primary text-primary-foreground font-bold border-none">Featured</Badge>
                      </div>
                    )}

                    {pkg.spotsLeft <= 5 && (
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-red-500 text-white border-none">Only {pkg.spotsLeft} left</Badge>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h3 className="font-bold text-xl mb-1 line-clamp-1">{pkg.title}</h3>
                      <div className="flex items-center gap-1 text-sm opacity-90">
                        <MapPin className="w-3 h-3" /> {pkg.destination}
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3 h-3" /> {formatDate(pkg.startDate)}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-3 h-3" /> {pkg.duration}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{pkg.description}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground">From</span>
                        <p className="text-2xl font-display font-bold">
                          ${pkg.price} <span className="text-xs text-muted-foreground font-normal">{pkg.currency}</span>
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
          <Link href="/travel">
            <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer">
              Browse Packages <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
