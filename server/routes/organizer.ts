import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../requireAuth";
import { sendSystemMessage, ORGANIZER_APPROVED_SUBJECT, ORGANIZER_APPROVED_MESSAGE } from "../services/systemMessages";
import {
  insertOrganizationSchema,
  insertSessionSchema,
} from "@shared/schema";

const router = Router();

function requireOrganizer(req: Request, res: Response, next: NextFunction) {
    const u = req.user as any;
      // Admins can create Organizations/Sessions directly — they don't need
      // to request organizer access from themselves.
      if (!u?.isOrganizer && !u?.isAdmin) {
         return res.status(403).json({ message: "Organiser access required" });
       }
       next();
}

/* =========================
   ORGANIZER REQUESTS
========================= */

// Become an Organizer — creates (or re-opens) a request for the logged-in user.
router.post("/requests", requireAuth, async (req, res, next) => {
  try {
    const userId = (req.user as any).id;

    if ((req.user as any).isOrganizer) {
      return res.status(400).json({ message: "You are already an organiser" });
    }

    const latest = await storage.getLatestOrganizerRequest(userId);
    if (latest && latest.status === "pending") {
      return res.status(400).json({ message: "You already have a pending request" });
    }

    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : undefined;
    const request = await storage.createOrganizerRequest(userId, note);
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

// Current user's own organizer request status (for the profile "Become an Organizer" button).
router.get("/requests/me", requireAuth, async (req, res, next) => {
  try {
    const userId = (req.user as any).id;
    const request = await storage.getLatestOrganizerRequest(userId);
    res.json({ isOrganizer: !!(req.user as any).isOrganizer, request: request || null });
  } catch (error) {
    next(error);
  }
});

// Admin: list organizer requests, optionally filtered by status.
router.get("/requests", requireAdmin, async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const requests = await storage.getOrganizerRequests(status);
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

// Admin: approve a request.
router.post("/requests/:id/approve", requireAdmin, async (req, res, next) => {
  try {
    const reviewerId = (req.user as any).id;
    const request = await storage.approveOrganizerRequest(req.params.id, reviewerId);

    const approvedUser = await storage.getUser(request.userId);
    if (approvedUser) {
      await sendSystemMessage(
        approvedUser.id,
        approvedUser.role,
        ORGANIZER_APPROVED_SUBJECT,
        ORGANIZER_APPROVED_MESSAGE
      );
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
});

// Admin: reject a request.
router.post("/requests/:id/reject", requireAdmin, async (req, res, next) => {
  try {
    const reviewerId = (req.user as any).id;
    const request = await storage.rejectOrganizerRequest(req.params.id, reviewerId);
    res.json(request);
  } catch (error) {
    next(error);
  }
});

/* =========================
   ORGANIZATIONS
========================= */

// The organizer's own organization — viewable even after organizer
// access is revoked, so past work stays visible as history. Only
// requireAuth: it's already scoped to the caller's own organization,
// and the "can't create/manage" restriction lives on the write routes
// below (requireOrganizer), not here.
router.get("/organizations/me", requireAuth, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
    res.json(organization || null);
  } catch (error) {
    next(error);
  }
});

router.post("/organizations", requireAuth, requireOrganizer, async (req, res, next) => {
  try {
    const ownerId = (req.user as any).id;
    const existing = await storage.getOrganizationOwnedByUser(ownerId);
    if (existing) {
      return res.status(400).json({ message: "You already have an organization" });
    }

    const parsed = insertOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }

    const organization = await storage.createOrganization(ownerId, parsed.data);
    res.status(201).json(organization);
  } catch (error) {
    next(error);
  }
});

router.put("/organizations/:id", requireAuth, requireOrganizer, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationById(req.params.id);
    if (!organization || organization.ownerId !== (req.user as any).id) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const parsed = insertOrganizationSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }

    const updated = await storage.updateOrganization(organization.id, parsed.data);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Public organization page (used by /organizations/:slug).
router.get("/organizations/:slug", async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationBySlug(req.params.slug);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const sessions = await storage.getUpcomingPublishedSessionsByOrganization(organization.id);
    res.json({ ...organization, upcomingSessions: sessions });
  } catch (error) {
    next(error);
  }
});

// Resolves a user's own profile slug (player/coach) to the organization
// they own, with its upcoming published sessions - a session's
// organizationId isn't the same as the creator's own profile slug, so
// a guest's Organising tab (on that user's public profile) needs this
// extra hop to find what to show. Public, no auth - same visibility
// as the organization route above, just keyed by user slug instead of
// organization slug since that's what the profile page already has.
router.get("/organizations/by-user/:userSlug", async (req, res, next) => {
  try {
    const user = await storage.getUserBySlug(req.params.userSlug);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const organization = await storage.getOrganizationOwnedByUser(user.id);
    if (!organization) {
      return res.json(null);
    }
    const sessions = await storage.getUpcomingPublishedSessionsByOrganization(organization.id);
    res.json({ ...organization, upcomingSessions: sessions });
  } catch (error) {
    next(error);
  }
});

/* =========================
   SESSIONS
========================= */

// Organizer's own sessions (all statuses) for their dashboard. Same
// reasoning as GET /organizations/me above — viewing your own past
// sessions shouldn't require currently-active organizer access.
router.get("/sessions/mine", requireAuth, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
    if (!organization) {
      return res.json([]);
    }
    const sessions = await storage.getSessionsByOrganization(organization.id);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions", requireAuth, requireOrganizer, async (req, res, next) => {
  try {
    const ownerId = (req.user as any).id;
    const organization = await storage.getOrganizationOwnedByUser(ownerId);
    if (!organization) {
      return res.status(400).json({ message: "Create an organization first" });
    }

    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }

    const session = await storage.createSession(organization.id, ownerId, parsed.data);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

async function requireOwnSession(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await storage.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    const organization = await storage.getOrganizationById(session.organizationId);
    if (!organization || organization.ownerId !== (req.user as any).id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    (req as any).session_ = session;
    next();
  } catch (error) {
    next(error);
  }
}

router.put("/sessions/:id", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const parsed = insertSessionSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }
    const updated = await storage.updateSession(req.params.id, parsed.data);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/publish", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const reviewerId = (req.user as any).id;
    const isAdmin = (req.user as any).isAdmin;
    const session = isAdmin
      ? await storage.publishSessionDirect(req.params.id, reviewerId)
      : await storage.submitSessionForReview(req.params.id);

    // An organiser (not an admin) submitting for review is the moment
    // an admin needs to know about - a direct admin publish doesn't
    // need this, they already know.
    if (!isAdmin) {
      const admins = await storage.getAdminUsers();
      await Promise.all(
        admins.map((admin) =>
          sendSystemMessage(
            admin.id,
            admin.role,
            "New Session Pending Review",
            `"${session.title}" was just submitted for review and is waiting for your approval.`
          )
        )
      );
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/cancel", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const session = await storage.cancelSession(req.params.id);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// Drafts only - see storage.deleteSession for why. Anything past draft
// should be cancelled instead (the route above), never deleted.
router.delete("/sessions/:id", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const session = (req as any).session_;
    if (session.status !== "draft") {
      return res.status(400).json({ message: "Only drafts can be deleted - cancel it instead." });
    }
    await storage.deleteSession(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Admin: every session across every organization, so nothing goes live
// without being seen first. Optional ?status= filter (e.g. pending_review).
router.get("/admin/sessions", requireAdmin, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const sessions = await storage.getAllSessionsForAdmin(status);
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  });
  
  router.post("/admin/sessions/:id/approve", requireAdmin, async (req, res, next) => {
    try {
      const reviewerId = (req.user as any).id;
      const session = await storage.approveSession(req.params.id, reviewerId);

      const creator = await storage.getUser(session.createdBy);
      if (creator) {
        await sendSystemMessage(
          creator.id,
          creator.role,
          "Your Session Was Approved",
          `"${session.title}" has been approved and is now open for registration.`
        );
      }

      res.json(session);
    } catch (error) {
      next(error);
    }
  });
  
  router.post("/admin/sessions/:id/reject", requireAdmin, async (req, res, next) => {
    try {
      const reviewerId = (req.user as any).id;
      const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : undefined;
      const session = await storage.rejectSession(req.params.id, reviewerId, note);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

// "Play This Week" — published sessions across all organizations, next 7 days.
router.get("/sessions/this-week", async (_req, res, next) => {
  try {
    const sessions = await storage.getSessionsThisWeek();
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

// Single session by id - Session Workspace/Live/Edit load one session
// directly rather than always fetching the whole "mine" list. Owner or
// admin only. Registered after every fixed-name /sessions/* GET route
// above (this-week, mine, mine/registered) so this catch-all :id param
// can't shadow them - Express matches routes in registration order, and
// a 2-segment /sessions/:id would otherwise swallow /sessions/this-week.
router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const session = await storage.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    const isAdmin = (req.user as any).isAdmin;
    if (!isAdmin) {
      const organization = await storage.getOrganizationById(session.organizationId);
      if (!organization || organization.ownerId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// Real registrations for a session (organizer-facing Players/
// Registration tabs) - same ownership rule as the route above. Not to
// be confused with /sessions/mine/registered (a different path, that
// one's the signed-in *player's* own joined sessions).
router.get("/sessions/:id/registrations", requireAuth, async (req, res, next) => {
  try {
    const session = await storage.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    const isAdmin = (req.user as any).isAdmin;
    if (!isAdmin) {
      const organization = await storage.getOrganizationById(session.organizationId);
      if (!organization || organization.ownerId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }
    const registrationsList = await storage.getRegistrationsForSession(req.params.id);
    res.json(registrationsList);
  } catch (error) {
    next(error);
  }
});

/* =========================
   REGISTRATIONS ("My Sessions")
========================= */

router.get("/sessions/mine/registered", requireAuth, async (req, res, next) => {
  try {
    const sessions = await storage.getSessionsUserRegisteredFor((req.user as any).id);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/join", requireAuth, async (req, res, next) => {
  try {
    const joinerId = (req.user as any).id;
    const { registration, waitlisted } = await storage.registerForSession(
      req.params.id,
      joinerId
    );

    const session = await storage.getSessionById(req.params.id);
    if (session && session.createdBy !== joinerId) {
      const [organizer, joiner] = await Promise.all([
        storage.getUser(session.createdBy),
        storage.getUser(joinerId),
      ]);
      if (organizer) {
        await sendSystemMessage(
          organizer.id,
          organizer.role,
          waitlisted ? "New Waiting List Signup" : "New Player Joined",
          waitlisted
            ? `${joiner?.name ?? "A player"} joined the waiting list for "${session.title}".`
            : `${joiner?.name ?? "A player"} just joined "${session.title}".`
        );
      }
    }

    res.status(201).json({ registration, waitlisted });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Unable to join session" });
  }
});

router.delete("/sessions/:id/join", requireAuth, async (req, res, next) => {
  try {
    const leaverId = (req.user as any).id;
    const registration = await storage.cancelRegistration(req.params.id, leaverId);

    const session = await storage.getSessionById(req.params.id);
    if (session && session.createdBy !== leaverId) {
      const [organizer, leaver] = await Promise.all([
        storage.getUser(session.createdBy),
        storage.getUser(leaverId),
      ]);
      if (organizer) {
        await sendSystemMessage(
          organizer.id,
          organizer.role,
          "A Player Left Your Session",
          `${leaver?.name ?? "A player"} withdrew from "${session.title}".`
        );
      }
    }

    res.json(registration);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Unable to cancel registration" });
  }
});

export default router;