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

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // Player Profiles
  getPlayerProfile(userId: string): Promise<PlayerProfile | undefined>;
  getAllPlayers(): Promise<PlayerProfile[]>;
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
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
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

  // Player Profiles
  async getPlayerProfile(userId: string): Promise<PlayerProfile | undefined> {
    const [profile] = await db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId));
    return profile || undefined;
  }

  async getAllPlayers(): Promise<PlayerProfile[]> {
    return await db.select().from(playerProfiles);
  }

  async createPlayerProfile(profile: InsertPlayerProfile): Promise<PlayerProfile> {
    const profileData = {
      ...profile,
      preferredCourts: profile.preferredCourts as string[] | undefined,
    };
    const [newProfile] = await db
      .insert(playerProfiles)
      .values(profileData)
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

  // Coach Profiles
  async getCoachProfile(userId: string): Promise<CoachProfile | undefined> {
    const [profile] = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId));
    return profile || undefined;
  }

  async getAllCoaches(): Promise<CoachProfile[]> {
    return await db.select().from(coachProfiles);
  }

  async createCoachProfile(profile: InsertCoachProfile): Promise<CoachProfile> {
    const profileData = {
      ...profile,
      locations: profile.locations as string[] | undefined,
      tags: profile.tags as string[] | undefined,
      photos: profile.photos as string[] | undefined,
    };
    const [newProfile] = await db
      .insert(coachProfiles)
      .values(profileData)
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

  // Tournaments
  async getUserTournaments(userId: string): Promise<Tournament[]> {
    return await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.userId, userId));
  }

  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const tournamentData = {
      ...tournament,
      photos: tournament.photos as string[] | undefined,
    };
    const [newTournament] = await db
      .insert(tournaments)
      .values(tournamentData)
      .returning();
    return newTournament;
  }

  async deleteTournament(id: string): Promise<void> {
    await db.delete(tournaments).where(eq(tournaments.id, id));
  }

  // Marketplace
  async getAllMarketplaceItems(): Promise<MarketplaceItem[]> {
    return await db.select().from(marketplaceItems);
  }

  async getUserMarketplaceItems(userId: string): Promise<MarketplaceItem[]> {
    return await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.userId, userId));
  }

  async createMarketplaceItem(item: InsertMarketplaceItem): Promise<MarketplaceItem> {
    const [newItem] = await db
      .insert(marketplaceItems)
      .values(item)
      .returning();
    return newItem;
  }

  async deleteMarketplaceItem(id: string): Promise<void> {
    await db.delete(marketplaceItems).where(eq(marketplaceItems.id, id));
  }

  // Clubs
  async getAllClubs(): Promise<Club[]> {
    return await db.select().from(clubs);
  }

  async createClub(club: InsertClub): Promise<Club> {
    const clubData = {
      ...club,
      services: club.services as string[] | undefined,
    };
    const [newClub] = await db
      .insert(clubs)
      .values(clubData)
      .returning();
    return newClub;
  }

  // Messages
  async getUserMessages(userId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.recipientId, userId))
      .orderBy(desc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const unreadMessages = await db
      .select()
      .from(messages)
      .where(and(eq(messages.recipientId, userId), eq(messages.isRead, false)));
    return unreadMessages.length;
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
