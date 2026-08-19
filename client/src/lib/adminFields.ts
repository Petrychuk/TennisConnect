export type Resource =
  | "articles"
  | "travel"
  | "recreation"
  | "clubs";

export type AdminTab = Resource | "users" | "organizer-requests";

export function isContentTab(tab: AdminTab): tab is Resource {
  return tab !== "users" && tab !== "organizer-requests";
}

export const RESOURCE_LABELS: Record<Resource, string> = {
  clubs: "Club Communities",
  travel: "Travel Packages",
  articles: "Articles",
  recreation: "Recreation Services",
};

export interface AdminFieldDef {
  name: string;
  label?: string;
  type: "text" | "textarea" | "number" | "list" | "select" | "checkbox";
  required?: boolean;
  help?: string;
  options?: string[];
  // When set, the field renders a live "N / maxLength" character counter
  // (turns red past the limit), enforces the limit via the input's own
  // native maxLength attribute, and trims leading/trailing whitespace on
  // blur. Used for SEO fields (Meta Title/Description) so a content
  // manager sees and can't exceed the limit before ever submitting, in
  // plain terms instead of the raw Zod validation message.
  maxLength?: number;
}

// Field definitions per resource
export const FIELDS: Record<Resource, AdminFieldDef[]> = {
  articles: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true },
    { name: "category", type: "select", required: true,
      options: [
        "Training",
        "Coaching",
        "Equipment",
        "Health",
        "Fitness",
        "Nutrition",
        "Mental Game",
        "Tournaments",
        "Travel",
        "Community",
        "News",
        "Legal",
      ],
    },
    { name: "legalType", type: "select",
      options: [
        "Privacy Policy",
        "Terms & Conditions",
        "Community Guidelines & Safety",
        "Cookie Policy",
        "Partner Disclosure & Affiliate Disclosure",
        "Refund Policy",
      ],
    },
    { name: "author", type: "text", required: true },
    { name: "excerpt", type: "textarea", required: true },
    { name: "content", type: "textarea", required: true },
    { name: "coverImage", type: "text", required: true, help: "Image URL" },
    { name: "readTime", type: "number", help: "Minutes" },
    { name: "seoTitle", type: "text", maxLength: 70, help: "Recommended length: 50–70 characters." },
    { name: "metaDescription", type: "textarea", maxLength: 160, help: "Recommended length: 140–160 characters." },
    { name: "tags", type: "text" },
  ],
  travel: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: false, help: "Leave blank to auto-generate"},
    { name: "destination", type: "text", required: true },
    { name: "duration", type: "text", required: true, help: "e.g. 7 days" },
    { name: "price", type: "number", required: true },
    { name: "currency", type: "text", help: "AUD" },
    { name: "description", type: "textarea", required: true },
    { name: "highlights", type: "list", help: "Comma separated" },
    { name: "includes", type: "list", help: "Comma separated" },
    { name: "coverImage", type: "text", required: true, help: "Image URL" },
    { name: "gallery", type: "list", help: "Image URLs (max 10)" },
    { name: "providerName", type: "text" },
    { name: "providerWebsite", type: "text" },
    { name: "providerLogo", type: "text", help: "Logo URL" },
    { name: "ctaText", type: "text", help: "Book Now / Learn More" },
    { name: "ctaUrl", type: "text", help: "External booking page" },
    { name: "tags", type: "list", help: "Comma separated" },
    { name: "seoTitle", type: "text", maxLength: 70, help: "Recommended length: 50–70 characters." },
    {
      name: "metaDescription",
      type: "textarea",
      maxLength: 160,
      help: "Recommended length: 140–160 characters.",
    },
    {
      name: "content",
      type: "textarea",
      help: "Full package details",
    },
    { name: "startDate", type: "text", help: "YYYY-MM-DD" },
    { name: "spotsLeft", type: "number" },
    {
      name: "isFeatured",
      label: "Featured Package",
      type: "checkbox",
    }
  ],
  recreation: [
    { name: "name", type: "text", required: true },
    { name: "type", type: "text", required: true, help: "Massage | Recovery | Yoga | Physio" },
    { name: "provider", type: "text", required: true },
    { name: "location", type: "text", required: true },
    { name: "duration", type: "text", required: true, help: "e.g. 60 min" },
    { name: "price", type: "number", required: true },
    { name: "currency", type: "text" },
    { name: "description", type: "textarea", required: true },
    { name: "benefits", type: "list", help: "Comma separated" },
    { name: "coverImage", type: "text", required: true, help: "Image URL" },
    { name: "rating", type: "text" },
    { name: "phone", type: "text" },
    { name: "email", type: "text" },
  ],
  clubs: [
    {
      name: "name",
      type: "text",
      required: true,
    },
  ],
};
