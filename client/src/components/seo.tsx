// client/src/components/SEO.tsx

import { Helmet } from "react-helmet-async";

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
  image = "https://tennisconnect.com.au/og-image.jpg",
  tags = [],
  type = "website",
  noIndex = false,
}: SEOProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "Article" : "WebPage",
    headline: title,
    description,
    keywords: tags,
    url: canonical
      ? `https://tennisconnect.com.au${canonical}`
      : undefined,
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
      ========================= */}

      {canonical && (
        <link
          rel="canonical"
          href={`https://tennisconnect.com.au${canonical}`}
        />
      )}

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

      {canonical && (
        <meta
          property="og:url"
          content={`https://tennisconnect.com.au${canonical}`}
        />
      )}

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