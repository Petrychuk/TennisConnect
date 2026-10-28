import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Clock, Dumbbell, Backpack, HeartPulse, Newspaper } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/seo";
import { HeroBadge } from "@/components/shared/hero-badge";
import { HeroSearch, HeroShortcuts, type HeroShortcut } from "@/components/shared/hero-search";

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  category: string;
  author: string;
  readTime: number;
  createdAt: string;

  seoTitle?: string;
  metaDescription?: string;
  tags?: string[];
}

const CATEGORIES = ["All", "Training", "Equipment", "Health", "News"];

function getInitialCategory(): string {
  if (typeof window === "undefined") return "All";
  const cat = new URLSearchParams(window.location.search).get("category");
  return cat && CATEGORIES.includes(cat) ? cat : "All";
}

export default function ArticlesPage() {
  const [items, setItems] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(getInitialCategory);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch("/api/articles", { credentials: "include" })
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filtered = items.filter((a) => {
    const matchCat = category === "All" || a.category === category;
    const q = search.toLowerCase();
    const matchSearch =
      !q || a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  // Hero search (presentational - same state and filtering as before).
  const scrollToResults = () =>
    document.getElementById("articles-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Shortcuts = the existing category filter. Tapping the selected one
  // goes back to "All".
  const CATEGORY_ICONS: Record<string, ReactNode> = {
    Training: <Dumbbell />,
    Equipment: <Backpack />,
    Health: <HeartPulse />,
    News: <Newspaper />,
  };
  const shortcutItems = (testIdPrefix = ""): HeroShortcut[] =>
    CATEGORIES.filter((c) => c !== "All").map((c) => ({
      key: c,
      label: c,
      icon: CATEGORY_ICONS[c],
      selected: category === c,
      onClick: () => setCategory(category === c ? "All" : c),
      testId: `articles-category-${testIdPrefix}${c}`,
    }));

  return (
   <>
    <SEO
      title="Tennis Articles & News | TennisConnect"
      description="Read tennis articles, training tips, coaching advice, equipment reviews and the latest tennis news."
      canonical="/articles"
      tags={[
        "tennis articles",
        "tennis blog",
        "tennis training",
        "tennis tips",
        "tennis news",
        "tennis coaching",
      ]}
    />
      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        <main id="main-content">
        {/* Hero — shares one photo backdrop with the filter bar below */}
        <div className="relative overflow-hidden">
          <img
            src="/assets/images/Dashboard_articles.webp"
            alt="Tennis articles"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover z-0 scale-125 md:scale-100"
          />
          {/* Tablet/desktop: the left half of the photo darkens towards the left edge (smooth, no hard line) so the title, intro and search stay readable. Phones keep the plain photo. */}
          <div aria-hidden="true" className="tc-hero-left-shade absolute inset-0 hidden md:block z-10" />
          <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />

          <div className="relative min-h-[28vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center md:items-start justify-start">
          {/* Badge (mobile) — overlaps the bottom edge of the hero photo */}
          <div className="md:hidden absolute bottom-3 left-4 z-20">
            <HeroBadge size="sm" icon={<BookOpen />}>Tennis Journal</HeroBadge>
          </div>
          <div className="relative z-20 container mx-auto px-4 text-left mt-24 md:mt-0 md:pt-[104px]">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="hidden md:block">
              <HeroBadge icon={<BookOpen />} className="mb-6">Tennis Journal</HeroBadge>
              <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-display font-bold mb-4 tracking-tight text-white tc-hero-text">
                Articles &{" "}
                <span className="relative inline-block text-primary">
                  Insights
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
                Tactics, gear, mind & body. Written for everyone who plays.
              </p>
              <HeroSearch
                className="mt-6 max-w-3xl"
                value={search}
                onValueChange={setSearch}
                onSubmit={scrollToResults}
                placeholder="Search articles..."
                inputTestId="articles-search-input"
                submitTestId="articles-search-submit"
              />
              <HeroShortcuts label="Article categories" items={shortcutItems()} className="mt-6" />
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
              Articles &{" "}
              <span className="relative inline-block text-primary-text">
                Insights
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
              Tactics, gear, mind & body. Written for everyone who plays.
            </p>
          </div>
        </div>

        {/* Search (mobile) - below the hero text, like the other pages */}
        <div className="md:hidden relative z-20 bg-background pt-1 pb-3">
          <div className="container mx-auto px-4">
            <HeroSearch
              tone="light"
              value={search}
              onValueChange={setSearch}
              onSubmit={scrollToResults}
              placeholder="Search articles..."
              inputTestId="articles-search-input-mobile"
              submitTestId="articles-search-submit-mobile"
            />
            <HeroShortcuts label="Article categories" tone="light" items={shortcutItems("mobile-")} className="mt-3" />
          </div>
        </div>

        {/* Grid — pulled up so the photo dissolves under the top row */}
        <div id="articles-results" className="relative z-30 container mx-auto px-4 pt-6 pb-12 md:py-12 md:-mt-4 scroll-mt-24">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-bold mb-2">No articles found</h3>
              <p className="text-muted-foreground">Try adjusting your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((a, i) => (
                <motion.div
                  key={a.id}
                  data-testid={`article-card-${a.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/articles/${a.slug}`}>
                    <Card className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full">
                      <div className="relative aspect-4/3 overflow-hidden bg-secondary/50">
                        <img
                          src={a.coverImage}
                          alt={a.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-black/80 text-white border-none">{a.category}</Badge>
                        </div>
                      </div>
                      <CardContent className="p-5">
                        <h3 className="font-bold text-lg mb-2 group-hover:text-primary-text transition-colors line-clamp-2 min-h-[3.5rem]">
                          {a.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{a.excerpt}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium">{a.author}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {a.readTime} min
                          </span>
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
