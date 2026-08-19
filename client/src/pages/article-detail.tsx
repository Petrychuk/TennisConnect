import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import SEO from "@/components/seo";
import {
  ArticleDetailContent,
  type Article,
  type RelatedArticle,
} from "@/components/articles/ArticleDetailContent";

export default function ArticleDetailPage() {
  const [, params] = useRoute("/articles/:slug");
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params?.slug) return;
    window.scrollTo(0, 0);
    setArticle(null);
    setRelatedArticles([]);
    setNotFound(false);

    // Fetch the article and its related-articles list in parallel instead
    // of waiting for the article to finish before even starting the
    // second request - that waterfall was adding a full extra round-trip
    // to how long the page took to fully render.
    fetch(`/api/articles/${params.slug}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Article) => setArticle(data))
      .catch(() => setNotFound(true));

    fetch(`/api/articles/${params.slug}/related`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((related: RelatedArticle[]) => setRelatedArticles(related || []))
      .catch(() => setRelatedArticles([]));
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
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        {/* A skeleton for the content area, not a blank screen with the
            Navbar missing too - the shell renders immediately either way,
            so this is the only part actually waiting on the fetch. */}
        <div className="container mx-auto px-4 pt-28 pb-16 max-w-3xl md:max-w-4xl animate-pulse">
          <div className="h-4 w-24 bg-muted rounded mb-6" />
          <div className="h-10 w-3/4 bg-muted rounded mb-4" />
          <div className="h-4 w-1/3 bg-muted rounded mb-8" />
          <div className="h-[300px] sm:h-[380px] md:h-[460px] bg-muted rounded-2xl mb-8" />
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        </div>
        <Footer />
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
