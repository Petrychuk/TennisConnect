// The Admin sections of the Organiser Hub - one source for the sidebar
// label, the page title (the page is called what the menu item says),
// the one-line description under it and the singular "New ..." label.

export type AdminSectionKey =
  | "users"
  | "organizer-requests"
  | "clubs"
  | "travel"
  | "articles"
  | "recreation"
  | "discovery";

export interface AdminSection {
  /** Sidebar label = page title. */
  title: string;
  description: string;
  /** Label of the create button, singular ("New article"). */
  createLabel?: string;
  href: string;
}

export const ADMIN_SECTIONS: Record<AdminSectionKey, AdminSection> = {
  users: {
    title: "Users",
    description: "Approve, hide and manage player and coach accounts and organiser access.",
    href: "/admin?tab=users",
  },
  "organizer-requests": {
    title: "Organiser & Sessions",
    description: "Review organiser access requests and sessions before they go live.",
    href: "/admin?tab=organizer-requests",
  },
  clubs: {
    title: "Club Communities",
    description: "Create and edit club and community listings.",
    createLabel: "New club",
    href: "/admin?tab=clubs",
  },
  travel: {
    title: "Travel Packages",
    description: "Create, edit and publish tennis travel packages.",
    createLabel: "New package",
    href: "/admin?tab=travel",
  },
  articles: {
    title: "Articles",
    description: "Write, edit and publish Journal articles and legal pages.",
    createLabel: "New article",
    href: "/admin?tab=articles",
  },
  recreation: {
    title: "Recreation Services",
    description: "Manage recovery and wellness services.",
    createLabel: "New service",
    href: "/admin?tab=recreation",
  },
  discovery: {
    title: "Discovery",
    description: "Review and manage tennis activities discovered across Australia.",
    href: "/admin/discovery",
  },
};
