import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  coverImage: text("cover_image").notNull(),
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
  duration: text("duration").notNull(), // e.g. "7 days"
  price: integer("price").notNull(),
  currency: varchar("currency", { length: 8 }).default("AUD").notNull(),
  description: text("description").notNull(),
  highlights: json("highlights").$type<string[]>().default([]),
  includes: json("includes").$type<string[]>().default([]),
  coverImage: text("cover_image").notNull(),
  gallery: json("gallery").$type<string[]>().default([]),
  startDate: text("start_date"),
  spotsLeft: integer("spots_left").default(10).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  rating: text("rating"),
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

// Clubs
export const clubs = pgTable("clubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  description: text("description").notNull(),
  services: json("services").$type<string[]>().default([]),
  price: text("price").notNull(),
  phone: text("phone").notNull(),
  website: text("website"),
  image: text("image"),
  rating: text("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Messages - for contact requests and messaging between users
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// export const registerSchema = z.object({
//   email: z.string().email(),
//   password: z.string().min(6),
//   name: z.string().min(2),
//   role: z.enum(["player", "coach"]),
// });

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

export type InsertClub = z.infer<typeof insertClubSchema>;
export type Club = typeof clubs.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

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
