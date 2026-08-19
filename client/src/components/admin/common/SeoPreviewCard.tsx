interface SeoPreviewCardProps {
  // The exact title/description that will actually be used - callers pass
  // the SEO override if the admin filled it in, falling back to whatever
  // the public page itself would fall back to (e.g. the item's own
  // title/excerpt), so this always reflects reality.
  title: string;
  description: string;
  // Full path this item will actually be reachable at, e.g.
  // "/articles/my-post-slug" or "/travels/bali-tennis-retreat".
  path: string;
}

// Same visual pattern as the existing Club Communities SEO preview
// (ClubSeoSection.tsx) - kept as its own small component here so Articles
// and Travel Packages can share it instead of copy-pasting the markup a
// second and third time.
export function SeoPreviewCard({ title, description, path }: SeoPreviewCardProps) {
  return (
    <div
      className="rounded-2xl border bg-muted/30 p-6"
      data-testid="admin-seo-preview"
    >
      <h3 className="font-semibold">Google Search Preview</h3>

      <p className="mt-1 text-sm text-muted-foreground">
        This is approximately how this page may appear in Google Search.
      </p>

      <div className="mt-6 rounded-xl border bg-background p-5">
        <p className="text-xs text-green-700">
          www.tennisconnect.com.au{path}
        </p>

        <h4 className="mt-2 text-lg font-semibold text-blue-700 line-clamp-1">
          {title || "Page title"}
        </h4>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {description || "Your page description will appear here."}
        </p>
      </div>
    </div>
  );
}
