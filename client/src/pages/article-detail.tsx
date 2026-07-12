import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import SEO from "@/components/seo";
import {
  ArticleDetailContent,
  type Article,
} from "@/components/articles/ArticleDetailContent";

export default function ArticleDetailPage() {
  const [, params] = useRoute("/articles/:slug");
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;
    window.scrollTo(0, 0);
    setArticle(null);
    setRelatedArticles([]);
    setNotFound(false);

    fetch(`/api/articles/${params.slug}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Article) => {
        setArticle(data);

        fetch("/api/articles", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : []))
          .then((all: Article[]) => {
            setRelatedArticles(
              (all || [])
                .filter((a) => a.id !== data.id && a.category === data.category)
                .slice(0, 3)
            );
          })
          .catch(() => setRelatedArticles([]));
      })
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
   <>
     <SEO
        title={article.seoTitle || article.title}
        description={
          article.metaDescription ||
          article.excerpt ||
          article.title
        }
        canonical={`/articles/${article.slug}`}
        tags={(article.tags || "").split(",").map((t) => t.trim()).filter(Boolean)}
        type="article"
      />
        <div className="min-h-screen bg-background font-sans">         
          <Navbar />

          <ArticleDetailContent article={article} relatedArticles={relatedArticles} />

          <Footer />
        </div>
   </>
  );
}
