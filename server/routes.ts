import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword } from "./auth";
import passport from "passport";
import { 
  insertUserSchema,
  insertPlayerProfileSchema,
  insertCoachProfileSchema,
  insertTournamentSchema,
  insertMarketplaceItemSchema,
  insertClubSchema,
  insertMessageSchema,
} from "@shared/schema";
import { z } from "zod";

// Auth middleware
function requireAuth(req: Request, res: Response, next: Function) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ===== AUTH ROUTES =====
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      const existingUser = await storage.getUserByEmail(result.data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(result.data.password);
      const user = await storage.createUser({
        ...result.data,
        password: hashedPassword,
      });

      req.login({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        cover: user.cover,
      }, (err) => {
        if (err) return next(err);
        res.json({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          cover: user.cover,
        });
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login failed" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // ===== USER ROUTES =====
  app.put("/api/users/:id", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.id !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const user = await storage.updateUser(req.params.id, {
        avatar: req.body.avatar,
        cover: req.body.cover,
      });

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        cover: user.cover,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // ===== PLAYER PROFILE ROUTES =====
  app.get("/api/player-profile", requireAuth, async (req, res, next) => {
    try {
      const profile = await storage.getPlayerProfile(req.user!.id);
      res.json(profile || null);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/player-profile", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'player') {
        return res.status(403).json({ message: "Only players can create player profiles" });
      }

      const result = insertPlayerProfileSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });

      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      const profile = await storage.createPlayerProfile(result.data);
      res.json(profile);
    } catch (error: any) {
      next(error);
    }
  });

  app.put("/api/player-profile/:id", requireAuth, async (req, res, next) => {
    try {
      const existingProfile = await storage.getPlayerProfile(req.user!.id);
      if (!existingProfile || existingProfile.id !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const profile = await storage.updatePlayerProfile(req.params.id, req.body);
      res.json(profile);
    } catch (error: any) {
      next(error);
    }
  });

  // ===== COACH PROFILE ROUTES =====
  app.get("/api/coach-profile", requireAuth, async (req, res, next) => {
    try {
      const profile = await storage.getCoachProfile(req.user!.id);
      res.json(profile || null);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/coaches", async (req, res, next) => {
    try {
      const coaches = await storage.getAllCoaches();
      res.json(coaches);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/players", async (req, res, next) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/coach-profile", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== 'coach') {
        return res.status(403).json({ message: "Only coaches can create coach profiles" });
      }

      const result = insertCoachProfileSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });

      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      const profile = await storage.createCoachProfile(result.data);
      res.json(profile);
    } catch (error: any) {
      next(error);
    }
  });

  app.put("/api/coach-profile/:id", requireAuth, async (req, res, next) => {
    try {
      const existingProfile = await storage.getCoachProfile(req.user!.id);
      if (!existingProfile || existingProfile.id !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const profile = await storage.updateCoachProfile(req.params.id, req.body);
      res.json(profile);
    } catch (error: any) {
      next(error);
    }
  });

  // ===== TOURNAMENT ROUTES =====
  app.get("/api/tournaments", requireAuth, async (req, res, next) => {
    try {
      const tournaments = await storage.getUserTournaments(req.user!.id);
      res.json(tournaments);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/tournaments", requireAuth, async (req, res, next) => {
    try {
      const result = insertTournamentSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
      });

      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      const tournament = await storage.createTournament(result.data);
      res.json(tournament);
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/tournaments/:id", requireAuth, async (req, res, next) => {
    try {
      await storage.deleteTournament(req.params.id);
      res.json({ message: "Tournament deleted" });
    } catch (error: any) {
      next(error);
    }
  });

  // ===== MARKETPLACE ROUTES =====
  app.get("/api/marketplace", async (req, res, next) => {
    try {
      const items = await storage.getAllMarketplaceItems();
      res.json(items);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/marketplace/user", requireAuth, async (req, res, next) => {
    try {
      const items = await storage.getUserMarketplaceItems(req.user!.id);
      res.json(items);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/marketplace", requireAuth, async (req, res, next) => {
    try {
      const result = insertMarketplaceItemSchema.safeParse({
        ...req.body,
        userId: req.user!.id,
        sellerName: req.user!.name,
        sellerEmail: req.user!.email,
      });

      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      const item = await storage.createMarketplaceItem(result.data);
      res.json(item);
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/marketplace/:id", requireAuth, async (req, res, next) => {
    try {
      await storage.deleteMarketplaceItem(req.params.id);
      res.json({ message: "Item deleted" });
    } catch (error: any) {
      next(error);
    }
  });

  // ===== CLUBS ROUTES =====
  app.get("/api/clubs", async (req, res, next) => {
    try {
      const clubs = await storage.getAllClubs();
      res.json(clubs);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/clubs", requireAuth, async (req, res, next) => {
    try {
      const result = insertClubSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      const club = await storage.createClub(result.data);
      res.json(club);
    } catch (error: any) {
      next(error);
    }
  });

  // ===== MESSAGE ROUTES =====
  // Get user's messages (requires auth)
  app.get("/api/messages", requireAuth, async (req, res, next) => {
    try {
      const messages = await storage.getUserMessages(req.user!.id);
      res.json(messages);
    } catch (error: any) {
      next(error);
    }
  });

  // Get unread message count (requires auth)
  app.get("/api/messages/unread-count", requireAuth, async (req, res, next) => {
    try {
      const count = await storage.getUnreadMessageCount(req.user!.id);
      res.json({ count });
    } catch (error: any) {
      next(error);
    }
  });

  // Send a message (can be from authenticated or anonymous users)
  app.post("/api/messages", async (req, res, next) => {
    try {
      const messageSchema = z.object({
        recipientId: z.string(),
        recipientType: z.enum(["coach", "player"]),
        senderName: z.string().min(1, "Name is required"),
        senderEmail: z.string().email("Valid email is required"),
        senderPhone: z.string().optional(),
        subject: z.string().optional(),
        content: z.string().min(1, "Message is required"),
      });

      const result = messageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      const messageData = {
        ...result.data,
        senderUserId: req.isAuthenticated() ? req.user!.id : null,
      };

      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error: any) {
      next(error);
    }
  });

  // Mark message as read (requires auth + ownership)
  app.put("/api/messages/:id/read", requireAuth, async (req, res, next) => {
    try {
      const existingMessage = await storage.getMessageById(req.params.id);
      if (!existingMessage || existingMessage.recipientId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const message = await storage.markMessageAsRead(req.params.id);
      res.json(message);
    } catch (error: any) {
      next(error);
    }
  });

  // Delete message (requires auth + ownership)
  app.delete("/api/messages/:id", requireAuth, async (req, res, next) => {
    try {
      const existingMessage = await storage.getMessageById(req.params.id);
      if (!existingMessage || existingMessage.recipientId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteMessage(req.params.id);
      res.json({ message: "Message deleted" });
    } catch (error: any) {
      next(error);
    }
  });

  return httpServer;
}
