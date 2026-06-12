import { 
  users, 
  playerProfiles,
  coachProfiles,
  tournamentHistory,
  marketplaceItems,
  clubs,
  messages,
  passwordResetTokens,
  supportRequests,
  tournaments,
  type User, 
  type InsertUser,
  type PlayerProfile,
  type InsertPlayerProfile,
  type CoachProfile,
  type InsertCoachProfile,
  type TournamentHistory,
  type InsertTournamentHistory,
  type MarketplaceItem,
  type InsertMarketplaceItem,
  type Club,
  type InsertClub,
  type Message,
  type MessageWithAvatar,
  type InsertMessage,
  type SupportRequest,
  type InsertSupportRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, asc, sql } from "drizzle-orm";
import { supabaseAdmin } from "./supabaseAdmin";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function generateUniqueSlug(name: string): Promise<string> {
  if (!name || !name.trim()) {
    throw new Error("generateUniqueSlug: name is required");
  }

  const base = slugify(name);
  let slug = base;

  while (true) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.slug, slug));

    if (!existing) return slug;

    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

export interface IStorage {
 
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  getUserBySlug(slug: string): Promise<User | undefined>;
  deleteUserAccount(userId: string): Promise<void>;

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
  
 // Tournament History (Player profile)
  getTournamentOwnedByUser(id: string, userId: string): Promise<TournamentHistory>;
  getUserTournamentHistory(userId: string): Promise<TournamentHistory[]>;
  createTournamentHistory(data: InsertTournamentHistory): Promise<TournamentHistory>;
  updateTournamentHistory(id: string, userId: string, data: Partial<InsertTournamentHistory>): Promise<TournamentHistory>;
  deleteTournamentHistory(id: string, userId: string): Promise<void>;
  
  // Marketplace
  getAllMarketplaceItems(): Promise<MarketplaceItem[]>;
  getUserMarketplaceItems(userId: string): Promise<MarketplaceItem[]>;
  createMarketplaceItem(item: InsertMarketplaceItem): Promise<MarketplaceItem>;
  deleteMarketplaceItem(id: string): Promise<void>;
  addMarketplacePhoto(itemId: string, photoUrl: string): Promise<MarketplaceItem>;
  removeMarketplacePhoto(itemId: string, photoUrl: string): Promise<MarketplaceItem>;
  
  // Clubs
  getAllClubs(): Promise<Club[]>;
  createClub(club: InsertClub): Promise<Club>;
  
  // Messages
  getUserMessages(userId: string): Promise<MessageWithAvatar[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  getMessageById(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message>;
  getConversationMessages(conversationId: string): Promise<MessageWithAvatar[]>;
  getUserConversations(userId: string): Promise<MessageWithAvatar[]>;
  findConversationBetweenUsers(userA: string, userB: string): Promise<MessageWithAvatar | undefined>;
  updateMessageConversation(messageId: string, conversationId: string): Promise<void>;
  deleteMessage(id: string): Promise<void>;

  //Support chat
  createSupportRequest(
    request: InsertSupportRequest
  ): Promise<SupportRequest>;

  //Dynamic data
  getPlatformStats(): Promise<{
    players: number;
    coaches: number;
    clubs: number;
    tournaments: number;
  }>;

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
      const slug = insertUser.slug
        ? insertUser.slug
        : await generateUniqueSlug(insertUser.name);

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

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async deleteUserAccount(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
  
      // Messages
      await tx
        .delete(messages)
        .where(
          or(
            eq(messages.senderUserId, userId),
            eq(messages.recipientId, userId)
          )
        );
  
      // Tournament History
      await tx
        .delete(tournamentHistory)
        .where(eq(tournamentHistory.userId, userId));
  
      // Marketplace
      await tx
        .delete(marketplaceItems)
        .where(eq(marketplaceItems.userId, userId));
  
      // Player Profile
      await tx
        .delete(playerProfiles)
        .where(eq(playerProfiles.userId, userId));
  
      // Coach Profile
      await tx
        .delete(coachProfiles)
        .where(eq(coachProfiles.userId, userId));
  
      // Password Reset Tokens
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, userId));
  
      // User (всегда последним)
      await tx
        .delete(users)
        .where(eq(users.id, userId));
    });
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
      }[]> {
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
        .where(
          and(
            eq(users.role, "player"),
            eq(playerProfiles.isDraft, false),
            eq(users.profileCompleted, true)
          )
        );
    }

  async createPlayerProfile(profile: InsertPlayerProfile): Promise<PlayerProfile> {
    const [newProfile] = await db
      .insert(playerProfiles)
      .values({
        ...profile,
        isDraft: true,
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

  async updateUserName(userId: string, name: string) {
    return db
      .update(users)
      .set({ name })
      .where(eq(users.id, userId));
  }

  async updatePlayerProfileByUserId(userId: string, data: any) {
    const profile = await this.getPlayerProfile(userId);
    if (!profile) throw new Error("Player profile not found");

    const [updatedProfile] = await db
      .update(playerProfiles)
      .set({
        ...data,
        isDraft: false,
      })
      .where(eq(playerProfiles.id, profile.id))
      .returning();

    await db
      .update(users)
      .set({ profileCompleted: true })
      .where(eq(users.id, userId));

    return updatedProfile;
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
    }[]> {
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
      .where(
        and(
          eq(users.role, "coach"),
          eq(coachProfiles.isDraft, false),
          eq(users.profileCompleted, true)
        )
      );
  }

  async createCoachProfile(profile: InsertCoachProfile): Promise<CoachProfile> {
    const [newProfile] = await db
      .insert(coachProfiles)
      .values({
        ...profile,
        isDraft: true,
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

    const [updatedProfile] = await db
      .update(coachProfiles)
      .set({
        ...data,
        isDraft: false,
      })
      .where(eq(coachProfiles.id, profile.id))
      .returning();

    await db
      .update(users)
      .set({ profileCompleted: true })
      .where(eq(users.id, userId));

    return updatedProfile;
  }

  // =====================
  // TOURNAMENT HISTORY
  // =====================
  // публично (для профайла)
  async getUserTournamentHistory(userId: string): Promise<TournamentHistory[]> {
    return db
      .select()
      .from(tournamentHistory)
      .where(eq(tournamentHistory.userId, userId))
      .orderBy(desc(tournamentHistory.date));
  }

  // создание (только владелец)
  async createTournamentHistory(
    data: InsertTournamentHistory
  ): Promise<TournamentHistory> {
    const [created] = await db
      .insert(tournamentHistory)
      .values({
        ...data,
        photos: data.photos ?? [],
      })
      .returning();

    return created;
  }

  // получить турнир владельца (ключевой метод)
  async getTournamentOwnedByUser(
    id: string,
    userId: string
  ): Promise<TournamentHistory> {
    const [tournament] = await db
      .select()
      .from(tournamentHistory)
      .where(
        and(
          eq(tournamentHistory.id, id),
          eq(tournamentHistory.userId, userId)
        )
      );

    if (!tournament) {
      throw new Error("Tournament not found or access denied");
    }

    return tournament;
  }

  // получить турнир (для чтения, public / owner)
  async getTournamentHistoryById(
    id: string,
    userId: string
  ): Promise<TournamentHistory | null> {
    const [tournament] = await db
      .select()
      .from(tournamentHistory)
      .where(
        and(
          eq(tournamentHistory.id, id),
          eq(tournamentHistory.userId, userId)
        )
      );

    return tournament ?? null;
  }

  // обновление (владелец)
  async updateTournamentHistory(
    id: string,
    userId: string,
    data: Partial<InsertTournamentHistory>
  ): Promise<TournamentHistory> {

    const [updated] = await db
      .update(tournamentHistory)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.result !== undefined && { result: data.result }),
        ...(data.award !== undefined && { award: data.award }),
        ...(data.photos !== undefined && { photos: data.photos }),
      })
      .where(
        and(
          eq(tournamentHistory.id, id),
          eq(tournamentHistory.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Tournament not found or access denied");
    }

    return updated;
  }

  // удаление (владелец)
  async deleteTournamentHistory(id: string, userId: string): Promise<void> {
  const tournament = await this.getTournamentOwnedByUser(id, userId);

  const photos: string[] = tournament.photos ?? [];

  // 1️⃣ удалить файлы из Supabase Storage
  if (photos.length > 0) {
    const paths = photos.map(
      url => url.split("/storage/v1/object/public/media/")[1]
    );

    await supabaseAdmin.storage
      .from("media")
      .remove(paths);
  }

  // 2️⃣ удалить запись из БД
  await db
    .delete(tournamentHistory)
    .where(
      and(
        eq(tournamentHistory.id, id),
        eq(tournamentHistory.userId, userId)
      )
    );
}

  // =====================
  // MARKETPLACE
  // =====================
  async createMarketplaceItem(data: any) {
      const [item] = await db
        .insert(marketplaceItems)
        .values({
          ...data,
          photos: [],
        })
        .returning();

      return item;
  }

  async getMarketplaceItemsByUser(userId: string) {
    return db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.userId, userId))
      .orderBy(desc(marketplaceItems.createdAt));
  } 

  async getMarketplaceItemById(id: string) {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, id));

    return item;
  }
  
  async getAllMarketplaceItems() {
    return db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.isActive, true))
      .orderBy(desc(marketplaceItems.createdAt));
  }

  async getUserMarketplaceItems(userId: string) {
    return db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.userId, userId))
      .orderBy(desc(marketplaceItems.createdAt));
  }

  async updateMarketplaceItem(id: string, updates: any) {
    const [item] = await db
      .update(marketplaceItems)
      .set(updates)
      .where(eq(marketplaceItems.id, id))
      .returning();

    return item;
  }
 
  async deleteMarketplaceItem(id: string): Promise<void> {
    await db
      .delete(marketplaceItems)
      .where(eq(marketplaceItems.id, id));
  }

  async addMarketplacePhoto(itemId: string, photoUrl: string) {
    const item = await this.getMarketplaceItemById(itemId);
    if (!item) throw new Error("Item not found");

    const updatedPhotos = [...(item.photos || []), photoUrl];

    const [updated] = await db
      .update(marketplaceItems)
      .set({ photos: updatedPhotos })
      .where(eq(marketplaceItems.id, itemId))
      .returning();

    return updated;
  }

  async removeMarketplacePhoto(itemId: string, photoUrl: string) {
  const item = await this.getMarketplaceItemById(itemId);
  if (!item) throw new Error("Item not found");

  const updatedPhotos = (item.photos || []).filter(
    (photo: string) => photo !== photoUrl
  );

  const [updated] = await db
    .update(marketplaceItems)
    .set({ photos: updatedPhotos })
    .where(eq(marketplaceItems.id, itemId))
    .returning();

  return updated;
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

  async getUserMessages(userId: string): Promise<MessageWithAvatar[]> {
    
    return db
      .select({
        id: messages.id,
        parentMessageId: messages.parentMessageId,
        conversationId: messages.conversationId,
        recipientId: messages.recipientId,
        recipientType: messages.recipientType,
        senderUserId: messages.senderUserId,
        senderName: messages.senderName,
        senderEmail: messages.senderEmail,
        senderPhone: messages.senderPhone,
        subject: messages.subject,
        content: messages.content,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
  
        senderAvatar: users.avatar,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderUserId, users.id))
      .where(eq(messages.recipientId, userId))
      .orderBy(desc(messages.createdAt));
  }

  async getUserConversations(
    userId: string
  ): Promise<MessageWithAvatar[]> {
  
    const allMessages = await db
      .select({
        id: messages.id,
        parentMessageId: messages.parentMessageId,
        conversationId: messages.conversationId,
  
        recipientId: messages.recipientId,
        recipientType: messages.recipientType,
  
        senderUserId: messages.senderUserId,
        senderName: messages.senderName,
        senderEmail: messages.senderEmail,
        senderPhone: messages.senderPhone,
  
        subject: messages.subject,
        content: messages.content,
  
        isRead: messages.isRead,
        createdAt: messages.createdAt,
  
        senderAvatar: users.avatar,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderUserId, users.id))
      .where(eq(messages.recipientId, userId))
      .orderBy(desc(messages.createdAt));
  
    const uniqueConversations = new Map();
  
    for (const message of allMessages) {
      const key =
        message.conversationId || message.id;
  
      if (!uniqueConversations.has(key)) {
        uniqueConversations.set(key, message);
      }
    }
  
    return Array.from(uniqueConversations.values());
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
  
  async findConversationBetweenUsers(
    userA: string,
    userB: string
  ): Promise<MessageWithAvatar | undefined> {
  
      const [conversation] = await db
      .select({
        id: messages.id,
        parentMessageId: messages.parentMessageId,
        conversationId: messages.conversationId,

        recipientId: messages.recipientId,
        recipientType: messages.recipientType,

        senderUserId: messages.senderUserId,
        senderName: messages.senderName,
        senderEmail: messages.senderEmail,
        senderPhone: messages.senderPhone,

        subject: messages.subject,
        content: messages.content,

        isRead: messages.isRead,
        createdAt: messages.createdAt,

        senderAvatar: users.avatar,
      })
      .from(messages)
      .leftJoin(
        users,
        eq(messages.senderUserId, users.id)
      )
      .where(
        or(
          and(
            eq(messages.senderUserId, userA),
            eq(messages.recipientId, userB)
          ),
          and(
            eq(messages.senderUserId, userB),
            eq(messages.recipientId, userA)
          )
        )
      )
      .orderBy(asc(messages.createdAt))
      .limit(1);
    return conversation;
  }

  async getConversationMessages(
    conversationId: string
  ): Promise<MessageWithAvatar[]> {
  
    return db
      .select({
        id: messages.id,
  
        parentMessageId: messages.parentMessageId,
        conversationId: messages.conversationId,
  
        recipientId: messages.recipientId,
        recipientType: messages.recipientType,
  
        senderUserId: messages.senderUserId,
        senderName: messages.senderName,
        senderEmail: messages.senderEmail,
        senderPhone: messages.senderPhone,
  
        subject: messages.subject,
        content: messages.content,
  
        isRead: messages.isRead,
        createdAt: messages.createdAt,
  
        senderAvatar: users.avatar,
      })
      .from(messages)
      .leftJoin(
        users,
        eq(messages.senderUserId, users.id)
      )
      .where(
        eq(messages.conversationId, conversationId)
      )
      .orderBy(asc(messages.createdAt));
  }

  async updateMessageConversation(
    messageId: string,
    conversationId: string
  ): Promise<void> {
    await db
      .update(messages)
      .set({
        conversationId,
      })
      .where(eq(messages.id, messageId));
  }

  async createSupportRequest(
    request: InsertSupportRequest
  ): Promise<SupportRequest> {
    const [supportRequest] = await db
      .insert(supportRequests)
      .values(request)
      .returning();
  
    return supportRequest;
  }

   // =====================
  // Dynamic data for blocks
  // =====================

  async getPlatformStats() {
    const [playersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playerProfiles)
      .where(eq(playerProfiles.isDraft, false));
  
    const [coachesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(coachProfiles)
      .where(eq(coachProfiles.isDraft, false));
  
    const [clubsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clubs);
  
    const [tournamentsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tournaments);
  
    return {
      players: Number(playersResult.count),
      coaches: Number(coachesResult.count),
      clubs: Number(clubsResult.count),
      tournaments: Number(tournamentsResult.count),
    };
  }
}

  export const storage = new DatabaseStorage();
