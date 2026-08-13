import { 
  users, 
  playerProfiles,
  coachProfiles,
  tournamentHistory,
  marketplaceItems,
  clubs,
  clubFollows,
  clubFavorites,
  messages,
  passwordResetTokens,
  supportRequests,
  tournaments,
  organizerRequests,
  organizations,
  organizationMembers,
  communityMemberships,
  tennisSessions,
  registrations,
  sessionRounds,
  matches,
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
  type ClubFollow,
  type ClubFavorite,
  type Message,
  type MessageWithAvatar,
  type InsertMessage,
  type SupportRequest,
  type InsertSupportRequest,
  type OrganizerRequest,
  type InsertOrganizerRequest,
  type Organization,
  type InsertOrganization,
  type TennisSession,
  type InsertSession,
  type Registration,
  type InsertRegistration,
  type SessionWithDetails,
  type RegistrationWithUser,
  type OrgPlayerRow,
  type CommunityMembership,
  type SessionRound,
  type Match,
  type MatchWithPlayers,
  type LeaderboardRow,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, asc, sql, lte, ne, gte, ilike, inArray, isNull } from "drizzle-orm";
import { supabaseAdmin } from "./supabaseAdmin";
import { planRound, computeLeaderboard, type PastMatch } from "./services/liveEngine";

type DbQueryExecutor = Pick<typeof db, "select">;

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

async function generateUniqueOrgSlug(name: string): Promise<string> {
    const base = slugify(name) || "organization";
    let slug = base;
  
    while (true) {
      const [existing] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug));
  
      if (!existing) return slug;
  
     slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
  }
export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getAdminUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  getUserBySlug(slug: string): Promise<User | undefined>;
  deleteUserAccount(userId: string): Promise<void>;
  getAllUsers(): Promise<typeof users.$inferSelect[]>;
  approveUser(id: string): Promise<typeof users.$inferSelect>;
  deleteUserByAdmin(userId: string): Promise<void>;
  hideUser(id: string): Promise<typeof users.$inferSelect>;
  unhideUser(id: string): Promise<typeof users.$inferSelect>;
  // Admin can grant/revoke organizer access directly, independent of the
  // Organizer Request flow — e.g. promoting an already-approved member,
  // or pulling access from someone who has it.
  grantOrganizer(id: string, reviewerId: string): Promise<typeof users.$inferSelect>;
  revokeOrganizer(id: string, reviewerId: string): Promise<typeof users.$inferSelect>;
  
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
  getPublishedClubs(): Promise<Club[]>;
  getPublishedClubBySlug(slug: string): Promise<Club | undefined>;
  getClubBySlug(slug: string): Promise<Club | undefined>;
  getClubById(id: string): Promise<Club | undefined>;
  createClub(club: InsertClub): Promise<Club>;
  updateClub(id: string, club: Partial<InsertClub>): Promise<Club>;
  deleteClub(id: string): Promise<void>;
  // Publishing
  publishClub(id: string): Promise<Club>;
  unpublishClub(id: string): Promise<Club>;
  archiveClub(id: string): Promise<Club>;
  restoreClub(id: string): Promise<Club>;
  // Listing
  updateClubListing(
    id: string,
    listingType: "free" | "premium"
  ): Promise<Club>;

  // Club Follows
  followClub(userId: string, clubId: string): Promise<ClubFollow>;
  unfollowClub(userId: string, clubId: string): Promise<void>;
  isFollowingClub(userId: string, clubId: string): Promise<boolean>;
  getFollowedClubs(userId: string): Promise<Club[]>;
  getFollowedClubIds(userId: string): Promise<string[]>;
  getClubFollowerCount(clubId: string): Promise<number>;

  // Club Favorites ("My Courts") - same shape as Club Follows above,
  // deliberately separate relationship.
  favoriteClub(userId: string, clubId: string): Promise<ClubFavorite>;
  unfavoriteClub(userId: string, clubId: string): Promise<void>;
  isFavoritingClub(userId: string, clubId: string): Promise<boolean>;
  getFavoritedClubs(userId: string): Promise<Club[]>;
  getFavoritedClubIds(userId: string): Promise<string[]>;
  
  // Messages
  getUserMessages(userId: string): Promise<MessageWithAvatar[]>;
  getUnreadMessageCount(userId: string): Promise<number>;
  getMessageById(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message>;
  markConversationAsRead(conversationId: string, recipientId: string): Promise<void>;
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
    sessions: number;
  }>;
  
  // ===== ORGANIZER REQUESTS =====
  createOrganizerRequest(userId: string, note?: string): Promise<OrganizerRequest>;
  getLatestOrganizerRequest(userId: string): Promise<OrganizerRequest | undefined>;
  getOrganizerRequestById(id: string): Promise<OrganizerRequest | undefined>;
  getOrganizerRequests(status?: string): Promise<(OrganizerRequest & {
    userName: string;
    userEmail: string;
    userRole: string;
  })[]>;
  approveOrganizerRequest(id: string, reviewerId: string): Promise<OrganizerRequest>;
  rejectOrganizerRequest(id: string, reviewerId: string): Promise<OrganizerRequest>;

  // ===== ORGANIZATIONS =====
  createOrganization(ownerId: string, org: InsertOrganization): Promise<Organization>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getOrganizationById(id: string): Promise<Organization | undefined>;
  getOrganizationOwnedByUser(userId: string): Promise<Organization | undefined>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;

  // ===== SESSIONS =====
  createSession(organizationId: string, createdBy: string, session: InsertSession): Promise<TennisSession>;
  getSessionById(id: string): Promise<TennisSession | undefined>;
 getSessionByIdWithDetails(id: string, viewerId?: string): Promise<SessionWithDetails | undefined>;
 getSessionDivisions(parentSessionId: string): Promise<SessionWithDetails[]>;
 createSessionDivision(baseSession: TennisSession, createdBy: string, overrides: Partial<InsertSession> & { title: string }): Promise<TennisSession>;
  getSessionsByOrganization(organizationId: string): Promise<TennisSession[]>;
  getUpcomingPublishedSessionsByOrganization(organizationId: string): Promise<SessionWithDetails[]>;
  getSessionsThisWeek(): Promise<SessionWithDetails[]>;
  getSessionsUserRegisteredFor(userId: string): Promise<SessionWithDetails[]>;
  updateSession(id: string, updates: Partial<InsertSession>): Promise<TennisSession>;
 // Organizer: send a draft to the admin queue.
  submitSessionForReview(id: string): Promise<TennisSession>;
  // Admin: approve (-> published) or reject (-> rejected) a submitted session.
 approveSession(id: string, reviewerId: string): Promise<TennisSession>;
 rejectSession(id: string, reviewerId: string, note?: string): Promise<TennisSession>;
  // Admin only: publish directly, bypassing review (admins don't review themselves).
 publishSessionDirect(id: string, reviewerId: string): Promise<TennisSession>;
 cancelSession(id: string): Promise<TennisSession>;
 archiveSession(id: string): Promise<TennisSession>;
 deleteSession(id: string): Promise<void>;
 getRegistrationsForSession(sessionId: string): Promise<RegistrationWithUser[]>;
 getPlayersForOrganization(organizationId: string): Promise<OrgPlayerRow[]>;
 createInvitedRegistration(sessionId: string, userId: string): Promise<Registration>;
 acceptInvitedRegistration(sessionId: string, userId: string): Promise<Registration>;
 createOrganizationMembership(organizationId: string, userId: string): Promise<CommunityMembership>;
 updateOrganizationMembershipStatus(organizationId: string, userId: string, status: string): Promise<CommunityMembership>;
 updateMessageActionStatus(id: string, actionStatus: string): Promise<Message>;
 searchUsers(query: string, excludeUserId: string, limit?: number, context?: { sessionId?: string; organizationId?: string }): Promise<(Pick<User, "id" | "name" | "slug" | "avatar" | "role"> & { alreadyConnected: boolean })[]>;
  // Admin: every session on the platform, across all organizations, so
  // nothing goes live without the admin seeing it first.
 getAllSessionsForAdmin(status?: string): Promise<SessionWithDetails[]>;

  // ===== REGISTRATIONS =====
  registerForSession(sessionId: string, userId: string): Promise<{ registration: Registration; waitlisted: boolean }>;
  cancelRegistration(sessionId: string, userId: string): Promise<Registration>;
  getViewerRegistrationStatus(sessionId: string, userId: string): Promise<string | null>;
  getSessionRegistrationCounts(sessionId: string): Promise<{ registered: number; waitlisted: number }>;

  // ===== TC LIVE ENGINE =====
  checkInRegistration(registrationId: string): Promise<Registration>;
  setRegistrationLiveStatus(registrationId: string, liveStatus: "unavailable" | "withdrawn" | null): Promise<Registration>;
  goLiveSession(sessionId: string): Promise<TennisSession>;
  finishSession(sessionId: string): Promise<TennisSession>;
  generateNextRound(sessionId: string): Promise<{ round: SessionRound; matches: MatchWithPlayers[] }>;
  getCurrentRound(sessionId: string): Promise<{ round: SessionRound; matches: MatchWithPlayers[] } | undefined>;
  reportMatchScore(matchId: string, organizerId: string, teamAGames: number, teamBGames: number): Promise<Match>;
  startMatch(matchId: string): Promise<Match>;
  getSessionLeaderboard(sessionId: string): Promise<LeaderboardRow[]>;
}
export class DatabaseStorage implements IStorage {
  // =====================
  // USERS
  // =====================

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Every admin account - used to notify admins (e.g. a new session
  // submitted for review) rather than a single hardcoded recipient.
  async getAdminUsers(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isAdmin, true));
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

  // ===== ADMIN USERS =====

  async getAllUsers() {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async approveUser(id: string) {
    const [user] = await db
      .update(users)
      .set({
        isApproved: true,
      })
      .where(eq(users.id, id))
      .returning();
  
    return user;
  }

  async deleteUserByAdmin(userId: string): Promise<void> {
    await this.deleteUserAccount(userId);
  }

  async hideUser(id: string) {
    const [user] = await db
      .update(users)
      .set({ isHidden: true })
      .where(eq(users.id, id))
      .returning();
  
    return user;
  }
  
  async unhideUser(id: string) {
    const [user] = await db
      .update(users)
      .set({
        isHidden: false,
      })
      .where(eq(users.id, id))
      .returning();
  
    return user;
  }

  // Takes a reviewerId (not just id) because granting via this shortcut
  // also resolves any pending Organizer Request for the same user —
  // otherwise it'd sit "pending" forever in the Access Requests queue
  // even though the user is already an organizer, and someone approving
  // it later would trigger a second, redundant notification.
  async grantOrganizer(id: string, reviewerId: string) {
    const latestRequest = await this.getLatestOrganizerRequest(id);
    if (latestRequest && latestRequest.status === "pending") {
      await db
        .update(organizerRequests)
        .set({ status: "approved", reviewedBy: reviewerId, reviewedAt: new Date() })
        .where(eq(organizerRequests.id, latestRequest.id));
    }

    const [user] = await db
      .update(users)
      .set({ isOrganizer: true })
      .where(eq(users.id, id))
      .returning();

    return user;
  }

  // Takes a reviewerId (like grantOrganizer) to record who revoked it
  // and mark the underlying request "revoked" — otherwise it would sit
  // forever as "approved" in the Access Requests queue even though the
  // person is no longer an organizer, which is misleading.
  async revokeOrganizer(id: string, reviewerId: string) {
    const latestRequest = await this.getLatestOrganizerRequest(id);
    if (latestRequest && latestRequest.status === "approved") {
      await db
        .update(organizerRequests)
        .set({ status: "revoked", reviewedBy: reviewerId, reviewedAt: new Date() })
        .where(eq(organizerRequests.id, latestRequest.id));
    }

    const [user] = await db
      .update(users)
      .set({ isOrganizer: false })
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
            eq(users.profileCompleted, true),
            eq(users.isApproved, true),
            eq(users.isHidden, false)
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
          eq(users.profileCompleted, true),
          eq(users.isApproved, true),
          eq(users.isHidden, false)
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
        ...(data.entryType !== undefined && { entryType: data.entryType }),
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

  async getPublishedClubs(): Promise<Club[]> {
    return db
      .select()
      .from(clubs)
      .where(eq(clubs.status, "published"));
  }

  async getPublishedClubBySlug(
    slug: string
  ): Promise<Club | undefined> {
  
    const [club] = await db
      .select()
      .from(clubs)
      .where(
        and(
          eq(clubs.slug, slug),
          eq(clubs.status, "published")
        )
      );
  
    return club;
  }

  async createClub(
    club: InsertClub
  ): Promise<Club> {
  
    const [newClub] = await db
      .insert(clubs)
      .values({
  
        // Basic
        name: club.name,
        slug: club.slug,
        category: club.category,
        shortDescription: club.shortDescription,
        description: club.description,
  
        // Images
        image: club.image,
        logo: club.logo,
        cover: club.cover,
        gallery: club.gallery as string[] | undefined,
  
        // Location
        location: club.location,
        state: club.state,
        suburb: club.suburb,
        address: club.address,
        googleMapsUrl: club.googleMapsUrl,
        hasMultipleLocations: club.hasMultipleLocations,
        numberOfLocations: club.numberOfLocations,
  
        // Contact
        phone: club.phone,
        email: club.email,
        website: club.website,
        facebook: club.facebook,
        instagram: club.instagram,
  
        contactPersonName: club.contactPersonName,
        contactPersonRole: club.contactPersonRole,
        contactPersonEmail: club.contactPersonEmail,
        contactPersonPhone: club.contactPersonPhone,
        contactPersonNotes: club.contactPersonNotes,
        displayContactPerson: club.displayContactPerson,
  
        // Features
        hasCourts: club.hasCourts,
        hasCommunity: club.hasCommunity,
        hasCoaching: club.hasCoaching,
        hostsCompetitions: club.hostsCompetitions,
  
        // Courts
        courtSurfaces:
          club.courtSurfaces as string[] | undefined,
  
        indoorCourts: club.indoorCourts,
        outdoorCourts: club.outdoorCourts,
        hasLighting: club.hasLighting,
        courtBookingAvailable: club.courtBookingAvailable,
        membershipRequired: club.membershipRequired,
        publicAccess: club.publicAccess,
  
        socialTennisDays:
          club.socialTennisDays as string[] | undefined,
  
        // Services
        services:
          club.services as string[] | undefined,
  
        // Pricing
        hourlyPrice: club.hourlyPrice,
        pricingNotes: club.pricingNotes,
  
        // Competitions
        hostedCompetitions:
          club.hostedCompetitions as string[] | undefined,
  
        // Listing
        listingType: club.listingType,
        status: club.status,
        displayOrder: club.displayOrder,
  
        // Trust
        verified: club.verified,
        officialPartner: club.officialPartner,
        claimedListing: club.claimedListing,
  
        // SEO
        seoTitle: club.seoTitle,
        metaDescription: club.metaDescription,
        metaKeywords: club.metaKeywords,
  
        // CTA
        ctaText: club.ctaText,
        ctaUrl: club.ctaUrl,
  
        // Rating
        rating: club.rating,
  
      })
      .returning();
  
    return newClub;
  }

  async getClubBySlug(
    slug: string
  ): Promise<Club | undefined> {
  
    const [club] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.slug, slug));
  
    return club;
  
  }

  async getClubById(
    id: string
  ): Promise<Club | undefined> {
  
    const [club] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.id, id));
  
    return club;
  
  }

  async followClub(
    userId: string,
    clubId: string
  ): Promise<ClubFollow> {

    const existing = await db
      .select()
      .from(clubFollows)
      .where(
        and(
          eq(clubFollows.userId, userId),
          eq(clubFollows.clubId, clubId)
        )
      );

    if (existing[0]) {
      return existing[0];
    }

    const [follow] = await db
      .insert(clubFollows)
      .values({ userId, clubId })
      .returning();

    return follow;
  }

  async unfollowClub(
    userId: string,
    clubId: string
  ): Promise<void> {

    await db
      .delete(clubFollows)
      .where(
        and(
          eq(clubFollows.userId, userId),
          eq(clubFollows.clubId, clubId)
        )
      );
  }

  async isFollowingClub(
    userId: string,
    clubId: string
  ): Promise<boolean> {

    const [existing] = await db
      .select()
      .from(clubFollows)
      .where(
        and(
          eq(clubFollows.userId, userId),
          eq(clubFollows.clubId, clubId)
        )
      );

    return !!existing;
  }

  async getFollowedClubs(
    userId: string
  ): Promise<Club[]> {

    const rows = await db
      .select({ club: clubs })
      .from(clubFollows)
      .innerJoin(clubs, eq(clubFollows.clubId, clubs.id))
      .where(eq(clubFollows.userId, userId));

    return rows.map((r) => r.club);
  }

  async getFollowedClubIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ clubId: clubFollows.clubId })
      .from(clubFollows)
      .where(eq(clubFollows.userId, userId));
    return rows.map((r) => r.clubId);
  }

  async getClubFollowerCount(
    clubId: string
  ): Promise<number> {

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clubFollows)
      .where(eq(clubFollows.clubId, clubId));

    return row?.count ?? 0;
  }

  async favoriteClub(
    userId: string,
    clubId: string
  ): Promise<ClubFavorite> {

    const existing = await db
      .select()
      .from(clubFavorites)
      .where(
        and(
          eq(clubFavorites.userId, userId),
          eq(clubFavorites.clubId, clubId)
        )
      );

    if (existing[0]) {
      return existing[0];
    }

    const [favorite] = await db
      .insert(clubFavorites)
      .values({ userId, clubId })
      .returning();

    return favorite;
  }

  async unfavoriteClub(
    userId: string,
    clubId: string
  ): Promise<void> {

    await db
      .delete(clubFavorites)
      .where(
        and(
          eq(clubFavorites.userId, userId),
          eq(clubFavorites.clubId, clubId)
        )
      );
  }

  async isFavoritingClub(
    userId: string,
    clubId: string
  ): Promise<boolean> {

    const [existing] = await db
      .select()
      .from(clubFavorites)
      .where(
        and(
          eq(clubFavorites.userId, userId),
          eq(clubFavorites.clubId, clubId)
        )
      );

    return !!existing;
  }

  async getFavoritedClubs(
    userId: string
  ): Promise<Club[]> {

    const rows = await db
      .select({ club: clubs })
      .from(clubFavorites)
      .innerJoin(clubs, eq(clubFavorites.clubId, clubs.id))
      .where(eq(clubFavorites.userId, userId));

    return rows.map((r) => r.club);
  }

  async getFavoritedClubIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ clubId: clubFavorites.clubId })
      .from(clubFavorites)
      .where(eq(clubFavorites.userId, userId));
    return rows.map((r) => r.clubId);
  }

  async updateClub(
    id: string,
    club: Partial<InsertClub>
  ): Promise<Club> {
  
    const [updatedClub] = await db
      .update(clubs)
      .set({
  
        // Basic
        name: club.name,
        slug: club.slug,
        category: club.category,
        shortDescription: club.shortDescription,
        description: club.description,
  
        // Images
        image: club.image,
        logo: club.logo,
        cover: club.cover,
        gallery: club.gallery as string[] | undefined,
  
        // Location
        location: club.location,
        state: club.state,
        suburb: club.suburb,
        address: club.address,
        googleMapsUrl: club.googleMapsUrl,
        hasMultipleLocations: club.hasMultipleLocations,
        numberOfLocations: club.numberOfLocations,
  
        // Contact
        phone: club.phone,
        email: club.email,
        website: club.website,
        facebook: club.facebook,
        instagram: club.instagram,
  
        contactPersonName: club.contactPersonName,
        contactPersonRole: club.contactPersonRole,
        contactPersonEmail: club.contactPersonEmail,
        contactPersonPhone: club.contactPersonPhone,
        contactPersonNotes: club.contactPersonNotes,
        displayContactPerson: club.displayContactPerson,
  
        // Features
        hasCourts: club.hasCourts,
        hasCommunity: club.hasCommunity,
        hasCoaching: club.hasCoaching,
        hostsCompetitions: club.hostsCompetitions,
  
        // Courts
        courtSurfaces:
          club.courtSurfaces as string[] | undefined,
  
        indoorCourts: club.indoorCourts,
        outdoorCourts: club.outdoorCourts,
  
        hasLighting: club.hasLighting,
        courtBookingAvailable: club.courtBookingAvailable,
        membershipRequired: club.membershipRequired,
        publicAccess: club.publicAccess,
  
        socialTennisDays:
          club.socialTennisDays as string[] | undefined,
  
        // Services
        services:
          club.services as string[] | undefined,
  
        // Pricing
        hourlyPrice: club.hourlyPrice,
        pricingNotes: club.pricingNotes,
  
        // Competitions
        hostedCompetitions:
          club.hostedCompetitions as string[] | undefined,
  
        // Listing
        listingType: club.listingType,
        status: club.status,
        displayOrder: club.displayOrder,
  
        // Trust
        verified: club.verified,
        officialPartner: club.officialPartner,
        claimedListing: club.claimedListing,
  
        // SEO
        seoTitle: club.seoTitle,
        metaDescription: club.metaDescription,
        metaKeywords: club.metaKeywords,
  
        // CTA
        ctaText: club.ctaText,
        ctaUrl: club.ctaUrl,
  
        // Rating
        rating: club.rating,
  
        updatedAt: new Date(),
  
      })
      .where(eq(clubs.id, id))
      .returning();
  
    return updatedClub;
  
  }

  async deleteClub(
    id: string
  ): Promise<void> {
  
    await db
      .delete(clubs)
      .where(eq(clubs.id, id));
  
  }

  async publishClub(
    id: string
  ): Promise<Club> {
  
    const [club] = await db
      .update(clubs)
      .set({
        status: "published",
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, id))
      .returning();
  
    return club;
  
  }

  async unpublishClub(
    id: string
  ): Promise<Club> {
  
    const [club] = await db
      .update(clubs)
      .set({
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, id))
      .returning();
  
    return club;
  
  }

  async archiveClub(
    id: string
  ): Promise<Club> {
  
    const [club] = await db
      .update(clubs)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, id))
      .returning();
  
    return club;
  
  }

  async restoreClub(
    id: string
  ): Promise<Club> {
  
    const [club] = await db
      .update(clubs)
      .set({
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, id))
      .returning();
  
    return club;
  
  }

  async updateClubListing(
    id: string,
    listingType: "free" | "premium"
  ): Promise<Club> {
  
    const [club] = await db
      .update(clubs)
      .set({
        listingType,
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, id))
      .returning();
  
    return club;
  
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
        messageType: messages.messageType,
        relatedSessionId: messages.relatedSessionId,
        relatedOrganizationId: messages.relatedOrganizationId,
        actionStatus: messages.actionStatus,
  
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
        messageType: messages.messageType,
        relatedSessionId: messages.relatedSessionId,
        relatedOrganizationId: messages.relatedOrganizationId,
        actionStatus: messages.actionStatus,
  
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

  // Every unread message in a thread, for one specific recipient -
  // opening a conversation should clear all of it, not just the single
  // representative message the inbox list happens to show.
  async markConversationAsRead(conversationId: string, recipientId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.recipientId, recipientId),
          eq(messages.isRead, false)
        )
      );
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
        messageType: messages.messageType,
        relatedSessionId: messages.relatedSessionId,
        relatedOrganizationId: messages.relatedOrganizationId,
        actionStatus: messages.actionStatus,

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
        messageType: messages.messageType,
        relatedSessionId: messages.relatedSessionId,
        relatedOrganizationId: messages.relatedOrganizationId,
        actionStatus: messages.actionStatus,
  
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
      .select({
        count: sql<number>`count(*)`,
      })
      .from(users)
      .innerJoin(
        playerProfiles,
        eq(users.id, playerProfiles.userId)
      )
      .where(
        and(
          eq(users.role, "player"),
          eq(users.profileCompleted, true),
          eq(users.isApproved, true),
          eq(users.isTestUser, false),
          eq(playerProfiles.isDraft, false),
          eq(users.isHidden, false)
        )
      );
  
      const [coachesResult] = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(users)
        .innerJoin(
          coachProfiles,
          eq(users.id, coachProfiles.userId)
        )
        .where(
          and(
            eq(users.role, "coach"),
            eq(users.profileCompleted, true),
            eq(users.isApproved, true),
            eq(users.isTestUser, false),
            eq(coachProfiles.isDraft, false),
            eq(users.isHidden, false)
          )
        );
  
    const [clubsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clubs);
  
    const [sessionsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tennisSessions)
      .where(
        and(
          inArray(tennisSessions.status, ["published", "live", "completed"]),
          eq(tennisSessions.visibility, "public")
        )
      );

    return {
      players: Number(playersResult.count),
      coaches: Number(coachesResult.count),
      clubs: Number(clubsResult.count),
      sessions: Number(sessionsResult.count),
    };
  }

  // =====================
  // ORGANIZER REQUESTS
  // =====================

  async createOrganizerRequest(userId: string, note?: string): Promise<OrganizerRequest> {
    const [request] = await db
      .insert(organizerRequests)
      .values({ userId, note: note || null })
      .returning();
    return request;
  }

  async getLatestOrganizerRequest(userId: string): Promise<OrganizerRequest | undefined> {
    const [request] = await db
      .select()
      .from(organizerRequests)
      .where(eq(organizerRequests.userId, userId))
      .orderBy(desc(organizerRequests.createdAt))
      .limit(1);
    return request;
  }

  async getOrganizerRequestById(id: string): Promise<OrganizerRequest | undefined> {
    const [request] = await db
      .select()
      .from(organizerRequests)
      .where(eq(organizerRequests.id, id));
    return request;
  }

  async getOrganizerRequests(status?: string) {
    const rows = await db
      .select({
        request: organizerRequests,
        userName: users.name,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(organizerRequests)
      .innerJoin(users, eq(organizerRequests.userId, users.id))
      .where(status ? eq(organizerRequests.status, status) : undefined)
      .orderBy(desc(organizerRequests.createdAt));

    return rows.map((r) => ({
      ...r.request,
      userName: r.userName,
      userEmail: r.userEmail,
      userRole: r.userRole,
    }));
  }

  async approveOrganizerRequest(id: string, reviewerId: string): Promise<OrganizerRequest> {
    const [request] = await db
      .select()
      .from(organizerRequests)
      .where(eq(organizerRequests.id, id));

    if (!request) {
      throw new Error("Organiser request not found");
    }

    const [updated] = await db
      .update(organizerRequests)
      .set({ status: "approved", reviewedBy: reviewerId, reviewedAt: new Date() })
      .where(eq(organizerRequests.id, id))
      .returning();

    await db
      .update(users)
      .set({ isOrganizer: true })
      .where(eq(users.id, request.userId));

    return updated;
  }

  async rejectOrganizerRequest(id: string, reviewerId: string): Promise<OrganizerRequest> {
    const [updated] = await db
      .update(organizerRequests)
      .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date() })
      .where(eq(organizerRequests.id, id))
      .returning();

    if (!updated) {
      throw new Error("Organiser request not found");
    }

    return updated;
  }

  // =====================
  // ORGANIZATIONS
  // =====================

  async createOrganization(ownerId: string, org: InsertOrganization): Promise<Organization> {
    const slug = await generateUniqueOrgSlug(org.name);

    const [organization] = await db
      .insert(organizations)
      .values({ ...org, ownerId, slug })
      .returning();

    await db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: ownerId,
      role: "owner",
    });

    return organization;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug));
    return organization;
  }

  async getOrganizationById(id: string): Promise<Organization | undefined> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));
    return organization;
  }

  async getOrganizationOwnedByUser(userId: string): Promise<Organization | undefined> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    return organization;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const [organization] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return organization;
  }

  // =====================
  // SESSIONS
  // =====================

  private async attachSessionDetails(
    rows: TennisSession[],
    viewerId?: string,
    includeCreatorNames?: boolean
  ): Promise<SessionWithDetails[]> {
    if (rows.length === 0) return [];

    const orgIds = Array.from(new Set(rows.map((r) => r.organizationId)));
    const orgRows = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(sql`${organizations.id} IN ${orgIds}`);
    const orgById = new Map(orgRows.map((o) => [o.id, o]));

    const sessionIds = rows.map((r) => r.id);
    const regRows = await db
      .select({
        sessionId: registrations.sessionId,
        status: registrations.status,
        userId: registrations.userId,
        count: sql<number>`count(*)`,
      })
      .from(registrations)
      .where(sql`${registrations.sessionId} IN ${sessionIds}`)
      .groupBy(registrations.sessionId, registrations.status, registrations.userId);

    const divisionRows = await db
      .select({ parentSessionId: tennisSessions.parentSessionId })
      .from(tennisSessions)
      .where(sql`${tennisSessions.parentSessionId} IN ${sessionIds}`);
    const sessionIdsWithDivisions = new Set(divisionRows.map((r) => r.parentSessionId));

    // A division's own card needs to reference its tournament/event
    // without needing a second, separate block just to show the
    // container's name.
    const parentIds = Array.from(new Set(rows.map((r) => r.parentSessionId).filter((id): id is string => !!id)));
    let parentTitleById = new Map<string, string>();
    if (parentIds.length > 0) {
      const parentRows = await db
        .select({ id: tennisSessions.id, title: tennisSessions.title })
        .from(tennisSessions)
        .where(sql`${tennisSessions.id} IN ${parentIds}`);
      parentTitleById = new Map(parentRows.map((p) => [p.id, p.title]));
    }

    // checkedInAt exists on registrations but nothing has ever counted
    // it before - "Checked In" was hardcoded to 0 everywhere on the
    // client regardless of real data. There's still no UI to actually
    // check someone in yet (that's a separate, larger piece of work),
    // but the count itself is now genuinely real rather than a
    // permanent placeholder.
    const checkInRows = await db
      .select({ sessionId: registrations.sessionId, count: sql<number>`count(*)` })
      .from(registrations)
      .where(sql`${registrations.sessionId} IN ${sessionIds} AND ${registrations.checkedInAt} IS NOT NULL`)
      .groupBy(registrations.sessionId);
    const checkedInBySession = new Map(checkInRows.map((r) => [r.sessionId, Number(r.count)]));

      let creatorById = new Map<string, string>();
      let creatorAvatarById = new Map<string, string | null>();
    if (includeCreatorNames) {
      const creatorIds = Array.from(new Set(rows.map((r) => r.createdBy)));
     const creatorRows = await db
        .select({ id: users.id, name: users.name, avatar: users.avatar })
        .from(users)
        .where(sql`${users.id} IN ${creatorIds}`);
      creatorById = new Map(creatorRows.map((c) => [c.id, c.name]));
      creatorAvatarById = new Map(creatorRows.map((c) => [c.id, c.avatar]));
   }

    return rows.map((session) => {
      const org = orgById.get(session.organizationId);
      const sessionRegs = regRows.filter((r) => r.sessionId === session.id);
      const registeredCount = sessionRegs
        .filter((r) => r.status === "registered")
        .reduce((sum, r) => sum + Number(r.count), 0);
      const waitlistedCount = sessionRegs
        .filter((r) => r.status === "waitlisted")
        .reduce((sum, r) => sum + Number(r.count), 0);
      const viewerReg = viewerId
        ? sessionRegs.find((r) => r.userId === viewerId && r.status !== "cancelled")
        : undefined;

      return {
        ...session,
        organizationName: org?.name || "TennisConnect",
        organizationSlug: org?.slug || "",
        registeredCount,
        waitlistedCount,
        checkedInCount: checkedInBySession.get(session.id) ?? 0,
        spotsLeft:
          session.maxParticipants != null
            ? Math.max(0, session.maxParticipants - registeredCount)
            : null,
        viewerRegistrationStatus: viewerReg ? (viewerReg.status as any) : null,
        creatorName: includeCreatorNames ? creatorById.get(session.createdBy) : undefined,
        creatorAvatar: includeCreatorNames ? creatorAvatarById.get(session.createdBy) ?? null : undefined,
        hasDivisions: sessionIdsWithDivisions.has(session.id),
        parentSessionTitle: session.parentSessionId ? parentTitleById.get(session.parentSessionId) : undefined,
      };
    });
  }

  async createSession(
    organizationId: string,
    createdBy: string,
    session: InsertSession
  ): Promise<TennisSession> {
    const [createdSession] = await db
      .insert(tennisSessions)
      .values({
        ...session,
        organizationId,
        createdBy,
        price:
          session.price !== undefined && session.price !== null
            ? String(session.price)
            : null,
      })
      .returning();
  
    return createdSession;
  }

  async getSessionById(id: string): Promise<TennisSession | undefined> {
    const [session] = await db
      .select()
      .from(tennisSessions)
      .where(eq(tennisSessions.id, id));
    return session;
  }

  // The single-session GET route needs registeredCount/checkedInCount/
  // organizerName etc, the same as every list route already provides -
  // this was missing entirely before, so a session's own workspace
  // page was always showing 0 registered/checked-in and a fallback
  // mock organiser name regardless of the session's real data.
  async getSessionByIdWithDetails(id: string, viewerId?: string): Promise<SessionWithDetails | undefined> {
    const session = await this.getSessionById(id);
    if (!session) return undefined;
    const [enriched] = await this.attachSessionDetails([session], viewerId, true);
    return enriched;
  }

  // Every division of a Tournament/Club Championship "container"
  // session - Men's Singles A, Mixed Doubles, etc. Ordered by start
  // time so a multi-day event reads in a sensible order.
  async getSessionDivisions(parentSessionId: string): Promise<SessionWithDetails[]> {
    const rows = await db
      .select()
      .from(tennisSessions)
      .where(eq(tennisSessions.parentSessionId, parentSessionId))
      .orderBy(asc(tennisSessions.startAt));
    return this.attachSessionDetails(rows);
  }

  // Fast division creation: clones every real field from a base
  // session (normally the parent container, but can be an existing
  // sibling division instead - "duplicate this division" is the
  // fastest possible way to set up e.g. Men's Singles B once A
  // already exists) and only requires the caller to override what's
  // actually different, usually just the title. Always draft status,
  // regardless of the base session's status - a new division needs
  // its own review/publish, it doesn't inherit "already published".
  async createSessionDivision(
    baseSession: TennisSession,
    createdBy: string,
    overrides: Partial<InsertSession> & { title: string }
  ): Promise<TennisSession> {
    const {
      id,
      status,
      reviewedBy,
      reviewedAt,
      reviewNote,
      createdAt,
      updatedAt,
      parentSessionId,
      ...cloneable
    } = baseSession as any;

    const [created] = await db
      .insert(tennisSessions)
      .values({
        ...cloneable,
        ...overrides,
        organizationId: baseSession.organizationId,
        createdBy,
        status: "draft",
        parentSessionId: baseSession.parentSessionId ?? baseSession.id,
        price:
          overrides.price !== undefined
            ? String(overrides.price)
            : cloneable.price,
      })
      .returning();

    return created;
  }

  async getSessionsByOrganization(organizationId: string): Promise<TennisSession[]> {
    // A session that's genuinely wrapped up (past its end time, or its
    // start time if it has no explicit end) moves to archived - either
    // the organiser closed it out via TC Live, or nobody did and it's
    // simply done now. Only published/live/completed sessions qualify;
    // draft/cancelled/rejected/pending_review keep their own real
    // meaning regardless of how much time has passed.
    await db
      .update(tennisSessions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(tennisSessions.organizationId, organizationId),
          sql`${tennisSessions.status} IN ('published', 'live', 'completed')`,
          sql`COALESCE(${tennisSessions.endAt}, ${tennisSessions.startAt}) < now()`
        )
      );

    return db
      .select()
      .from(tennisSessions)
      .where(eq(tennisSessions.organizationId, organizationId))
      .orderBy(desc(tennisSessions.startAt));
  }

  async getUpcomingPublishedSessionsByOrganization(
    organizationId: string
  ): Promise<SessionWithDetails[]> {
    const rows = await db
      .select()
      .from(tennisSessions)
      .where(
        and(
          eq(tennisSessions.organizationId, organizationId),
          eq(tennisSessions.status, "published"),
          gte(tennisSessions.startAt, new Date())
        )
      )
      .orderBy(asc(tennisSessions.startAt));

    return this.attachSessionDetails(rows);
  }

  async getSessionsThisWeek(): Promise<SessionWithDetails[]> {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(tennisSessions)
      .where(
        and(
          eq(tennisSessions.status, "published"),
          eq(tennisSessions.visibility, "public"),
          gte(tennisSessions.startAt, now),
          lte(tennisSessions.startAt, weekFromNow)
        )
      )
      .orderBy(asc(tennisSessions.startAt));

    return this.attachSessionDetails(rows);
  }

  async getSessionsUserRegisteredFor(userId: string): Promise<SessionWithDetails[]> {
    const rows = await db
      .select({ session: tennisSessions })
      .from(registrations)
      .innerJoin(tennisSessions, eq(registrations.sessionId, tennisSessions.id))
      .where(
        and(
          eq(registrations.userId, userId),
          ne(registrations.status, "cancelled")
        )
      )
      .orderBy(asc(tennisSessions.startAt));

    return this.attachSessionDetails(rows.map((r) => r.session), userId, true);
  }

  async updateSession(
    id: string,
    updates: Partial<InsertSession>
  ): Promise<TennisSession> {
    const { price, ...rest } = updates;
  
    const normalizedUpdates = {
      ...rest,
      ...(price !== undefined
        ? { price: price !== null ? String(price) : null }
        : {}),
      updatedAt: new Date(),
    };
  
    const [session] = await db
      .update(tennisSessions)
      .set(normalizedUpdates)
      .where(eq(tennisSessions.id, id))
      .returning();
  
    return session;
  }

  async submitSessionForReview(id: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({ status: "pending_review", updatedAt: new Date() })
      .where(eq(tennisSessions.id, id))
      .returning();
    return session;
  }

  async approveSession(id: string, reviewerId: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({
        status: "published",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: null,
        updatedAt: new Date(),
      })
      .where(eq(tennisSessions.id, id))
      .returning();
    return session;
  }

  async rejectSession(id: string, reviewerId: string, note?: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note || null,
        updatedAt: new Date(),
      })
      .where(eq(tennisSessions.id, id))
      .returning();
    return session;
  }

  // Admins skip the review queue entirely — they're the ones approving
  // everyone else, so there's no one above them to approve their own events.
  async publishSessionDirect(id: string, reviewerId: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({
        status: "published",
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tennisSessions.id, id))
      .returning();
    return session;
  }

  async cancelSession(id: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(tennisSessions.id, id))
      .returning();
    return session;
  }

  // The Sessions list's "Archived" bucket (session-utils.ts bucketFor)
  // has always checked for status === "archived" - nothing on the
  // backend ever actually set that status until now.
  async archiveSession(id: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(tennisSessions.id, id))
      .returning();
    return session;
  }

  // Drafts only, by design - a session that's ever been submitted for
  // review (or beyond) should be cancelled instead, never deleted, since
  // players may already be registered and admins may already have a
  // record of reviewing it. Caller (the route) is responsible for
  // checking ownership before calling this.
  async deleteSession(id: string): Promise<void> {
    await db
      .delete(tennisSessions)
      .where(and(eq(tennisSessions.id, id), eq(tennisSessions.status, "draft")));
  }

  async getAllSessionsForAdmin(status?: string): Promise<SessionWithDetails[]> {
    const rows = await db
      .select()
      .from(tennisSessions)
      .where(status ? eq(tennisSessions.status, status) : undefined)
      .orderBy(desc(tennisSessions.createdAt));

    return this.attachSessionDetails(rows, undefined, true);
  }

  // =====================
  // REGISTRATIONS
  // =====================

  async registerForSession(
    sessionId: string,
    userId: string
  ): Promise<{ registration: Registration; waitlisted: boolean }> {
    const [session] = await db
      .select()
      .from(tennisSessions)
      .where(eq(tennisSessions.id, sessionId));

    if (!session) {
      throw new Error("Session not found");
    }
    if (session.status !== "published") {
      throw new Error("Session is not open for registration");
    }

    const [existing] = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.sessionId, sessionId),
          eq(registrations.userId, userId)
        )
      );

    const { registered } = await this.getSessionRegistrationCounts(sessionId);
    const isFull =
      session.maxParticipants != null && registered >= session.maxParticipants;
    const nextStatus = isFull
      ? (session.waitingListEnabled ? "waitlisted" : null)
      : "registered";

    if (!nextStatus) {
      throw new Error("Session is full");
    }

    if (existing && existing.status !== "cancelled") {
      return { registration: existing, waitlisted: existing.status === "waitlisted" };
    }

    if (existing) {
      const [updated] = await db
        .update(registrations)
        .set({ status: nextStatus, checkedInAt: null })
        .where(eq(registrations.id, existing.id))
        .returning();
      return { registration: updated, waitlisted: nextStatus === "waitlisted" };
    }

    const [created] = await db
      .insert(registrations)
      .values({ sessionId, userId, status: nextStatus })
      .returning();
    return { registration: created, waitlisted: nextStatus === "waitlisted" };
  }

  async cancelRegistration(sessionId: string, userId: string): Promise<Registration> {
    const [existing] = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.sessionId, sessionId),
          eq(registrations.userId, userId)
        )
      );

    if (!existing) {
      throw new Error("Registration not found");
    }

    const wasRegistered = existing.status === "registered";

    const [cancelled] = await db
      .update(registrations)
      .set({ status: "cancelled" })
      .where(eq(registrations.id, existing.id))
      .returning();

    // A spot opened up — promote the longest-waiting waitlisted player.
    if (wasRegistered) {
      const [nextInLine] = await db
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.sessionId, sessionId),
            eq(registrations.status, "waitlisted")
          )
        )
        .orderBy(asc(registrations.createdAt))
        .limit(1);

      if (nextInLine) {
        await db
          .update(registrations)
          .set({ status: "registered" })
          .where(eq(registrations.id, nextInLine.id));
      }
    }

    return cancelled;
  }

  // Real registrations for a session, joined with just enough user info
  // to display a name/avatar/link - the organizer-facing Players and
  // Registration tabs use this. Ordered oldest-first so "who joined
  // first" reads naturally (waitlist promotion already relies on the
  // same ordering above).
  async getRegistrationsForSession(sessionId: string): Promise<RegistrationWithUser[]> {
    const rows = await db
      .select({
        registration: registrations,
        userName: users.name,
        userSlug: users.slug,
        userAvatar: users.avatar,
        userIsTestUser: users.isTestUser,
        userRole: users.role,
      })
      .from(registrations)
      .innerJoin(users, eq(registrations.userId, users.id))
      .where(eq(registrations.sessionId, sessionId))
      .orderBy(asc(registrations.createdAt));

    return rows.map((row) => ({
      ...row.registration,
      userName: row.userName,
      userSlug: row.userSlug,
      userAvatar: row.userAvatar,
      userIsTestUser: row.userIsTestUser,
      userRole: row.userRole,
    }));
  }

  // Org-wide player roster ("Players" page) - one row per distinct
  // player who's ever registered (non-cancelled) for any of this
  // organization's sessions, with a real sessionsPlayed count and the
  // most recent session they registered for. Level/win-rate aren't
  // derivable from registration data alone (no ratings or match
  // results exist yet) - those stay the caller's responsibility to
  // default sensibly, this only returns what's actually knowable.
  async getPlayersForOrganization(organizationId: string): Promise<OrgPlayerRow[]> {
    const rows = await db
      .select({
        userId: registrations.userId,
        userName: users.name,
        userSlug: users.slug,
        userAvatar: users.avatar,
        sessionsPlayed: sql<number>`count(distinct ${registrations.id})`,
        lastPlayedAt: sql<string>`max(${tennisSessions.startAt})`,
      })
      .from(registrations)
      .innerJoin(tennisSessions, eq(registrations.sessionId, tennisSessions.id))
      .innerJoin(users, eq(registrations.userId, users.id))
      .where(
        and(
          eq(tennisSessions.organizationId, organizationId),
          ne(registrations.status, "cancelled")
        )
      )
      .groupBy(registrations.userId, users.name, users.slug, users.avatar)
      .orderBy(desc(sql`count(distinct ${registrations.id})`));

    return rows;
  }

  async getViewerRegistrationStatus(sessionId: string, userId: string): Promise<string | null> {
    const [existing] = await db
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.sessionId, sessionId),
          eq(registrations.userId, userId),
          ne(registrations.status, "cancelled")
        )
      );
    return existing?.status || null;
  }

  // Organiser inviting a specific player to a specific session - same
  // existing/cancelled/none pattern as joinSession, except the target
  // status is always "invited" rather than computed from capacity. If
  // they're already registered/waitlisted/invited, this is a no-op
  // (returns what's there rather than clobbering a real registration
  // with an invite).
  async createInvitedRegistration(sessionId: string, userId: string): Promise<Registration> {
    const [existing] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.sessionId, sessionId), eq(registrations.userId, userId)));

    if (existing && existing.status !== "cancelled") {
      return existing;
    }

    if (existing) {
      const [updated] = await db
        .update(registrations)
        .set({ status: "invited", checkedInAt: null })
        .where(eq(registrations.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(registrations)
      .values({ sessionId, userId, status: "invited" })
      .returning();
    return created;
  }

  // Organiser inviting a player to their Community (not tied to any
  // session). Same upsert shape as createInvitedRegistration - a
  // declined membership can be re-invited, an already-pending/accepted
  // one is left alone rather than re-triggering a message.
  async createOrganizationMembership(organizationId: string, userId: string): Promise<CommunityMembership> {
    const [existing] = await db
      .select()
      .from(communityMemberships)
      .where(and(eq(communityMemberships.organizationId, organizationId), eq(communityMemberships.userId, userId)));

    if (existing && existing.status !== "declined") {
      return existing;
    }

    if (existing) {
      const [updated] = await db
        .update(communityMemberships)
        .set({ status: "pending" })
        .where(eq(communityMemberships.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(communityMemberships)
      .values({ organizationId, userId, status: "pending" })
      .returning();
    return created;
  }

  // Player accepting a session invite - always a guaranteed registered
  // spot, not subject to the usual capacity/waitlist check joinSession
  // applies to a self-initiated join, since the organiser already
  // decided to include this specific player when they sent the invite.
  async acceptInvitedRegistration(sessionId: string, userId: string): Promise<Registration> {
    const [existing] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.sessionId, sessionId), eq(registrations.userId, userId)));

    if (!existing) {
      throw new Error("Invitation not found");
    }

    const [updated] = await db
      .update(registrations)
      .set({ status: "registered" })
      .where(eq(registrations.id, existing.id))
      .returning();
    return updated;
  }

  async updateMessageActionStatus(id: string, actionStatus: string): Promise<Message> {
    const [updated] = await db
      .update(messages)
      .set({ actionStatus })
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async updateOrganizationMembershipStatus(organizationId: string, userId: string, status: string): Promise<CommunityMembership> {
    const [updated] = await db
      .update(communityMemberships)
      .set({ status })
      .where(and(eq(communityMemberships.organizationId, organizationId), eq(communityMemberships.userId, userId)))
      .returning();
    if (!updated) {
      throw new Error("Membership not found");
    }
    return updated;
  }

  // Simple name search across real (non-test) users, for both invite
  // dialogs - excludes the searching organiser themselves.
  async searchUsers(
    query: string,
    excludeUserId: string,
    limit = 10,
    context?: { sessionId?: string; organizationId?: string }
  ): Promise<(Pick<User, "id" | "name" | "slug" | "avatar" | "role"> & { alreadyConnected: boolean })[]> {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        slug: users.slug,
        avatar: users.avatar,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          ilike(users.name, `%${query}%`),
          ne(users.id, excludeUserId)
        )
      )
      .limit(limit);

    if (rows.length === 0) return [];

    const userIds = rows.map((r) => r.id);
    let connectedIds = new Set<string>();

    // Already registered/waitlisted/checked-in/invited for this exact
    // session - re-inviting them would be pointless, they're already in.
    if (context?.sessionId) {
      const regs = await db
        .select({ userId: registrations.userId })
        .from(registrations)
        .where(
          and(
            eq(registrations.sessionId, context.sessionId),
            sql`${registrations.userId} IN ${userIds}`,
            ne(registrations.status, "cancelled")
          )
        );
      connectedIds = new Set(regs.map((r) => r.userId));
    } else if (context?.organizationId) {
      // Already pending or accepted into this community - a declined
      // invite can still be re-sent, everything else can't.
      const members = await db
        .select({ userId: communityMemberships.userId })
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.organizationId, context.organizationId),
            sql`${communityMemberships.userId} IN ${userIds}`,
            ne(communityMemberships.status, "declined")
          )
        );
      connectedIds = new Set(members.map((m) => m.userId));
    }

    return rows.map((r) => ({ ...r, alreadyConnected: connectedIds.has(r.id) }));
  }

  async getSessionRegistrationCounts(
    sessionId: string
  ): Promise<{ registered: number; waitlisted: number }> {
    const rows = await db
      .select({ status: registrations.status, count: sql<number>`count(*)` })
      .from(registrations)
      .where(eq(registrations.sessionId, sessionId))
      .groupBy(registrations.status);

    const registered = rows.find((r) => r.status === "registered")?.count || 0;
    const waitlisted = rows.find((r) => r.status === "waitlisted")?.count || 0;
    return { registered: Number(registered), waitlisted: Number(waitlisted) };
  }

  // =====================
  // TC LIVE ENGINE
  // =====================

  async checkInRegistration(registrationId: string): Promise<Registration> {
    const [registration] = await db
      .update(registrations)
      .set({ checkedInAt: new Date() })
      .where(eq(registrations.id, registrationId))
      .returning();
    if (!registration) throw new Error("Registration not found");
    return registration;
  }

  async setRegistrationLiveStatus(
    registrationId: string,
    liveStatus: "unavailable" | "withdrawn" | null
  ): Promise<Registration> {
    const [registration] = await db
      .update(registrations)
      .set({ liveStatus })
      .where(eq(registrations.id, registrationId))
      .returning();
    if (!registration) throw new Error("Registration not found");
    return registration;
  }

  // draft/published -> live. Caller (route) is responsible for checking
  // there's at least 2 checked-in players first - this just flips status.
  async goLiveSession(sessionId: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({ status: "live", updatedAt: new Date() })
      .where(eq(tennisSessions.id, sessionId))
      .returning();
    return session;
  }

  // live -> completed. Leaderboard is computed on demand from confirmed
  // matches (getSessionLeaderboard), not snapshotted here - see TC Live
  // spec §6 for why writing into tournamentHistory is a separate, later step.
  async finishSession(sessionId: string): Promise<TennisSession> {
    const [session] = await db
      .update(tennisSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(tennisSessions.id, sessionId))
      .returning();
    return session;
  }

  // Every checked-in, available (liveStatus IS NULL) player for a session -
  // the pool round generation draws from. Accepts an optional transaction
  // handle so generateNextRound can call this from inside db.transaction().
  private async getLiveEligiblePlayers(sessionId: string, dbOrTx: DbQueryExecutor = db): Promise<{ id: string }[]> {
    const rows = await dbOrTx
      .select({ userId: registrations.userId })
      .from(registrations)
      .where(
        and(
          eq(registrations.sessionId, sessionId),
          sql`${registrations.checkedInAt} IS NOT NULL`,
          isNull(registrations.liveStatus)
        )
      );
    return rows.map((r) => ({ id: r.userId }));
  }

  // Rest count per player across every round generated so far, from the
  // frozen `restingPlayerIds` snapshot on each session_rounds row.
  private async getRestCounts(sessionId: string, dbOrTx: DbQueryExecutor = db): Promise<Record<string, number>> {
    const rounds = await dbOrTx
      .select({ restingPlayerIds: sessionRounds.restingPlayerIds })
      .from(sessionRounds)
      .where(eq(sessionRounds.sessionId, sessionId));

    const counts: Record<string, number> = {};
    for (const r of rounds) {
      for (const id of r.restingPlayerIds ?? []) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    return counts;
  }

  private async getPastMatches(sessionId: string, dbOrTx: DbQueryExecutor = db): Promise<PastMatch[]> {
    const rows = await dbOrTx
      .select({ teamAIds: matches.teamAIds, teamBIds: matches.teamBIds })
      .from(matches)
      .where(eq(matches.sessionId, sessionId));
    return rows.map((r) => ({ teamAIds: r.teamAIds ?? [], teamBIds: r.teamBIds ?? [] }));
  }

  // Attaches name/avatar to every player id referenced by a batch of
  // matches, for the live screen's court cards.
  private async attachPlayersToMatches(matchRows: Match[]): Promise<MatchWithPlayers[]> {
    const allIds = Array.from(
      new Set(matchRows.flatMap((m) => [...(m.teamAIds ?? []), ...(m.teamBIds ?? [])]))
    );
    if (allIds.length === 0) {
      return matchRows.map((m) => ({ ...m, teamA: [], teamB: [] }));
    }
    const userRows = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(users)
      .where(inArray(users.id, allIds));
    const byId = new Map(userRows.map((u) => [u.id, u]));
    const toPlayers = (ids: string[]) =>
      ids
        .map((id) => byId.get(id))
        .filter((u): u is { id: string; name: string; avatar: string | null } => !!u);

    return matchRows.map((m) => ({
      ...m,
      teamA: toPlayers(m.teamAIds ?? []),
      teamB: toPlayers(m.teamBIds ?? []),
    }));
  }

  // Generates the next round: figures out who's eligible, hands the pure
  // pairing decision to liveEngine.planRound, then persists the round +
  // its matches. Throws if a round is already active and not fully
  // confirmed yet - the route surfaces this as a 400, since "Generate
  // Next Round" should be disabled on the client whenever that's true.
  // Generates the next round: figures out who's eligible, hands the pure
  // pairing decision to liveEngine.planRound, then persists the round +
  // its matches. Wrapped in a transaction (see deleteUserAccount above for
  // the existing pattern in this file) so a crash between the round row
  // and its matches can't leave a round with zero matches sitting active -
  // per TC Live spec §14, round generation must be atomic.
  //
  // The active-round check is re-run inside the transaction (not just
  // before it) to shrink the race window between two concurrent "Generate
  // Round" clicks; the (sessionId, roundNumber) unique constraint on
  // session_rounds is the final backstop if both still slip through, and
  // that specific violation is turned into the same clean 400 the
  // pre-check produces rather than a raw Postgres error reaching the client.
  async generateNextRound(sessionId: string): Promise<{ round: SessionRound; matches: MatchWithPlayers[] }> {
    const [session] = await db.select().from(tennisSessions).where(eq(tennisSessions.id, sessionId));
    if (!session) throw new Error("Session not found");

    try {
      const { round, insertedMatches } = await db.transaction(async (tx) => {
        const existingRounds = await tx
          .select()
          .from(sessionRounds)
          .where(eq(sessionRounds.sessionId, sessionId))
          .orderBy(desc(sessionRounds.roundNumber));

        const activeRound = existingRounds.find((r) => r.status === "active");
        if (activeRound) {
          throw new Error("Current round isn't fully confirmed yet");
        }

        const [players, pastMatches, restCounts] = await Promise.all([
          this.getLiveEligiblePlayers(sessionId, tx),
          this.getPastMatches(sessionId, tx),
          this.getRestCounts(sessionId, tx),
        ]);

        if (players.length < 2) {
          throw new Error("Need at least 2 eligible checked-in players to generate a round");
        }

        const plan = planRound({
          players,
          courtsCount: session.courtsCount ?? 1,
          mode: (session.matchMode as "singles" | "doubles") ?? "doubles",
          pastMatches,
          restCounts,
        });

        const nextRoundNumber = (existingRounds[0]?.roundNumber ?? 0) + 1;

        const [round] = await tx
          .insert(sessionRounds)
          .values({
            sessionId,
            roundNumber: nextRoundNumber,
            status: plan.matches.length > 0 ? "active" : "completed",
            restingPlayerIds: plan.restingPlayerIds,
            completedAt: plan.matches.length > 0 ? undefined : new Date(),
          })
          .returning();

        let insertedMatches: Match[] = [];
        if (plan.matches.length > 0) {
          insertedMatches = await tx
            .insert(matches)
            .values(
              plan.matches.map((m) => ({
                sessionId,
                roundId: round.id,
                courtLabel: m.courtLabel,
                teamAIds: m.teamAIds,
                teamBIds: m.teamBIds,
                status: "pending" as const,
              }))
            )
            .returning();
        }

        console.log(
          `[TC LIVE] session ${sessionId}: round ${nextRoundNumber} generated - ` +
            `${insertedMatches.length} matches, ${plan.restingPlayerIds.length} resting`
        );

        return { round, insertedMatches };
      });

      return { round, matches: await this.attachPlayersToMatches(insertedMatches) };
    } catch (error: any) {
      // Postgres unique_violation on the (sessionId, roundNumber) backstop -
      // two concurrent "Generate Round" clicks both passed the pre-check
      // and raced to insert. Surface the same message as the pre-check
      // instead of a raw constraint error reaching the client.
      if (error?.code === "23505") {
        throw new Error("Current round isn't fully confirmed yet");
      }
      throw error;
    }
  }

  async getCurrentRound(sessionId: string): Promise<{ round: SessionRound; matches: MatchWithPlayers[] } | undefined> {
    const [round] = await db
      .select()
      .from(sessionRounds)
      .where(eq(sessionRounds.sessionId, sessionId))
      .orderBy(desc(sessionRounds.roundNumber))
      .limit(1);
    if (!round) return undefined;

    const roundMatches = await db.select().from(matches).where(eq(matches.roundId, round.id));
    return { round, matches: await this.attachPlayersToMatches(roundMatches) };
  }

  async startMatch(matchId: string): Promise<Match> {
    const [match] = await db
      .update(matches)
      .set({ status: "playing", startedAt: new Date() })
      .where(eq(matches.id, matchId))
      .returning();
    if (!match) throw new Error("Match not found");
    return match;
  }

  // Organizer-only score entry (v0.1 - see TC Live spec §5): saving a
  // score confirms it immediately, no second-party confirmation step.
  // reportedBy/confirmedBy are both the organizer for now, kept separate
  // in the schema so player self-report can land later without a migration.
  // If every match in the round is now confirmed, the round is closed -
  // that's what unlocks "Generate Next Round" on the client.
  // Organizer-only score entry (v0.1 - see TC Live spec §5): saving a
  // score confirms it immediately, no second-party confirmation step.
  // reportedBy/confirmedBy are both the organizer for now, kept separate
  // in the schema so player self-report can land later without a migration.
  // Re-submitting a score for an already-confirmed match is allowed on
  // purpose - organizers need to be able to correct a mis-entered score
  // (TC Live spec §21) - the leaderboard always derives from the current
  // stored score, so a correction can't create duplicate stats.
  // If every match in the round is now confirmed, the round is closed -
  // that's what unlocks "Generate Next Round" on the client.
  async reportMatchScore(
    matchId: string,
    organizerId: string,
    teamAGames: number,
    teamBGames: number
  ): Promise<Match> {
    const [existing] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!existing) throw new Error("Match not found");

    const [session] = await db.select().from(tennisSessions).where(eq(tennisSessions.id, existing.sessionId));
    if (!session || session.status !== "live") {
      throw new Error("Can only enter scores while the session is live");
    }

    const isCorrection = existing.status === "confirmed";

    const match = await db.transaction(async (tx) => {
      const [match] = await tx
        .update(matches)
        .set({
          teamAGames,
          teamBGames,
          status: "confirmed",
          reportedBy: organizerId,
          confirmedBy: organizerId,
          confirmedAt: new Date(),
        })
        .where(eq(matches.id, matchId))
        .returning();

      const roundMatches = await tx.select().from(matches).where(eq(matches.roundId, match.roundId));
      const allConfirmed = roundMatches.every((m) => m.status === "confirmed");
      if (allConfirmed) {
        await tx
          .update(sessionRounds)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(sessionRounds.id, match.roundId));
      }
      return match;
    });

    console.log(
      `[TC LIVE] session ${existing.sessionId}: match ${matchId} ${isCorrection ? "corrected" : "confirmed"} - ` +
        `${teamAGames}-${teamBGames}`
    );

    return match;
  }

  async getSessionLeaderboard(sessionId: string): Promise<LeaderboardRow[]> {
    const [matchRows, restCounts, registeredPlayers] = await Promise.all([
      db.select().from(matches).where(eq(matches.sessionId, sessionId)),
      this.getRestCounts(sessionId),
      db
        .select({ userId: registrations.userId })
        .from(registrations)
        .where(and(eq(registrations.sessionId, sessionId), ne(registrations.status, "cancelled"))),
    ]);

    const entries = computeLeaderboard({
      matches: matchRows.map((m) => ({
        teamAIds: m.teamAIds ?? [],
        teamBIds: m.teamBIds ?? [],
        teamAGames: m.teamAGames,
        teamBGames: m.teamBGames,
        status: m.status,
      })),
      restCounts,
      players: registeredPlayers.map((r) => ({ id: r.userId })),
    });

    if (entries.length === 0) return [];
    const userRows = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(users)
      .where(inArray(users.id, entries.map((e) => e.userId)));
    const byId = new Map(userRows.map((u) => [u.id, u]));

    return entries.map((e) => ({
      ...e,
      userName: byId.get(e.userId)?.name ?? "Unknown player",
      userAvatar: byId.get(e.userId)?.avatar ?? null,
    }));
  }
}

export const storage = new DatabaseStorage();