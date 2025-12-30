// Referenced: blueprint:javascript_database
import { 
  users, 
  playerProfiles,
  coachProfiles,
  tournaments,
  marketplaceItems,
  clubs,
  messages,
  type User, 
  type InsertUser,
  type PlayerProfile,
  type InsertPlayerProfile,
  type CoachProfile,
  type InsertCoachProfile,
  type Tournament,
  type InsertTournament,
  type MarketplaceItem,
  type InsertMarketplaceItem,
  type Club,
  type InsertClub,
  type Message,
  type InsertMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let counter = 1;

  while (true) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.slug, slug));

    if (!existing) return slug;

    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    counter++;
  }
}

export interface IStorage {
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getUserBySlug(slug: string): Promise<User | undefined>;

  // Player Profiles
  getPlayerProfile(userId: string): Promise<PlayerProfile | undefined>;
  getAllPlayers(): Promise<
      {
        user: typeof users.$inferSelect;
        profile: typeof playerProfiles.$inferSelect;
      }[]
    >;
  createPlayerProfile(profile: InsertPlayerProfile): Promise<PlayerProfile>;
  updatePlayerProfile(id: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile>;
  
  // Coach Profiles
  getCoachProfile(userId: string): Promise<CoachProfile | undefined>;
  getAllCoaches(): Promise<CoachProfile[]>;
  createCoachProfile(profile: InsertCoachProfile): Promise<CoachProfile>;
  updateCoachProfile(id: string, updates: Partial<CoachProfile>): Promise<CoachProfile>;
  
  // Tournaments
  getUserTournaments(userId: string): Promise<Tournament[]>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  deleteTournament(id: string): Promise<void>;
  
  // Marketplace
  getAllMarketplaceItems(): Promise<MarketplaceItem[]>;
  getUserMarketplaceItems(userId: string): Promise<MarketplaceItem[]>;
  createMarketplaceItem(item: InsertMarketplaceItem): Promise<MarketplaceItem>;
  deleteMarketplaceItem(id: string): Promise<void>;
  
  // Clubs
  getAllClubs(): Promise<Club[]>;
  createClub(club: InsertClub): Promise<Club>;
  
  // Messages
  getUserMessages(userId: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  getMessageById(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // =====================
  // USERS
  // =====================

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserBySlug(slug: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.slug, slug));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const slug = await generateUniqueSlug(insertUser.name);

    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        slug,
      })
      .returning();

    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    return user;
  }

  // =====================
  // PLAYER PROFILES
  // =====================

  async getPlayerProfile(userId: string): Promise<PlayerProfile | undefined> {
    const [profile] = await db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId));

    return profile;
  }

  async getAllPlayers(): Promise<
      {
        user: typeof users.$inferSelect;
        profile: typeof playerProfiles.$inferSelect;
      }[]
    > {
      return await db
        .select({
          user: users,
          profile: playerProfiles,
        })
        .from(users)
        .innerJoin(
          playerProfiles,
          eq(users.id, playerProfiles.userId)
        )
        .where(eq(users.role, "player"));
    }

  async createPlayerProfile(profile: InsertPlayerProfile): Promise<PlayerProfile> {
    const [newProfile] = await db
      .insert(playerProfiles)
      .values({
        ...profile,
        preferredCourts: profile.preferredCourts as string[] | undefined,
      })
      .returning();

    return newProfile;
  }

  async updatePlayerProfile(id: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile> {
    const [profile] = await db
      .update(playerProfiles)
      .set(updates)
      .where(eq(playerProfiles.id, id))
      .returning();

    return profile;
  }

  async updatePlayerProfileByUserId(userId: string, data: any) {
    const profile = await this.getPlayerProfile(userId);
    if (!profile) throw new Error("Player profile not found");

    return this.updatePlayerProfile(profile.id, data);
  }

  // =====================
  // COACH PROFILES
  // =====================

  async getCoachProfile(userId: string): Promise<CoachProfile | undefined> {
    const [profile] = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId));

    return profile;
  }

  async getAllCoaches(): Promise<CoachProfile[]> {
    return db.select().from(coachProfiles);
  }

  async getAllCoachesWithProfiles(): Promise<
    {
      user: typeof users.$inferSelect;
      profile: typeof coachProfiles.$inferSelect;
    }[]
  > {
    return db
      .select({
        user: users,
        profile: coachProfiles,
      })
      .from(users)
      .innerJoin(
        coachProfiles,
        eq(users.id, coachProfiles.userId)
      )
      .where(eq(users.role, "coach"));
  }

  async createCoachProfile(profile: InsertCoachProfile): Promise<CoachProfile> {
    const [newProfile] = await db
      .insert(coachProfiles)
      .values({
        ...profile,
        locations: profile.locations as string[] | undefined,
        tags: profile.tags as string[] | undefined,
        photos: profile.photos as string[] | undefined,
      })
      .returning();

    return newProfile;
  }

  async updateCoachProfile(id: string, updates: Partial<CoachProfile>): Promise<CoachProfile> {
    const [profile] = await db
      .update(coachProfiles)
      .set(updates)
      .where(eq(coachProfiles.id, id))
      .returning();

    return profile;
  }

  async updateCoachProfileByUserId(userId: string, data: any) {
    const profile = await this.getCoachProfile(userId);
    if (!profile) throw new Error("Coach profile not found");

    return this.updateCoachProfile(profile.id, data);
  }

  // =====================
  // TOURNAMENTS
  // =====================

  async getUserTournaments(userId: string): Promise<Tournament[]> {
    return db
      .select()
      .from(tournaments)
      .where(eq(tournaments.userId, userId));
  }

  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const [newTournament] = await db
      .insert(tournaments)
      .values({
        ...tournament,
        photos: tournament.photos as string[] | undefined,
      })
      .returning();

    return newTournament;
  }

  async deleteTournament(id: string): Promise<void> {
    await db.delete(tournaments).where(eq(tournaments.id, id));
  }

  // =====================
  // MARKETPLACE
  // =====================

  async getAllMarketplaceItems(): Promise<MarketplaceItem[]> {
    return db.select().from(marketplaceItems);
  }

  async getUserMarketplaceItems(userId: string): Promise<MarketplaceItem[]> {
    return db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.userId, userId));
  }

  async createMarketplaceItem(
    item: InsertMarketplaceItem
  ): Promise<MarketplaceItem> {
    const [newItem] = await db
      .insert(marketplaceItems)
      .values(item)
      .returning();

    return newItem;
  }

  async deleteMarketplaceItem(id: string): Promise<void> {
    await db.delete(marketplaceItems).where(eq(marketplaceItems.id, id));
  }

  // =====================
  // CLUBS
  // =====================

  async getAllClubs(): Promise<Club[]> {
    return db.select().from(clubs);
  }

  async createClub(club: InsertClub): Promise<Club> {
    const [newClub] = await db
      .insert(clubs)
      .values({
        ...club,
        services: club.services as string[] | undefined,
      })
      .returning();

    return newClub;
  }

  // =====================
  // MESSAGES
  // =====================

  async getUserMessages(userId: string): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.recipientId, userId))
      .orderBy(desc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const unreadMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );

    return unreadMessages.length;
  }

  async getMessageById(id: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));

    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();

    return newMessage;
  }

  async markMessageAsRead(id: string): Promise<Message> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id))
      .returning();

    return message;
  }

  async deleteMessage(id: string): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }
}

  export const storage = new DatabaseStorage();
