import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Heart, MapPin, Clock, Star, Search } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SEO from "@/components/seo";

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

const TYPES = ["All", "Massage", "Recovery", "Yoga", "Physio"];

const TYPE_COLORS: Record<string, string> = {
  Massage: "bg-rose-500",
  Recovery: "bg-blue-500",
  Yoga: "bg-emerald-500",
  Physio: "bg-violet-500",
};

export default function RecreationPage() {
  const [items, setItems] = useState<RecreationService[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch("/api/recreation", { credentials: "include" })
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filtered = items.filter((s) => {
    const matchType = type === "All" || s.type === type;
    const q = search.toLowerCase();
    return matchType && (!q || s.name.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q));
  });

  return (
    <>
      <SEO
      title="Tennis Recreation Services | TennisConnect"
      description="Find recreation services, tennis activities and lifestyle experiences designed for tennis enthusiasts."
      canonical="/recreation"
      tags={[
        "tennis recreation",
        "tennis activities",
        "tennis lifestyle",
        "sports activities",
        "tennis experiences",
      ]}
    />
      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        <div className="relative min-h-[40vh] flex items-center justify-center overflow-hidden bg-black">
          <div
            className="absolute inset-0 z-0 opacity-30"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2000&auto=format&fit=crop)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-background z-10" />
          <div className="relative z-20 container mx-auto px-4 text-center mt-20">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
              <Badge className="mb-6 bg-primary text-primary-foreground px-4 py-1.5 text-sm font-bold">
                <Heart className="w-4 h-4 mr-2" /> Tennis Recreation
              </Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-4 tracking-tight text-white">
                Body. Mind. <span className="text-primary">Performance.</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto font-light">
                Massage, cryo, yoga, physio — designed for tennis bodies.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b py-4">
          <div className="container mx-auto px-4 flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                className="pl-10 h-11 bg-secondary/50 border-transparent focus:border-primary rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="recreation-search-input"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer ${
                    type === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-secondary border-input"
                  }`}
                  data-testid={`recreation-type-${t}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold mb-2">No services found</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link href={`/recreation/${s.slug}`}>
                    <Card className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full">
                      <div className="relative aspect-4/3 overflow-hidden bg-secondary/50">
                        <img
                          src={s.coverImage}
                          alt={s.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute top-3 left-3">
                          <Badge className={`${TYPE_COLORS[s.type] || "bg-black/80"} text-white border-none`}>{s.type}</Badge>
                        </div>
                        {s.rating && (
                          <div className="absolute top-3 right-3 bg-black/80 text-white rounded-full px-2 py-1 text-xs flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 stroke-yellow-400" /> {s.rating}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 text-white">
                          <h3 className="font-bold text-lg line-clamp-1">{s.name}</h3>
                          <p className="text-xs opacity-90">{s.provider}</p>
                        </div>
                      </div>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration}</span>
                        </div>
                        <div className="flex items-end justify-between">
                          <p className="text-2xl font-display font-bold">
                            ${s.price}
                            <span className="text-xs text-muted-foreground font-normal ml-1">{s.currency}</span>
                          </p>
                          <span className="text-sm font-bold text-primary group-hover:underline">Book →</span>
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
