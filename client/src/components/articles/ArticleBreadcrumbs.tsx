import { Link } from "wouter";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
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
  const link = light ? "hover:text-white" : "hover:text-primary";
  const current = light ? "text-white" : undefined;

  return (
    <Breadcrumb data-testid="article-breadcrumbs">
      <BreadcrumbList className={`flex-nowrap ${base}`}>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className={`flex items-center gap-1 ${link}`}>
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/articles" className={link}>
              Articles
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`/articles?category=${encodeURIComponent(category)}`} className={link}>
              {category}
            </Link>
          </BreadcrumbLink>
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
