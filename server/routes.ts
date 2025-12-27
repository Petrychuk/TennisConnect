import type { Express, Request, Response } from "express";
import crypto from "crypto";
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

/* =========================
   HELPERS & MIDDLEWARE
========================= */

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireRole(role: "player" | "coach") {
  return (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.user!.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

function generateSlug(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const suffix = crypto.randomBytes(2).toString("hex");
  return `${base}-${suffix}`;
}

/* =========================
   ROUTES
========================= */

export async function registerRoutes(app: Express): Promise<void> {

  /* =========================
     AUTH
  ========================= */

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = insertUserSchema
        .omit({ slug: true })
        .safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid input",
          errors: parsed.error,
        });
      }

      const exists = await storage.getUserByEmail(parsed.data.email);
      if (exists) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(parsed.data.password);
      const slug = generateSlug(parsed.data.name);

      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword,
        slug,
      });

      // 🔑 AUTO-CREATE PROFILE
      if (user.role === "player") {
        await storage.createPlayerProfile({
          userId: user.id,
          location: "Sydney",
          skillLevel: "Beginner",
        });
      }

      if (user.role === "coach") {
        await storage.createCoachProfile({
          userId: user.id,
          title: "Coach",
          location: "Sydney",
        });
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });

    } catch (e) {
      next(e);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate(
      "local", 
      (
        err: any,
        user: Express.User | false,
        info: { message?: string } | undefined
        ) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Login failed" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  /* =========================
     ME (CURRENT USER)
  ========================= */

  app.get("/api/me", requireAuth, (req, res) => {
    res.json(req.user);
  });

  app.get(
    "/api/me/player-profile",
    requireAuth,
    requireRole("player"),
    async (req, res) => {
      const profile = await storage.getPlayerProfile(req.user!.id);
      res.json(profile);
    }
  );

  app.put(
    "/api/me/player-profile",
    requireAuth,
    requireRole("player"),
    async (req, res) => {
      const profile = await storage.updatePlayerProfileByUserId(
        req.user!.id,
        req.body
      );
      res.json(profile);
    }
  );

  app.get(
    "/api/me/coach-profile",
    requireAuth,
    requireRole("coach"),
    async (req, res) => {
      const profile = await storage.getCoachProfile(req.user!.id);
      res.json(profile);
    }
  );

  app.put(
    "/api/me/coach-profile",
    requireAuth,
    requireRole("coach"),
    async (req, res) => {
      const profile = await storage.updateCoachProfileByUserId(
        req.user!.id,
        req.body
      );
      res.json(profile);
    }
  );

  /* =========================
     PUBLIC PROFILES
  ========================= */

  app.get("/api/players", async (_req, res) => {
    const players = await storage.getAllPlayers();
    res.json(players);
  });

  app.get("/api/players/:slug", async (req, res) => {
    const user = await storage.getUserBySlug(req.params.slug);
    if (!user || user.role !== "player") {
      return res.status(404).json({ message: "Player not found" });
    }
    const profile = await storage.getPlayerProfile(user.id);
    res.json({ user, profile });
  });

  app.get("/api/coaches", async (_req, res) => {
    const coaches = await storage.getAllCoachesWithProfiles();
    res.json(coaches);
  });

  app.get("/api/coaches/:slug", async (req, res) => {
    const user = await storage.getUserBySlug(req.params.slug);
    if (!user || user.role !== "coach") {
      return res.status(404).json({ message: "Coach not found" });
    }
    const profile = await storage.getCoachProfile(user.id);
    res.json({ user, profile });
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

  // Send a message (can be from authenticated)
  app.post("/api/messages", requireAuth, async (req, res, next) => {
    try {
      const messageSchema = z.object({
        recipientId: z.string(),
        recipientType: z.enum(["coach", "player"]),
        subject: z.string().optional(),
        content: z.string().min(1, "Message is required"),
      });

      const result = messageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error });
      }

      // 🔐 sender ВСЕГДА из auth-сессии
      const message = await storage.createMessage({
        recipientId: result.data.recipientId,
        recipientType: result.data.recipientType,
        subject: result.data.subject,
        content: result.data.content,

        senderUserId: req.user!.id,
        senderName: req.user!.name,
        senderEmail: req.user!.email,
      });

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
}
