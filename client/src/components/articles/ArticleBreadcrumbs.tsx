import { Link } from "wouter";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface ArticleBreadcrumbsProps {
  category: string;
  title: string;
  // White text, for when breadcrumbs sit on top of the cover image
  // instead of on a plain background.
  light?: boolean;
}

export function ArticleBreadcrumbs({ category, title, light }: ArticleBreadcrumbsProps) {
  const base = light
    ? "text-white/80 [&_svg]:opacity-90"
    : "text-muted-foreground";
  const link = light
    ? "cursor-pointer hover:text-white hover:underline underline-offset-4"
    : "cursor-pointer hover:text-primary hover:underline underline-offset-4";
  const current = light ? "text-white" : undefined;

  return (
    <Breadcrumb data-testid="article-breadcrumbs">
      <BreadcrumbList className={`flex-nowrap ${base}`}>
        <BreadcrumbItem>
          <Link href="/" className={`flex items-center gap-1 transition-colors ${link}`}>
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <Link href="/articles" className={`transition-colors ${link}`}>
            Articles
          </Link>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <Link
            href={`/articles?category=${encodeURIComponent(category)}`}
            className={`transition-colors ${link}`}
          >
            {category}
          </Link>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className={`block max-w-[140px] sm:max-w-[280px] md:max-w-sm truncate ${current || ""}`}>
            {title}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
