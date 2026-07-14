import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Clock, Search } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SEO from "@/components/seo";

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

        {/* Hero — shares one photo backdrop with the filter bar below */}
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=2000&auto=format&fit=crop)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />

          <div className="relative min-h-[24vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center justify-start">
          <div className="relative z-20 container mx-auto px-4 text-left mt-16 md:mt-20">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md mb-6">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-white">
                  Tennis Journal
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-4 tracking-tight text-white drop-shadow-md">
                Articles & <span className="text-primary">Insights</span>
              </h1>
              <p className="text-lg md:text-xl text-white/85 max-w-2xl font-light drop-shadow-sm">
                Tactics, gear, mind & body. Written for everyone who plays.
              </p>
            </motion.div>
          </div>
          </div>

        {/* Filter bar — floats over the tail of the photo */}
        <div className="relative z-20 mt-5 pb-20 md:pb-32">
          <div className="container mx-auto px-4">
            <div className="bg-card/70 backdrop-blur-lg border border-border/40 shadow-lg rounded-2xl p-3 md:p-4 flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                className="pl-10 h-11 bg-background/80 border-transparent focus:border-primary rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="articles-search-input"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer ${
                    category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/80 hover:bg-secondary border-input"
                  }`}
                  data-testid={`articles-category-${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
            </div>
          </div>
        </div>
        </div>

        {/* Grid — pulled up so the photo dissolves under the top row */}
        <div className="relative z-30 container mx-auto px-4 py-12 -mt-20 md:-mt-28">
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
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-black/80 text-white border-none">{a.category}</Badge>
                        </div>
                      </div>
                      <CardContent className="p-5">
                        <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
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

        <Footer />
      </div>
    </>
  );
}
