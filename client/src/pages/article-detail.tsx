import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, BookOpen } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author: string;
  readTime: number;
  createdAt: string;
}

export default function ArticleDetailPage() {
  const [, params] = useRoute("/articles/:slug");
  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;
    window.scrollTo(0, 0);
    fetch(`/api/articles/${params.slug}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setArticle)
      .catch(() => setNotFound(true));
  }, [params?.slug]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Article not found</h1>
            <Link href="/articles">
              <Button className="bg-primary text-primary-foreground">Back to articles</Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      {/* Hero image */}
      <div className="relative h-[50vh] md:h-[60vh] mt-16 overflow-hidden">
        <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4 max-w-3xl -mt-32 relative z-10">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/articles">
            <Button variant="ghost" className="mb-6 gap-2 cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> All Articles
            </Button>
          </Link>

          <Badge className="mb-4 bg-primary text-primary-foreground">{article.category}</Badge>

          <h1 className="text-3xl md:text-5xl font-display font-bold mb-6 leading-tight" data-testid="article-title">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b">
            <span className="font-bold">{article.author}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {article.readTime} min read
            </span>
            <span>•</span>
            <span>{new Date(article.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>

          <p className="text-xl text-muted-foreground mb-8 leading-relaxed font-light">{article.excerpt}</p>

          <div
            className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-display prose-headings:font-bold prose-a:text-primary"
            dangerouslySetInnerHTML={{
              __html: article.content
                .split("\n")
                .map((line) => {
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return `<h3>${line.slice(2, -2)}</h3>`;
                  }
                  if (/^\d+\.\s/.test(line)) {
                    const m = line.match(/^(\d+)\.\s\*\*([^*]+)\*\*\s*(.*)/);
                    if (m) return `<p><strong>${m[1]}. ${m[2]}</strong> — ${m[3]}</p>`;
                  }
                  if (line.includes("**")) {
                    return `<p>${line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`;
                  }
                  return line.trim() ? `<p>${line}</p>` : "";
                })
                .join(""),
            }}
          />
        </motion.div>

        <div className="my-16 p-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl text-center">
          <BookOpen className="w-10 h-10 mx-auto text-primary mb-3" />
          <h3 className="text-2xl font-bold mb-2">More tennis wisdom</h3>
          <p className="text-muted-foreground mb-6">Explore our full library of articles.</p>
          <Link href="/articles">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-6 cursor-pointer">
              Browse All Articles
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
