import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword, comparePasswords } from "./auth";
import uploadMediaRouter from "./routes/uploadMedia";
import profileTournamentHistoryRouter from "./routes/profileTournamentHistory";
import profileMarketplace from "./routes/profileMarketplace";
import contentRouter from "./routes/content";
import passport from "passport";
import { requireAuth, requireAdmin } from "./requireAuth";
import supportRoutes from "./routes/supportRoutes";
import { sendSystemMessage } from "./services/systemMessages";


import {
  insertUserSchema,
  insertPlayerProfileSchema,
  insertCoachProfileSchema,
  insertTournamentHistorySchema,
  insertMarketplaceItemSchema,
  insertClubSchema,
  insertMessageSchema,
  passwordResetTokens,
} from "@shared/schema";
import { z } from "zod";
import { supabaseAdmin } from "./supabaseAdmin";
import { db } from "./db";
import { eq, and, gt } from "drizzle-orm";
import sitemapRoutes from "./routes/sitemapRoutes";

/* =========================
   HELPERS & MIDDLEWARE
========================= */

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

function requireCompletedProfile(
  req: Request,
  res: Response,
  next: Function
) {
  if (!req.user?.profileCompleted) {
    return res.status(403).json({
      message: "Profile not completed",
      code: "PROFILE_INCOMPLETE",
    });
  }
  next();
}

  /* =========================
    ROUTES
  ========================= */

export async function registerRoutes(app: Express): Promise<void> {
  
  app.use("/api/uploadMedia", uploadMediaRouter);
  app.use("/api/profile/tournament-history", profileTournamentHistoryRouter);
  app.use("/api/profile/marketplace", profileMarketplace);
  app.use("/api", contentRouter);
  app.use("/", sitemapRoutes);
  /* =========================
   SUPPORT CHAT
  ========================= */

  app.use("/api/support", supportRoutes);
  
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
      
      // Default avatar and cover based on role
      const defaultAvatar = parsed.data.role === 'coach' 
        ? 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop'
        : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop';
      const defaultCover = parsed.data.role === 'coach'
        ? 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&h=400&fit=crop'
        : 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1200&h=400&fit=crop';
            
      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword,
        avatar: defaultAvatar,
        cover: defaultCover,
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
      await sendSystemMessage(
        user.id,
        user.role,
        "Welcome to TennisConnect",
        `Welcome to TennisConnect! Thank you for joining our community.Your profile has been submitted and is currently awaiting moderation. Our team will review your profile shortly. Once approved, your profile will become visible to other members on the platform. Thank you for your patience and welcome aboard! - TennisConnect Team`
        );

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
      
      // Regenerate session to prevent session fixation
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) return next(regenerateErr);
        
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          
          // Save session explicitly
          req.session.save((saveErr) => {
            if (saveErr) return next(saveErr);
            res.json(user);
          });
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  // ==========================================
  // PASSWORD RESET ENDPOINTS
  // ==========================================
  
  // Request password reset - sends email with reset link
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "If the email exists, a reset link has been sent" });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save token to database
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send email via Supabase
      const resetUrl = `${req.headers.origin || 'https://tennisconnect.com.au'}/reset-password?token=${token}`;
      
      // Use Supabase to send email
      const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: resetUrl,
        data: { reset_password: true }
      }).catch(() => ({ error: { message: 'Email service unavailable' } }));

      // Fallback: If Supabase invite doesn't work, we'll use a simpler approach
      // For now, log the reset URL (in production, integrate proper email service)
      console.log(`🔑 Password reset requested for ${email}`);
      console.log(`🔗 Reset URL: ${resetUrl}`);

      res.json({ 
        message: "If the email exists, a reset link has been sent",
        // Only in development - remove in production
        ...(process.env.NODE_ENV === 'development' && { resetUrl })
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Verify reset token
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: "Token is required" });
      }

      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        );

      if (!resetToken) {
        return res.json({ valid: false, message: "Invalid or expired token" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Verify token error:", error);
      res.status(500).json({ valid: false, message: "Failed to verify token" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Find valid token
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gt(passwordResetTokens.expiresAt, new Date())
          )
        );

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);

      // Update user password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ message: "Password successfully reset" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json({
      ...req.user,
      needsProfileCompletion: !req.user.profileCompleted,
    });
  });

  app.post("/api/me/complete-profile", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.updateUser(req.user!.id, {
        profileCompleted: true,
        isApproved: false,
      });
  
      if (user.role === "player") {
        await storage.updatePlayerProfileByUserId(user.id, {
          isDraft: false,
        });
      }
  
      if (user.role === "coach") {
        await storage.updateCoachProfileByUserId(user.id, {
          isDraft: false,
        });
      }
  
      res.json(user);
    } catch (e) {
      next(e);
    }
  });

  // ===== ADMIN USERS =====
    app.get("/api/admin/users",
      requireAdmin,
      async (_req, res) => {
        const users = await storage.getAllUsers();

        res.json(users);
      }
    );

    app.patch("/api/admin/users/:id/approve",
      requireAdmin,
      async (req, res) => {
        const user = await storage.approveUser(req.params.id);

          if (!user) {
            return res.status(404).json({
              message: "User not found",
            });
          }

        await sendSystemMessage(
          user.id,
          user.role,
          "Profile Approved",
          `Congratulations! Your TennisConnect profile has been approved and is now visible to the community
            You can now:
            • Connect with players and coaches
            • Receive messages
            • Participate in community activities

          Welcome to TennisConnect and enjoy your tennis journey! — TennisConnect Team`
        );

        res.json(user);
      }
    );

    app.delete("/api/admin/users/:id",
      requireAdmin,
      async (req, res) => {
        try {
          const userId = req.params.id;
    
          // защита от удаления самого себя
          if (req.user?.id === userId) {
            return res.status(400).json({
              message: "You cannot delete yourself",
            });
          }
    
          await storage.deleteUserByAdmin(userId);
    
          return res.json({
            success: true,
          });
    
        } catch (error) {
          console.error(error);
    
          return res.status(500).json({
            message: "Failed to delete user",
          });
        }
      }
    );

    app.patch("/api/admin/users/:id/hide",
      requireAdmin,
      async (req, res) => {
    
        if (req.user?.id === req.params.id) {
          return res.status(400).json({
            message: "You cannot hide yourself",
          });
        }
    
        const user = await storage.hideUser(req.params.id);

        if (user) {
          await sendSystemMessage(
            user.id,
            user.role,
            "Profile Hidden",
            `Your profile has been temporarily hidden from public listings. Your account remains active and your data has not been removed. If you believe this was done in error, please contact support. — TennisConnect Team`
          );
        }
    
        res.json({
          success: true,
        });
      }
    );

    app.patch("/api/admin/users/:id/unhide",
      requireAdmin,
      async (req, res) => {
    
        const user = await storage.unhideUser(req.params.id);

        if (!user) {
          return res.status(404).json({
            message: "User not found",
          });
        }

        await sendSystemMessage(
          user.id,
          user.role,
          "Profile Restored",
          `Good news! Your TennisConnect profile has been restored and is once again visible to the community.Other members can now find your profile and connect with you normally. Thank you for being part of TennisConnect. - TennisConnect Team`
        );
            
        res.json({
          success: true,
        });
      }
    );

  /* =========================
     ME (CURRENT USER)
  ========================= */
  app.get("/api/me", requireAuth, (req, res) => {
    if (!req.user) {
    return res.status(401).json({ user: null });
  }
  res.json({ user: req.user });
  });

  app.get("/api/me/player-profile",
    requireAuth,
    requireRole("player"),
    requireCompletedProfile,
    async (req, res) => {
      const profile = await storage.getPlayerProfile(req.user!.id);
      res.json(profile);
    }
  );

  app.put("/api/me/player-profile",
    requireAuth,
    requireRole("player"),
    async (req, res) => {
      try {
        const userId = req.user!.id;

        const { name, ...profileData } = req.body;

        // ✅ 1. Обновляем name в users
        if (name) {
          await storage.updateUserName(userId, name);
        }

        // ✅ 2. Обновляем профиль
        const profile = await storage.updatePlayerProfileByUserId(
          userId,
          profileData
        );

        res.json({ success: true, profile });
      } catch (err) {
        console.error("Update profile error:", err);
        res.status(500).json({ message: "Failed to update profile" });
      }
    }
  );

  app.get("/api/me/coach-profile",
    requireAuth,
    requireRole("coach"),
    requireCompletedProfile,
    async (req, res) => {
      const profile = await storage.getCoachProfile(req.user!.id);
      res.json(profile);
    }
  );

  app.put("/api/me/coach-profile",
    requireAuth,
    requireRole("coach"),
    async (req, res) => {
      try {
        const userId = req.user!.id;
  
        const { name, ...profileData } = req.body;
  
        // обновляем имя пользователя в таблице users
        if (name && typeof name === "string") {
          await storage.updateUserName(userId, name);
        }
  
        // обновляем профиль коуча
        const profile = await storage.updateCoachProfileByUserId(
          userId,
          profileData
        );
  
        // возвращаем свежие данные
        const user = await storage.getUser(userId);
  
        res.json({
          user,
          profile,
        });
      } catch (error) {
        console.error("Update coach profile error:", error);
  
        res.status(500).json({
          message: "Failed to update coach profile",
        });
      }
    }
  );

  app.delete("/api/me/account", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Unauthorized",
        });      
      }
      // Защита администратора
      if (req.user.isAdmin) {
        return res.status(403).json({
          message: "Admin accounts cannot be deleted",
        });
      }
  
      const userId = req.user.id;
  
      await storage.deleteUserAccount(userId);

      await new Promise<void>((resolve, reject) => {
        req.session?.destroy((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

  res.clearCookie("connect.sid");

  return res.json({
    success: true,
  });
    
    } catch (error) {
      console.error("Delete account error:", error);
  
      return res.status(500).json({
        message: "Failed to delete account",
      });
    }
  });

  /* =========================
     PUBLIC PROFILES
  ========================= */

  app.get("/api/players", async (_req, res) => {
    const rows = await storage.getAllPlayers();

    const players = rows.map(row => ({
      id: row.user.id,
      slug: row.user.slug,
      name: row.user.name,
      avatar: row.user.avatar,
      cover: row.user.cover,
      location: row.profile.location,
      skillLevel: row.profile.skillLevel,
      bio: row.profile.bio,
    }));

    res.json(players);
  });

  app.get("/api/players/:slug", async (req, res) => {
    const user = await storage.getUserBySlug(req.params.slug);
    if (!user || user.role !== "player" || !user.profileCompleted ) {
      return res.status(404).json({ message: "Player not found" });
    }
    const profile = await storage.getPlayerProfile(user.id);
    res.json({ user, profile });
  });

  app.get("/api/coaches", async (_req, res) => {
    const rows = await storage.getAllCoachesWithProfiles();

    const coaches = rows.map(row => ({
      id: row.user.id,
      slug: row.user.slug,
      name: row.user.name,
      avatar: row.user.avatar,
      cover: row.user.cover,
      title: row.profile.title,
      location: row.profile.location,
      rate: row.profile.rate,
      tags: row.profile.tags,
    }));

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

 app.delete("/api/me/profile", requireAuth, async (_req, res) => {
    //  TODO: implement later
    res.status(501).json({
      message: "Profile deletion not implemented yet",
    });
  });

  // ===== MARKETPLACE ROUTES =====
  // CREATE
  // app.post("/api/marketplace", requireAuth, async (req, res) => {
  //   try {
  //     const item = await storage.createMarketplaceItem({
  //       ...req.body,
  //       user_id: req.user!.id,
  //       seller_name: req.user!.name,
  //       seller_email: req.user!.email,
  //       type: "second-hand",
  //     });

  //     res.json(item);
  //   } catch (err) {
  //     res.status(500).json({ message: "Failed to create item" });
  //   }
  // });
  // GET BY USER
  // app.get("/api/marketplace/user/:userId", async (req, res) => {
  //   const items = await storage.getMarketplaceItemsByUser(
  //     req.params.userId
  //   );
  //   res.json(items);
  // });

  // UPDATE
    // app.put("/api/marketplace/:id", requireAuth, async (req, res) => {
    //   const item = await storage.updateMarketplaceItem(
    //     req.params.id,
    //     req.body
    //   );
    //   res.json(item);
    // });

  // DELETE
    // app.delete("/api/marketplace/:id", requireAuth, async (req, res) => {
    //   const item = await storage.getMarketplaceItemById(req.params.id);

    //   if (!item || item.userId !== req.user!.id) {
    //     return res.status(403).json({ message: "Forbidden" });
    //   }

    //   await storage.deleteMarketplaceItem(req.params.id);

    //   res.json({ success: true });
    // });
      
  // ADD PHOTO
  // app.post(
  //     "/api/marketplace/:id/photos",
  //     requireAuth,
  //     upload.single("file"),
  //     async (req, res) => {
  //       const itemId = req.params.id;
  //       const file = req.file;

  //       const url = await uploadToSupabaseStorage(
  //         file,
  //         `marketplace/${req.user!.id}/${itemId}`
  //       );

  //       const updatedItem = await storage.addMarketplacePhoto(
  //         itemId,
  //         url
  //       );

  //       res.json(updatedItem);
  //     }
  //   );

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
        phone: z.string().optional(),
        content: z.string().min(1, "Message is required"),
      });

      const result = messageSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          message: "Invalid input",
          errors: result.error,
        });
      }

      // Ищем существующую переписку между пользователями
      const existingConversation =
        await storage.findConversationBetweenUsers(
          req.user!.id,
          result.data.recipientId
        );

      // Создаем сообщение
      const message = await storage.createMessage({
        recipientId: result.data.recipientId,
        recipientType: result.data.recipientType,

        parentMessageId: null,

        conversationId:
          existingConversation?.conversationId || null,

        subject: result.data.subject,
        content: result.data.content,

        senderUserId: req.user!.id,
        senderName: req.user!.name,
        senderEmail: req.user!.email,
        senderPhone: result.data.phone,
      });

      // Если это первая переписка —
      // создаем conversationId = id первого сообщения
      if (!existingConversation) {
        await storage.updateMessageConversation(
          message.id,
          message.id
        );

        message.conversationId = message.id;
      }

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

  app.get("/api/messages/conversation/:conversationId",
    requireAuth,
    async (req, res, next) => {
      try {
        const conversation = await storage.getConversationMessages(
          req.params.conversationId
        );
  
        const hasAccess = conversation.some(
          (msg) =>
            msg.recipientId === req.user!.id ||
            msg.senderUserId === req.user!.id
        );
  
        if (!hasAccess) {
          return res.status(403).json({
            message: "Forbidden",
          });
        }
  
        res.json(conversation);
      } catch (error) {
        next(error);
      }
    }
  );

  app.get("/api/messages/conversations",
    requireAuth,
    async (req, res, next) => {
      try {
        const conversations =
          await storage.getUserConversations(
            req.user!.id
          );
  
        res.json(conversations);
      } catch (error) {
        next(error);
      }
    }
  );

  app.post("/api/messages/reply",
    requireAuth,
    async (req, res, next) => {
      try {
        const replySchema = z.object({
          originalMessageId: z.string(),
          content: z.string().min(1, "Reply is required"),
        });
  
        const result = replySchema.safeParse(req.body);
  
        if (!result.success) {
          return res.status(400).json({
            message: "Invalid input",
            errors: result.error,
          });
        }
  
        const originalMessage = await storage.getMessageById(
          result.data.originalMessageId
        );
        
        // ✅ Проверяем что сообщение существует
        if (!originalMessage) {
          return res.status(404).json({
            message: "Original message not found",
          });
        }
        
        // ✅ Проверяем что можно ответить
        if (!originalMessage.senderUserId) {
          return res.status(400).json({
            message: "Cannot reply to this message",
          });
        }
        
        const conversationId =
          originalMessage.conversationId ||
          originalMessage.id;
  
        const reply = await storage.createMessage({
          parentMessageId: originalMessage.id,
          conversationId,
  
          recipientId: originalMessage.senderUserId!,
          recipientType:
            originalMessage.recipientType === "coach"
              ? "player"
              : "coach",
  
          senderUserId: req.user!.id,
          senderName: req.user!.name,
          senderEmail: req.user!.email,
  
          subject: originalMessage.subject
            ? `Re: ${originalMessage.subject}`
            : "Reply",
  
          content: result.data.content,
        });
  
        res.json(reply);
      } catch (error) {
        next(error);
      }
    }
  );

  // ===== STATS HOMEPAGE ROUTES =====
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getPlatformStats();
  
      res.json(stats);
    } catch (error) {
      console.error("Failed to load platform stats:", error);
  
      res.status(500).json({
        message: "Failed to load platform stats",
      });
    }
  });
}
