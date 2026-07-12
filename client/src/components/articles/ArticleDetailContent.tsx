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

// Cover height — a contained, moderately sized banner (matches the
// card/thumbnail sizing used across the site's dashboards), not a full
// viewport-height hero, but full-bleed edge-to-edge width.
const COVER_HEIGHT =
  "h-[260px] sm:h-[340px] md:h-[420px] lg:h-[480px]";

const READING_COLUMN = "max-w-3xl md:max-w-4xl";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function MetaRow({
  article,
  light,
}: {
  article: Article;
  light?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${
        light ? "text-white/85" : "text-muted-foreground"
      }`}
    >
      <span className={`font-semibold ${light ? "text-white" : "text-foreground"}`}>
        {article.author}
      </span>
      <span className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" /> {formatDate(article.createdAt)}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> {article.readTime} min read
      </span>
    </div>
  );
}

/**
 * The body of the Article detail page (everything that sits between the
 * Navbar and the Footer). Shared by the public `/articles/:slug` page and
 * the admin `/admin/articles/:slug/preview` page so the preview is a
 * pixel-accurate representation of what will go live.
 *
 * One universal template, filled from the same CMS fields every article
 * already has. Legal-category documents get a quiet, minimal treatment
 * (title on the cover, plain body); every other category gets a bigger,
 * more editorial presentation — same engine, different presentation.
 */
export function ArticleDetailContent({
  article,
  relatedArticles = [],
}: ArticleDetailContentProps) {
  const isLegal = article.category === "Legal";

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

      {/* Fallback: if a Legal article has no cover image, there's nowhere
          to overlay the title onto — show it in normal flow instead. */}
      {isLegal && !article.coverImage && (
        <div className={`container mx-auto px-4 ${READING_COLUMN} pt-8`}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge className="mb-3 bg-primary text-primary-foreground">
              {article.category}
            </Badge>
            <h1
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-3 leading-tight"
              data-testid="article-title"
            >
              {article.title}
            </h1>
            <MetaRow article={article} />
          </motion.div>
        </div>
      )}

      {/* Cover — full-bleed, right after breadcrumbs. Legal documents get
          the title overlaid here; other categories keep the image clean
          and introduce the title below. */}
      {article.coverImage && (
        <div className={`relative w-full ${COVER_HEIGHT} overflow-hidden bg-secondary/40`}>
          <img
            src={article.coverImage}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {isLegal && (
            <>
              <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/45 to-black/10" />
              <div className="absolute inset-0 flex items-end">
                <div className={`container mx-auto px-4 ${READING_COLUMN} pb-6 md:pb-10`}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Badge className="mb-3 bg-primary text-primary-foreground">
                      {article.category}
                    </Badge>
                    <h1
                      className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-3 leading-tight"
                      data-testid="article-title"
                    >
                      {article.title}
                    </h1>
                    <MetaRow article={article} light />
                  </motion.div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className={`container mx-auto px-4 ${READING_COLUMN} py-8 md:py-12`}>
        {/* Header — non-Legal categories get their title/meta below the
            cover instead of overlaid, with a bolder editorial treatment. */}
        {!isLegal && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <Badge className="mb-4 bg-primary text-primary-foreground">
              {article.category}
            </Badge>

            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-5 leading-[1.05]"
              data-testid="article-title"
            >
              {article.title}
            </h1>

            <MetaRow article={article} />
          </motion.div>
        )}

        {/* Legal gets a plain lead line; other categories get a bolder
            pull-quote style excerpt. */}
        {article.excerpt &&
          (isLegal ? (
            <p className="text-lg text-muted-foreground mb-10 pb-8 border-b">
              {article.excerpt}
            </p>
          ) : (
            <blockquote className="border-l-4 border-primary pl-5 md:pl-6 mb-10 text-xl md:text-2xl font-display font-medium leading-snug text-foreground/90">
              {article.excerpt}
            </blockquote>
          ))}

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
