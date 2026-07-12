import { Link } from "wouter";
import { motion } from "framer-motion";
import { Clock, Calendar, BookOpen, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArticleBreadcrumbs } from "./ArticleBreadcrumbs";
import { ArticleRichContent } from "./ArticleRichContent";

export interface Article {
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

  seoTitle?: string;
  metaDescription?: string;
  // Stored as a single free-text field in the CMS (e.g. "tennis, training"),
  // not a real array column — split for display.
  tags?: string;
  isPublished?: boolean;
}

interface ArticleDetailContentProps {
  article: Article;
  relatedArticles?: Article[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The body of the Article detail page (everything that sits between the
 * Navbar and the Footer). Shared by the public `/articles/:slug` page and
 * the admin `/admin/articles/:slug/preview` page so the preview is a
 * pixel-accurate representation of what will go live.
 *
 * One universal template, filled from the same CMS fields every article
 * already has — sections (tags, related articles) simply don't render
 * when there's no data for them.
 */
export function ArticleDetailContent({
  article,
  relatedArticles = [],
}: ArticleDetailContentProps) {
  const tags = (article.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <>
      {/* Breadcrumbs */}
      <div className="border-b bg-secondary/20">
        <div className="container mx-auto px-4 pt-20 pb-4 md:pt-24">
          <ArticleBreadcrumbs category={article.category} title={article.title} />
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl py-8 md:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Badge className="mb-4 bg-primary text-primary-foreground">
            {article.category}
          </Badge>

          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-5 leading-tight"
            data-testid="article-title"
          >
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-6">
            <span className="font-semibold text-foreground">{article.author}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {formatDate(article.createdAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {article.readTime} min read
            </span>
          </div>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-light mb-8">
            {article.excerpt}
          </p>
        </motion.div>

        {/* Cover image — a contained, moderately sized banner (matches the
            card/thumbnail sizing used across the site's dashboards),
            not a full viewport-height hero. object-cover keeps a clean
            crop for both landscape and portrait covers. */}
        {article.coverImage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="
              relative
              h-[220px] sm:h-[300px] md:h-[380px] lg:h-[440px]
              w-full
              overflow-hidden
              rounded-2xl md:rounded-3xl
              shadow-lg
              mb-10
              bg-secondary/40
            "
          >
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        {/* Content */}
        <ArticleRichContent content={article.content} />

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="my-14 p-8 md:p-10 bg-linear-to-br from-primary/10 to-primary/5 rounded-3xl text-center">
          <BookOpen className="w-10 h-10 mx-auto text-primary mb-3" />
          <h3 className="text-2xl font-display font-bold mb-2">
            More tennis wisdom
          </h3>
          <p className="text-muted-foreground mb-6">
            Explore our full library of articles.
          </p>
          <Link href="/articles">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-6 cursor-pointer">
              Browse All Articles
            </Button>
          </Link>
        </div>
      </div>

      {/* Related Articles — only rendered when there's something to show */}
      {relatedArticles.length > 0 && (
        <div className="border-t bg-secondary/20">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-display font-bold">
                Related Articles
              </h2>
              <Link
                href="/articles"
                className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedArticles.map((a) => (
                <Link key={a.id} href={`/articles/${a.slug}`}>
                  <div className="group overflow-hidden rounded-2xl bg-card border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                    <div className="relative aspect-4/3 overflow-hidden bg-secondary/50">
                      <img
                        src={a.coverImage}
                        alt={a.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
                        {a.title}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {a.readTime} min read
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
