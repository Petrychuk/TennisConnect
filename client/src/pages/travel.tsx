import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Plane, MapPin, Calendar, Users } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/seo";
import travelHero from "/assets/images/travels-hero-cote-dazur.webp";
import { isRetreatArchived, sortRetreatsForDisplay } from "@/lib/travelStatus";
import { RetreatArchivedBadge } from "@/components/travel/RetreatStatusBadge";
import { HeroBadge } from "@/components/shared/hero-badge";
import { HeroSearch } from "@/components/shared/hero-search";

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

  // Upcoming retreats first, ended ("Archived") ones after - see lib/travelStatus.ts.
  const filtered = sortRetreatsForDisplay(
    items.filter((p) => {
      const q = search.toLowerCase();
      return !q || p.title.toLowerCase().includes(q) || p.destination.toLowerCase().includes(q);
    }),
  );

  // Hero search: filtering is live as you type; the lime button takes you to the results.
  const scrollToResults = () =>
    document.getElementById("travel-results")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "TBA";

  return (
    <>
        <SEO
        title="Tennis Travel Packages | TennisConnect"
        description="Discover tennis holidays, tennis camps and travel experiences for players looking to combine travel with their passion for tennis."
        canonical="/travels"
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

      <main id="main-content">
      <div className="relative overflow-hidden">
        <picture>
          <source media="(max-width: 639px)" srcSet="/assets/images/travels-hero-cote-dazur-mobile.webp" />
          <img
            src={travelHero}
            alt="Tennis players walking down to clay courts above the Côte d'Azur"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover z-0 scale-125 md:scale-100"
          />
        </picture>
        {/* Tablet/desktop: the left half of the photo darkens towards the left edge (smooth, no hard line) so the title, intro and search stay readable. Phones keep the plain photo. */}
        <div aria-hidden="true" className="tc-hero-left-shade absolute inset-0 hidden md:block z-10" />
        <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />

        <div className="relative min-h-[28vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center md:items-start justify-start">
        {/* Badge (mobile) — overlaps the bottom edge of the hero photo */}
        <div className="md:hidden absolute bottom-3 left-4 z-20">
          <HeroBadge size="sm" icon={<Plane />}>Tennis Travel</HeroBadge>
        </div>
        <div className="relative z-20 container mx-auto px-4 text-left mt-24 md:mt-0 md:pt-[104px]">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="hidden md:block">
            <HeroBadge icon={<Plane />} className="mb-6">Tennis Travel</HeroBadge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-display font-bold mb-4 tracking-tight text-white tc-hero-text">
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
            <p className="text-lg md:text-[20px] md:leading-[1.3] text-white max-w-2xl font-medium tc-hero-intro">
              Curated tennis getaways. Train with pros, recover in paradise.
            </p>
            <HeroSearch
              className="mt-6 max-w-3xl"
              value={search}
              onValueChange={setSearch}
              onSubmit={scrollToResults}
              placeholder="Search destinations..."
              inputTestId="travel-search-input"
              submitTestId="travel-search-submit"
            />
          </motion.div>
        </div>
        </div>

      <div className="pb-1.5 md:pb-16" />
      </div>

      {/* Hero text (mobile) — sits below the hero photo instead of
          overlapping it */}
      <div className="md:hidden relative z-20 bg-background pt-2 pb-1">
        <div className="container mx-auto px-4 text-left">
          <h1 className="text-3xl font-display font-bold mb-1 tracking-tight text-foreground">
            Train. Travel.{" "}
            <span className="relative inline-block text-primary-text">
              Transform.
              <svg
                className="absolute w-full h-3 -bottom-1 left-0 text-primary-text opacity-40"
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 5 Q 50 10 100 5"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
              </svg>
            </span>
          </h1>
          <p className="text-sm text-gray-600 max-w-2xl font-medium">
            Curated tennis getaways. Train with pros, recover in paradise.
          </p>
        </div>
      </div>

      {/* Search (mobile) - below the hero text, like the other pages */}
      <div className="md:hidden relative z-20 bg-background pt-1 pb-2">
        <div className="container mx-auto px-4">
          <HeroSearch
            tone="light"
            value={search}
            onValueChange={setSearch}
            onSubmit={scrollToResults}
            placeholder="Search destinations..."
            inputTestId="travel-search-input-mobile"
            submitTestId="travel-search-submit-mobile"
          />
        </div>
      </div>

      <div id="travel-results" className="relative z-30 container mx-auto px-4 pt-4 pb-12 md:py-12 md:-mt-4 scroll-mt-24">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Plane className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">No packages found</h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                data-testid={`travel-card-${p.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/travels/${p.slug}`}>
                  <Card className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full">
                    <div className="relative aspect-4/3 overflow-hidden bg-secondary/50">
                      <img
                        src={p.coverImage}
                        alt={p.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      {p.isFeatured && !isRetreatArchived(p) && (
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-primary text-foreground font-bold border-none">Featured</Badge>
                        </div>
                      )}
                      {isRetreatArchived(p) && (
                        <div className="absolute top-3 left-3">
                          <RetreatArchivedBadge />
                        </div>
                      )}
                      {!isRetreatArchived(p) && p.spotsLeft > 0 && p.spotsLeft <= 5 && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-red-500 text-white border-none">{p.spotsLeft} spots</Badge>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 text-white">
                        <h2 className="font-bold text-xl mb-1 line-clamp-1">{p.title}</h2>
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
                        <span className="text-sm font-bold text-primary-text group-hover:underline">View →</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      </main>
      <Footer />
    </div>
    </>
  );
}
