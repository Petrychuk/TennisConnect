// Referenced: blueprint:javascript_database
import { 
  users, 
  playerProfiles,
  coachProfiles,
  tournaments,
  marketplaceItems,
  clubs,
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
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // Player Profiles
  getPlayerProfile(userId: string): Promise<PlayerProfile | undefined>;
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

  async createPlayerProfile(profile: InsertPlayerProfile): Promise<PlayerProfile> {
    const [newProfile] = await db
      .insert(playerProfiles)
      .values(profile)
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
    const [newProfile] = await db
      .insert(coachProfiles)
      .values(profile)
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
    const [newTournament] = await db
      .insert(tournaments)
      .values(tournament)
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
    const [newClub] = await db
      .insert(clubs)
      .values(club)
      .returning();
    return newClub;
  }
}

export const storage = new DatabaseStorage();
