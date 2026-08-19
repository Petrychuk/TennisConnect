// client/src/components/SEO.tsx

import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  tags?: string[];
  type?: "website" | "article";
  noIndex?: boolean;
}

export default function SEO({
  title,
  description,
  canonical,
  image = "https://www.tennisconnect.com.au/og-image.jpg",
  tags = [],
  type = "website",
  noIndex = false,
}: SEOProps) {
  // Falls back to the current route when a page forgets to pass its own
  // canonical - every page ends up with a correct <link rel="canonical">
  // by default instead of silently having none at all.
  const [currentPath] = useLocation();
  const canonicalPath = canonical ?? currentPath;

  const schema = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "Article" : "WebPage",
    headline: title,
    description,
    keywords: tags,
    url: `https://www.tennisconnect.com.au${canonicalPath}`,
    image,
  };

  return (
    <Helmet>
      {/* =========================
          BASIC SEO
      ========================= */}

      <title>{title}</title>

      <meta
        name="description"
        content={description}
      />

     <meta
        name="robots"
        content={noIndex ? "noindex,nofollow" : "index,follow"}
     />

      {/* =========================
          CANONICAL

          "www" is the domain the site now redirects the bare apex to
          (see server/index.ts) and the one GA4's stream is set up for -
          this must match, or search engines get the exact opposite
          signal from what the redirect itself says.
      ========================= */}

      <link
        rel="canonical"
        href={`https://www.tennisconnect.com.au${canonicalPath}`}
      />

      {/* =========================
          OPEN GRAPH
      ========================= */}

      <meta
        property="og:type"
        content={type}
      />

      <meta
        property="og:title"
        content={title}
      />

      <meta
        property="og:description"
        content={description}
      />

      <meta
        property="og:image"
        content={image}
      />

      <meta
        property="og:url"
        content={`https://www.tennisconnect.com.au${canonicalPath}`}
      />

      {/* =========================
          TWITTER / X
      ========================= */}

      <meta
        name="twitter:card"
        content="summary_large_image"
      />

      <meta
        name="twitter:title"
        content={title}
      />

      <meta
        name="twitter:description"
        content={description}
      />

      <meta
        name="twitter:image"
        content={image}
      />

      {/* =========================
          SCHEMA.ORG
      ========================= */}

      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}