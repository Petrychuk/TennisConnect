import { useState } from "react";
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

// Landscape/default cover — a contained, moderately sized banner (matches
// the card/thumbnail sizing used across the site's dashboards), not a
// full viewport-height hero, but full-bleed edge-to-edge width.
const LANDSCAPE_COVER_HEIGHT = "h-[300px] sm:h-[380px] md:h-[460px] lg:h-[520px]";

const READING_COLUMN = "max-w-3xl md:max-w-4xl";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function MetaRow({ article, light }: { article: Article; light?: boolean }) {
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
 * already has. Breadcrumbs, title and excerpt are overlaid on the cover
 * for every category. A portrait/vertical cover switches to a dedicated
 * split layout instead of being cropped into a wide banner.
 */
export function ArticleDetailContent({
  article,
  relatedArticles = [],
}: ArticleDetailContentProps) {
  const [isPortrait, setIsPortrait] = useState(false);

  const tags = (article.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleCoverLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setIsPortrait(img.naturalHeight > img.naturalWidth * 1.1);
  };

  const hasCover = !!article.coverImage;

  return (
    <>
      {hasCover && isPortrait ? (
        // Portrait cover — a dedicated split layout instead of cropping a
        // vertical photo into a wide horizontal banner.
        <div className="pt-20 md:pt-24 bg-secondary/10 border-b">
          <div className="container mx-auto px-4 py-8 md:py-12">
            <ArticleBreadcrumbs category={article.category} title={article.title} />

            <div className="grid md:grid-cols-5 gap-8 md:gap-12 items-center mt-6 md:mt-8">
              <div className="md:col-span-2">
                <div className="relative aspect-3/4 max-h-[560px] mx-auto md:mx-0 overflow-hidden rounded-2xl md:rounded-3xl shadow-lg bg-secondary/40">
                  <img
                    src={article.coverImage}
                    alt={article.title}
                    onLoad={handleCoverLoad}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="md:col-span-3"
              >
                <Badge className="mb-4 bg-primary text-primary-foreground">
                  {article.category}
                </Badge>
                <h1
                  className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4 leading-tight"
                  data-testid="article-title"
                >
                  {article.title}
                </h1>
                <MetaRow article={article} />
                {article.excerpt && (
                  <p className="text-lg text-muted-foreground leading-relaxed mt-5">
                    {article.excerpt}
                  </p>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      ) : hasCover ? (
        // Default cover — full-bleed, breadcrumbs/title/excerpt overlaid.
        // Top + bottom scrims are always on, so white text stays legible
        // no matter how bright the underlying photo is.
        <div className={`relative w-full ${LANDSCAPE_COVER_HEIGHT} overflow-hidden bg-secondary/40`}>
          <img
            src={article.coverImage}
            alt={article.title}
            onLoad={handleCoverLoad}
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute inset-x-0 top-0 h-28 md:h-32 bg-linear-to-b from-black/65 via-black/25 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

          <div className="absolute inset-x-0 top-0 pt-16">
            <div className={`container mx-auto px-4 ${READING_COLUMN} pt-4`}>
              <ArticleBreadcrumbs category={article.category} title={article.title} light />
            </div>
          </div>

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
                {article.excerpt && (
                  <p className="text-white/90 mt-3 max-w-2xl leading-relaxed">
                    {article.excerpt}
                  </p>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      ) : (
        // No cover image — plain, normal-flow header.
        <div className="border-b bg-secondary/10">
          <div className={`container mx-auto px-4 ${READING_COLUMN} pt-20 pb-8 md:pt-24 md:pb-10`}>
            <ArticleBreadcrumbs category={article.category} title={article.title} />

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-6"
            >
              <Badge className="mb-3 bg-primary text-primary-foreground">
                {article.category}
              </Badge>
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-3 leading-tight"
                data-testid="article-title"
              >
                {article.title}
              </h1>
              <MetaRow article={article} />
              {article.excerpt && (
                <p className="text-lg text-muted-foreground leading-relaxed mt-5">
                  {article.excerpt}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      )}

      {/* Content starts right after the hero — no separator */}
      <div className={`container mx-auto px-4 ${READING_COLUMN} py-8 md:py-12`}>
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
