import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, real,  numeric, unique, } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  CLUB_CATEGORIES,
  CLUB_LISTING_TYPES,
  CLUB_STATUS,
  COURT_SURFACES,
  CLUB_SERVICES,
  HOSTED_COMPETITION_TYPES,
  CONTACT_PERSON_ROLES,
} from "./constants/clubs";
import { type RegistrationStatus as RegistrationStatusType } from "./constants/sessions";
import {
  ORGANIZATION_TYPES,
  ORGANIZATION_LISTING_TYPES,
  ORGANIZATION_STATUSES,
  ORGANIZATION_MEMBER_ROLES,
} from "./constants/organizations";

// Users table - core authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'player' or 'coach'
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  avatar: text("avatar"),
  cover: text("cover"),
  status: varchar("status", { length: 50 }).default("active"),
  profileCompleted: boolean("profile_completed").default(false).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  // Granted once an Organizer Request is approved by an admin. Lets a
  // user create an Organization and run Sessions (TC Play Hub / TC Live).
  isOrganizer: boolean("is_organizer").default(false).notNull(),
  isApproved: boolean("is_approved")
  .default(false)
  .notNull(),
  isTestUser: boolean("is_test_user")
  .default(false)
  .notNull(),
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Articles - blog posts about tennis
export const articles = pgTable("articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: text("title").notNull(),
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  tags: text("tags"),
  legalType: text("legal_type"),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  category: text("category").notNull(), // 'Training', 'Equipment', 'News', 'Health'
  author: text("author").notNull(),
  readTime: integer("read_time").default(5).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Travel Packages - tennis tour packages
export const travelPackages = pgTable("travel_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: text("title").notNull(),
  destination: text("destination").notNull(),
  duration: text("duration").notNull(),
  price: integer("price").notNull(),
  currency: varchar("currency", { length: 8 })
    .default("AUD")
    .notNull(),
  description: text("description").notNull(),
  content: text("content"),
  highlights: json("highlights").$type<string[]>().default([]),
  includes: json("includes").$type<string[]>().default([]),
  coverImage: text("cover_image"),
  gallery: json("gallery").$type<string[]>().default([]),
  providerName: text("provider_name"),
  providerWebsite: text("provider_website"),
  providerLogo: text("provider_logo"),
  tags: json("tags").$type<string[]>().default([]),
  ctaText: text("cta_text"),
  ctaUrl: text("cta_url"),
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  startDate: text("start_date"),
  spotsLeft: integer("spots_left")
    .default(10)
    .notNull(),
  isFeatured: boolean("is_featured")
    .default(false)
    .notNull(),
  isActive: boolean("is_active")
    .default(true)
    .notNull(),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

// Recreation Services - massage / recovery / wellness
export const recreationServices = pgTable("recreation_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'Massage', 'Recovery', 'Yoga', 'Physio'
  provider: text("provider").notNull(),
  location: text("location").notNull(),
  duration: text("duration").notNull(), // e.g. "60 min"
  price: integer("price").notNull(),
  currency: varchar("currency", { length: 8 }).default("AUD").notNull(),
  description: text("description").notNull(),
  benefits: json("benefits").$type<string[]>().default([]),
  coverImage: text("cover_image").notNull(),
  rating: text("rating"),
  phone: text("phone"),
  email: text("email"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tournaments (events) - separate from tournamentHistory (which is per-user history)
export const tournaments = pgTable("tournaments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  location: text("location").notNull(),
  address: text("address"),
  level: text("level").notNull(), // 'Beginner', 'Intermediate', 'Advanced'
  price: integer("price").notNull(),
  prizePool: text("prize_pool"),
  maxParticipants: integer("max_participants").default(64).notNull(),
  currentParticipants: integer("current_participants").default(0).notNull(),
  description: text("description").notNull(),
  organizer: text("organizer").notNull(),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  coverImage: text("cover_image").notNull(),
  status: text("status").notNull().default("upcoming"), // 'upcoming' or 'past'
  categories: json("categories").$type<string[]>().default([]),
  ageGroups: json("age_groups").$type<string[]>().default([]),
  winner: text("winner"),
  finalist: text("finalist"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Player profiles
export const playerProfiles = pgTable("player_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  location: text("location").notNull(),
  age: text("age"),
  country: text("country"),
  skillLevel: text("skill_level").notNull(),
  bio: text("bio"),
  preferredCourts: json("preferred_courts").$type<string[]>().default([]),
  isDraft: boolean("is_draft").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Coach profiles
export const coachProfiles = pgTable("coach_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  location: text("location").notNull(),
  locations: json("locations").$type<string[]>().default([]),
  bio: text("bio"),
  rating: real("rating"),
  reviews: integer("reviews").default(0),
  rate: text("rate"),
  experience: text("experience"),
  tags: json("tags").$type<string[]>().default([]),
  photos: json("photos").$type<string[]>().default([]),
  schedule: json("schedule").$type<any>(),
  phone: text("phone"),
  email: text("email"),
  isDraft: boolean("is_draft").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tournaments History
export const tournamentHistory = pgTable("tournament_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Nullable on purpose - a manual entry (for a tournament or session
  // played outside TennisConnect) has no real session, so this stays
  // null. Once TC Live can produce real results, they'd be created
  // here with this set, linking a result back to its actual session
  // instead of only a free-text name match - this is what would let
  // "Results" correctly tell apart multiple entries from the same
  // recurring session (e.g. every Wednesday) from a genuinely
  // different one (Thursdays), once that data exists to link.
  sessionId: varchar("session_id").references((): any => tennisSessions.id),
  // "session" | "tournament" - lets the Results tab filter results the
  // same way My Sessions already splits Sessions vs Tournaments,
  // rather than mixing a casual Wednesday hit-up with a tournament
  // bracket result in one undivided list. Defaults to "tournament" -
  // every entry made before this field existed was created under what
  // was literally called "Tournament History".
  entryType: text("entry_type").default("tournament").notNull(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  date: text("date").notNull(),
  result: text("result"),
  award: text("award"),
  photos: json("photos").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Marketplace items
export const marketplaceItems = pgTable("marketplace_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  price: text("price").notNull(),
  condition: text("condition").notNull(),
  photos: text("photos").array().default(sql`'{}'`),
  location: text("location").notNull(),
  description: text("description"),
  type: text("type").notNull().default("second-hand"),
  sellerName: text("seller_name").notNull(),
  sellerEmail: text("seller_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
});

// CLUB COMMUNITIES
// A single weekly session (e.g. "Thursday Social Hit, 6:30-8:30 PM, $18,
// Intermediate"), stored as an array on clubs.sessions.
export interface ClubSession {
  id: string;
  day: string; // e.g. "Monday" .. "Sunday"
  name: string; // e.g. "Thursday Social Hit"
  startTime: string; // e.g. "18:30"
  endTime: string; // e.g. "20:30"
  price?: number;
  level?: string; // e.g. "All Levels", "Intermediate"
}

export const clubs = pgTable("clubs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Basic Information
  name: text("name").notNull(),
  slug: text("slug").unique(),
  category: text("category")
  .default("club")
  .notNull(),
  shortDescription: text("short_description"),
  description: text("description").notNull(),

  // Images
  image: text("image"), // Legacy card image
  logo: text("logo"),
  cover: text("cover"),
  gallery: json("gallery").$type<string[]>().default([]),

  // Location
  location: text("location"), // Legacy
  state: text("state"),
  suburb: text("suburb"),
  address: text("address"),
  googleMapsUrl: text("google_maps_url"),
  hasMultipleLocations: boolean("has_multiple_locations")
  .default(false),
  numberOfLocations: integer("number_of_locations")
    .default(1),

  // Public Contact
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  facebook: text("facebook"),
  instagram: text("instagram"),

  // Contact Person
  contactPersonName: text("contact_person_name"),
  contactPersonRole: text("contact_person_role"),
  contactPersonEmail: text("contact_person_email"),
  contactPersonPhone: text("contact_person_phone"),
  contactPersonNotes: text("contact_person_notes"),
  displayContactPerson: boolean("display_contact_person")
  .default(false),

  // Features
  hasCourts: boolean("has_courts").default(false),
  hasCommunity: boolean("has_community").default(false),
  hasCoaching: boolean("has_coaching").default(false),
  hostsCompetitions: boolean("hosts_competitions").default(false),

  // Court Information
  courtSurfaces: json("court_surfaces")
  .$type<string[]>()
  .default([]),
  indoorCourts: integer("indoor_courts").default(0),
  outdoorCourts: integer("outdoor_courts").default(0),
  hasLighting: boolean("has_lighting").default(false),
  courtBookingAvailable: boolean("court_booking_available")
  .default(false),
  membershipRequired: boolean("membership_required")
  .default(false),
  publicAccess: boolean("public_access")
  .default(true),
  socialTennisDays: json("social_tennis_days")
  .$type<string[]>()
  .default([]),

  // Weekly sessions (day, time, price, level) shown in the Upcoming
  // Sessions block on the Community premium page. Kept as JSON since
  // it's simple repeating data scoped to a single club, same pattern
  // as gallery/services/hostedCompetitions below.
  sessions: json("sessions").$type<ClubSession[]>().default([]),

  // Services
  services: json("services").$type<string[]>().default([]),

  // Pricing
  // General pricing (membership, competitions, social tennis, etc.)
  /* price: text("price"), */ // Legacy
  hourlyPrice: numeric("hourly_price", {
    precision: 10,
    scale: 2,
  }),
  pricingNotes: text("pricing_notes"),

  // Competitions
  hostedCompetitions: json("hosted_competitions")
  .$type<string[]>()
  .default([]),

  // Listing
  listingType: text("listing_type").default("free"),
  status: text("status").default("draft"),
  displayOrder: integer("display_order").default(0),

  // Trust Badges
  verified: boolean("verified").default(false),
  officialPartner: boolean("official_partner").default(false),
  claimedListing: boolean("claimed_listing").default(false),

  // SEO
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),

  // CTA
  ctaText: text("cta_text"),
  ctaUrl: text("cta_url"),
  
  // Rating
  rating: text("rating"),

  // Dates
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});

// ============================================================
// ORGANIZER / PLAY HUB FOUNDATION (architecture v1)
//
//   User -> Organizer Request -> Organization -> Organization Members
//        -> Session -> Registration
//
// v2 (Check-In, Live Session, Rounds, Matches, Scores, Statistics,
// Rankings) is NOT implemented yet, but `sessions.type`/`status` and
// `registrations.status`/`checkedInAt` are shaped so v2 can be added
// later without changing the schema. See shared/constants/sessions.ts.
// ============================================================

// A player/coach asking to become an Organizer. Reviewed by an admin in
// Admin > Organizer Requests. On approval, users.isOrganizer is set true.
export const organizerRequests = pgTable("organizer_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").default("pending").notNull(), // pending | approved | rejected
  note: text("note"), // optional message from the requester
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// An organizing entity (a person or a group) that runs Sessions.
// Created by an approved Organizer from their Organizer Dashboard.
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 255 })
    .notNull()
    .unique(),
  name: text("name").notNull(),
  description: text("description"),
  logo: text("logo"),
  cover: text("cover"),
  // NEW
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  ownerId: varchar("owner_id")
    .notNull()
    .references(() => users.id),

  // community | club | academy | coach | company
  type: text("type")
    .default("community")
    .notNull(),
  // free | featured | premium
  listingType: text("listing_type")
    .default("free")
    .notNull(),
  verified: boolean("verified")
    .default(false)
    .notNull(),
  // draft | published | inactive
  status: text("status")
    .default("draft")
    .notNull(),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});

// Members of an Organization (owner is added automatically on creation).
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id),

    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),

    role: text("role")
      .default("owner")
      .notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationUserUnique: unique().on(
      table.organizationId,
      table.userId
    ),
  })
);

// A single "Play This Week" session run by an Organization.
export const tennisSessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  // Base64 data URL from the wizard's Step 2 upload (FileReader, no
  // separate object storage wired for this yet) - was always captured
  // in the wizard draft but silently dropped on submit until this
  // column existed. Nullable - most sessions still won't have one.
  coverImage: text("cover_image"),
  // Free text on purpose (see shared/constants/sessions.ts SESSION_TYPES)
  // so new formats don't require a migration.
  type: text("type").default("social").notNull(),
  status: text("status").default("draft").notNull(), // draft | published | cancelled | live | completed
  location: text("location"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  // A Tournament/Club Championship can be a "container" for several
  // real, independently-registerable sessions - Men's Singles A,
  // Mixed Doubles, etc. - each with its own startAt/endAt (so a
  // multi-day event just falls out of each division having its own
  // dates), rather than one session trying to represent the whole
  // thing. Null for every ordinary, single-format session - this is
  // purely additive and never required.
  parentSessionId: varchar("parent_session_id").references((): any => tennisSessions.id),
  registrationOpensAt: timestamp("registration_opens_at"),
  registrationClosesAt: timestamp("registration_closes_at"),
  price: numeric("price", { precision: 10, scale: 2, }),
  currency: varchar("currency", { length: 8 }).default("AUD").notNull(),
  maxParticipants: integer("max_participants"),
  skillLevel: text("skill_level"),
  visibility: text("visibility")
  .default("public")
  .notNull(),
  courtsCount: integer("courts_count"),
  waitingListEnabled: boolean("waiting_list_enabled").default(true).notNull(),
  // Admin moderation — every organizer-submitted session is reviewed
 // before it goes live. Null until an admin approves or rejects it.
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

});

// A player joining a Session. `checkedInAt` is unused today but reserved
// so QR Check-In (v2) can land without a schema change.
export const registrations = pgTable(
  "registrations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    sessionId: varchar("session_id")
      .notNull()
      .references(() => tennisSessions.id),

    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),

    status: text("status")
      .default("registered")
      .notNull(),

    checkedInAt: timestamp("checked_in_at"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sessionUserUnique: unique().on(
      table.sessionId,
      table.userId
    ),
  })
);
 
export const organizerRequestsRelations = relations(organizerRequests, ({ one }) => ({
  user: one(users, {
    fields: [organizerRequests.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [organizerRequests.reviewedBy],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
  }),
  members: many(organizationMembers),
  sessions: many(tennisSessions),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const tennisSessionsRelations = relations(tennisSessions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tennisSessions.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [tennisSessions.createdBy],
    references: [users.id],
  }),
  registrations: many(registrations),
}));

export const registrationsRelations = relations(registrations, ({ one }) => ({
  session: one(tennisSessions, {
    fields: [registrations.sessionId],
    references: [tennisSessions.id],
  }),
  user: one(users, {
    fields: [registrations.userId],
    references: [users.id],
  }),
}));

export const insertOrganizerRequestSchema = createInsertSchema(organizerRequests)
  .pick({
    userId: true,
    note: true,
  })
  .extend({
    note: z.string().max(500).optional(),
  });

export const insertOrganizationSchema = createInsertSchema(organizations)
  .omit({
    id: true,
    slug: true,
    ownerId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().max(2000).optional(),
    type: z.enum(ORGANIZATION_TYPES).optional(),
    listingType: z.enum(ORGANIZATION_LISTING_TYPES).optional(),
  });

export const insertSessionSchema = createInsertSchema(tennisSessions)
  .omit({
    id: true,
    organizationId: true,
    createdBy: true,
    status: true,
    reviewedBy: true,
    reviewedAt: true,
    reviewNote: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().min(2, "Title must be at least 2 characters"),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional(),
    registrationOpensAt: z.coerce.date().optional(),
    registrationClosesAt: z.coerce.date().optional(),
    maxParticipants: z.coerce.number().int().positive().optional(),
    price: z.coerce.number().min(0).optional(),
  });

export const insertRegistrationSchema = createInsertSchema(registrations).pick({
  sessionId: true,
  userId: true,
});

// A player following a club/community. Surfaced as a "Following" toggle
// on the premium club page, and (later) a "My Communities" list on the
// player's own profile.
export const clubFollows = pgTable("club_follows", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  clubId: varchar("club_id")
    .references(() => clubs.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A player favouriting a club as a court venue - "I like playing here",
// deliberately separate from clubFollows above (community membership) -
// a user can do either, both, or neither for the same club. Surfaced
// as a heart toggle on every club card in the listing, and a "My
// Courts" list on the player's own profile.
export const clubFavorites = pgTable("club_favorites", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  clubId: varchar("club_id")
    .references(() => clubs.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Messages - for contact requests and messaging between users
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentMessageId: varchar("parent_message_id"),
  conversationId: varchar("conversation_id"),
  recipientId: varchar("recipient_id").notNull(), // no FK to support demo profiles
  recipientType: text("recipient_type").notNull(), // 'coach' or 'player'
  senderUserId: varchar("sender_user_id").references(() => users.id), // null if unregistered
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderPhone: text("sender_phone"),
  subject: text("subject"),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // Distinguishes an actionable invitation from a regular message, and
  // which kind - a Community invite and a Session invite are two
  // deliberately separate things (accepting one never implies the
  // other). null for every ordinary message.
  messageType: text("message_type"), // 'community_invite' | 'session_invite' | null
  relatedSessionId: varchar("related_session_id").references(() => tennisSessions.id),
  relatedOrganizationId: varchar("related_organization_id").references(() => organizations.id),
  // Only meaningful when messageType is set - lets the invitation's
  // Accept/Decline buttons in the recipient's inbox turn into a
  // permanent status once acted on, persisted rather than local UI
  // state that would reset on reload.
  actionStatus: text("action_status"), // 'pending' | 'accepted' | 'declined' | null
});

// A player's relationship to an organiser's community - separate from
// any specific session's registrations, and separate from
// organizationMembers (which is about staff/ownership roles, not
// players). Accepting a Session invite does NOT create one of these;
// only accepting (or being granted) a Community invite does.
export const communityMemberships = pgTable(
  "community_memberships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: varchar("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").default("pending").notNull(), // 'pending' | 'accepted' | 'declined'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgUserUnique: unique().on(table.organizationId, table.userId),
  })
);

export type CommunityMembership = typeof communityMemberships.$inferSelect;

//Support chat
export const supportRequests = pgTable("support_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  category: text("category").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  status: text("status")
    .default("new")
    .notNull(),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});

// Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  playerProfile: one(playerProfiles, {
    fields: [users.id],
    references: [playerProfiles.userId],
  }),

  coachProfile: one(coachProfiles, {
    fields: [users.id],
    references: [coachProfiles.userId],
  }),

  tournamentHistory: many(tournamentHistory),

  marketplaceItems: many(marketplaceItems),

  receivedMessages: many(messages),

  // ===== Organizer Foundation =====

  organizerRequests: many(organizerRequests),

  ownedOrganizations: many(organizations),

  organizationMemberships: many(organizationMembers),

  createdSessions: many(tennisSessions),

  registrations: many(registrations),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  recipient: one(users, {
    fields: [messages.recipientId],
    references: [users.id],
  }),
  sender: one(users, {
    fields: [messages.senderUserId],
    references: [users.id],
  }),
}));

export const playerProfilesRelations = relations(playerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [playerProfiles.userId],
    references: [users.id],
  }),
}));

export const coachProfilesRelations = relations(coachProfiles, ({ one }) => ({
  user: one(users, {
    fields: [coachProfiles.userId],
    references: [users.id],
  }),
}));

export const tournamentHistoryRelations = relations(tournamentHistory, ({ one }) => ({
  user: one(users, {
    fields: [tournamentHistory.userId],
    references: [users.id],
  }),
}));

export const marketplaceItemsRelations = relations(marketplaceItems, ({ one }) => ({
  user: one(users, {
    fields: [marketplaceItems.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    password: true,
    name: true,
    role: true,
    slug: true,
    avatar: true,
    cover: true,
  })
  .extend({
    slug: z.string().optional(), 
  });

export const insertPlayerProfileSchema = createInsertSchema(playerProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertCoachProfileSchema = createInsertSchema(coachProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertTournamentHistorySchema = createInsertSchema(
  tournamentHistory
).extend({
  photos: z.array(z.string()).optional().default([]),
});

export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItems)
  .omit({
    id: true,
    createdAt: true,
    userId: true,
    sellerName: true,
    sellerEmail: true,
    photos: true,
    type: true,
    isActive: true,
  });

export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClubFollowSchema = createInsertSchema(clubFollows).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPlayerProfile = z.infer<typeof insertPlayerProfileSchema>;
export type PlayerProfile = typeof playerProfiles.$inferSelect;

export type InsertCoachProfile = z.infer<typeof insertCoachProfileSchema>;
export type CoachProfile = typeof coachProfiles.$inferSelect;

export type InsertTournamentHistory = z.infer<typeof insertTournamentHistorySchema>;
export type TournamentHistory = typeof tournamentHistory.$inferSelect;

export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;
export type MarketplaceItem = typeof marketplaceItems.$inferSelect;

export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;

export type ClubFollow = typeof clubFollows.$inferSelect;
export type ClubFavorite = typeof clubFavorites.$inferSelect;
export type InsertClubFollow = z.infer<typeof insertClubFollowSchema>;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type MessageWithAvatar = Message & {
  senderAvatar?: string | null;
};

export type SupportRequest = typeof supportRequests.$inferSelect;
export type InsertSupportRequest = typeof supportRequests.$inferInsert;

export type OrganizerRequest = typeof organizerRequests.$inferSelect;
export type InsertOrganizerRequest = z.infer<typeof insertOrganizerRequestSchema>;

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type OrganizationMember = typeof organizationMembers.$inferSelect;

export type TennisSession = typeof tennisSessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Registration = typeof registrations.$inferSelect;
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;

// Session enriched with the info the UI actually renders (organization
// name, spot counts, and — for a specific viewer — their own registration).
export type SessionWithDetails = TennisSession & {
  organizationName: string;
  organizationSlug: string;
  registeredCount: number;
  waitlistedCount: number;
  checkedInCount: number;
  spotsLeft: number | null; // null when maxParticipants is not set (unlimited)
  viewerRegistrationStatus?: RegistrationStatusType | null;
  creatorName?: string; // populated only for the admin moderation view
  creatorAvatar?: string | null; // populated only when creatorName is (same includeCreatorNames flag)
  hasDivisions: boolean; // true if any session (any status) has this one as its parentSessionId
  parentSessionTitle?: string; // the container's own title, when this session is a division
};

// One row per player registered for a session, with just enough user
// info for the organizer's Players/Registration tabs to display a name,
// avatar, and profile link - not the full user record.
export type RegistrationWithUser = Registration & {
  userName: string;
  userSlug: string;
  userAvatar: string | null;
  userIsTestUser: boolean;
  userRole: string;
};

// One row per distinct player across every session in an organization -
// the org-wide "Players" page's real roster.
export type OrgPlayerRow = {
  userId: string;
  userName: string;
  userSlug: string;
  userAvatar: string | null;
  sessionsPlayed: number;
  lastPlayedAt: string;
};

// Articles / Travel / Recreation / Tournaments schemas
export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  createdAt: true,
}).extend({
  slug: z.string().optional(),
});
export const insertTravelPackageSchema = createInsertSchema(travelPackages).omit({
  id: true,
  createdAt: true,
}).extend({
  slug: z.string().optional(),
  highlights: z.array(z.string()).optional().default([]),
  includes: z.array(z.string()).optional().default([]),
  gallery: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  providerName: z.string().max(150).optional(),
  providerWebsite: z.string().url().optional(),
  providerLogo: z.string().url().optional(),
  ctaText: z.string().max(100).optional(),
  ctaUrl: z.string().url().optional(),
  seoTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
  content: z.string().optional(),
});
export const insertRecreationServiceSchema = createInsertSchema(recreationServices).omit({
  id: true,
  createdAt: true,
}).extend({
  slug: z.string().optional(),
  benefits: z.array(z.string()).optional().default([]),
});
export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  id: true,
  createdAt: true,
}).extend({
  slug: z.string().optional(),
  categories: z.array(z.string()).optional().default([]),
  ageGroups: z.array(z.string()).optional().default([]),
});

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;
export type InsertTravelPackage = z.infer<typeof insertTravelPackageSchema>;
export type TravelPackage = typeof travelPackages.$inferSelect;
export type InsertRecreationService = z.infer<typeof insertRecreationServiceSchema>;
export type RecreationService = typeof recreationServices.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournaments.$inferSelect;