import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Plane, MapPin, Calendar, Users, Search } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SEO from "@/components/seo";
import travelHero from "/assets/images/hurbord_tennis.png";

interface TravelPackage {
  id: string;
  slug: string;
  title: string;
  destination: string;
  duration: string;
  price: number;
  currency: string;
  description: string;
  content?: string;
  highlights?: string[];
  includes?: string[];
  coverImage: string;
  gallery?: string[];
  startDate: string | null;
  spotsLeft: number;
  providerName?: string;
  providerWebsite?: string;
  providerLogo?: string;
  ctaText?: string;
  ctaUrl?: string;
  tags?: string[];
  seoTitle?: string;
  metaDescription?: string;
  isFeatured: boolean;
  isActive?: boolean;
}

export default function TravelPage() {
  const [items, setItems] = useState<TravelPackage[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch("/api/travel", { credentials: "include" })
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.title.toLowerCase().includes(q) || p.destination.toLowerCase().includes(q);
  });

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "TBA";

  return (
    <>
        <SEO
        title="Tennis Travel Packages | TennisConnect"
        description="Discover tennis holidays, tennis camps and travel experiences for players looking to combine travel with their passion for tennis."
        canonical="/travel"
        tags={[
          "tennis travel",
          "tennis holiday",
          "tennis camp",
          "tennis trips",
          "sports travel",
          "tennis vacation",
        ]}
      />
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="relative min-h-[24vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${travelHero})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />
        <div className="relative z-20 container mx-auto px-4 text-left mt-16 md:mt-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md mb-6">
              <Plane className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-white">
                Tennis Travel
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-4 tracking-tight text-white drop-shadow-md">
              Train. Travel.{" "}
              <span className="relative inline-block text-primary">
                Transform.
                <svg
                  className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 5 Q 50 10 100 5"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                  />
                </svg>
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/85 max-w-2xl font-light drop-shadow-sm">
              Curated tennis getaways. Train with pros, recover in paradise.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b py-4">
        <div className="container mx-auto px-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search destinations..."
              className="pl-10 h-11 bg-secondary/50 border-transparent focus:border-primary rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="travel-search-input"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Plane className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold mb-2">No packages found</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/travel/${p.slug}`}>
                  <Card className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full">
                    <div className="relative aspect-4/3 overflow-hidden bg-secondary/50">
                      <img
                        src={p.coverImage}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      {p.isFeatured && (
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-primary text-primary-foreground font-bold border-none">Featured</Badge>
                        </div>
                      )}
                      {p.spotsLeft <= 5 && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-red-500 text-white border-none">{p.spotsLeft} spots</Badge>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <h3 className="font-bold text-xl mb-1 line-clamp-1">{p.title}</h3>
                        <div className="flex items-center gap-1 text-sm opacity-90">
                          <MapPin className="w-3 h-3" /> {p.destination}
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(p.startDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {p.duration}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{p.description}</p>
                      <div className="flex items-end justify-between">
                        <p className="text-2xl font-display font-bold">
                          ${p.price}
                          <span className="text-xs text-muted-foreground font-normal ml-1">{p.currency}</span>
                        </p>
                        <span className="text-sm font-bold text-primary group-hover:underline">View →</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
    </>
  );
}
