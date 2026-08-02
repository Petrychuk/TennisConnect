import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../requireAuth";
import { sendMessageBetween, ORGANIZER_APPROVED_SUBJECT, ORGANIZER_APPROVED_MESSAGE } from "../services/systemMessages";
import {
  insertOrganizationSchema,
  insertSessionSchema,
  type TennisSession,
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

    const [approvedUser, reviewer] = await Promise.all([
      storage.getUser(request.userId),
      storage.getUser(reviewerId),
    ]);
    if (approvedUser && reviewer) {
      await sendMessageBetween(
        reviewer,
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

// Org-wide Players page - every distinct player who's registered for
// any of this organiser's sessions, not just one at a time.
router.get("/players/mine", requireAuth, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
    if (!organization) {
      return res.json([]);
    }
    const players = await storage.getPlayersForOrganization(organization.id);
    res.json(players);
  } catch (error) {
    next(error);
  }
});

// Search real platform users to invite - used by both the org-wide
// Players page and a session's own Players tab invite dialogs.
router.get("/players/search", requireAuth, async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2) {
      return res.json([]);
    }

    const context: { sessionId?: string; organizationId?: string } = {};

    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : null;
    if (sessionId) {
      const session = await storage.getSessionById(sessionId);
      const organization = session ? await storage.getOrganizationById(session.organizationId) : null;
      if (session && organization && organization.ownerId === (req.user as any).id) {
        context.sessionId = sessionId;
      }
    }

    if (req.query.community === "1" || req.query.community === "true") {
      const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
      if (organization) {
        context.organizationId = organization.id;
      }
    }

    const results = await storage.searchUsers(query, (req.user as any).id, 10, context);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Org-wide invite - no specific session, just a real message inviting
// someone to check out the organiser's sessions. There's no "follow"/
// "community member" concept on the backend, so this is intentionally
// just a message, not a database relationship.
router.post("/players/invite", requireAuth, requireOrganizer, async (req, res, next) => {
  try {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : null;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const [organizer, invitee, organization] = await Promise.all([
      storage.getUser((req.user as any).id),
      storage.getUser(userId),
      storage.getOrganizationOwnedByUser((req.user as any).id),
    ]);
    if (!organizer || !invitee) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!organization) {
      return res.status(400).json({ message: "Create your organisation first" });
    }

    const membership = await storage.createOrganizationMembership(organization.id, userId);

    if (membership.status === "pending") {
      await sendMessageBetween(
        organizer,
        invitee.id,
        invitee.role,
        "You're invited!",
        `${organizer.name} invited you to join ${organizer.name}'s Tennis Community.`,
        { messageType: "community_invite", relatedOrganizationId: organization.id }
      );
    }

    res.status(201).json({ invited: true, status: membership.status });
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
    const thisSession = (req as any).session_ as TennisSession;

    // A division of a container that's already published doesn't need
    // its own admin review - the admin already approved the event
    // itself, and a division is just the organiser's own internal
    // breakdown of it (Men's Singles A, Mixed Doubles, etc.), not a
    // new event asking for separate approval.
    let skipsReview = isAdmin;
    if (!skipsReview && thisSession.parentSessionId) {
      const parent = await storage.getSessionById(thisSession.parentSessionId);
      skipsReview = parent?.status === "published";
    }

    const session = skipsReview
      ? await storage.publishSessionDirect(req.params.id, reviewerId)
      : await storage.submitSessionForReview(req.params.id);

    // An organiser (not an admin) submitting for review is the moment
    // an admin needs to know about - a direct admin publish doesn't
    // need this, they already know.
    if (!skipsReview) {
      const [admins, organiser] = await Promise.all([
        storage.getAdminUsers(),
        storage.getUser((req.user as any).id),
      ]);
      if (organiser) {
        await Promise.all(
          admins.map((admin) =>
            sendMessageBetween(
              organiser,
              admin.id,
              admin.role,
              "New Session Pending Review",
              `"${session.title}" was just submitted for review and is waiting for your approval.`
            )
          )
        );
      }
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
      // Drafts are the organiser's own private work-in-progress -
      // never something the moderation queue's "everything" view
      // should include. An explicit ?status=draft request (nothing
      // currently sends one) still works, since only the unfiltered
      // fetch gets this exclusion.
      const visible = status ? sessions : sessions.filter((s) => s.status !== "draft");
      res.json(visible);
    } catch (error) {
      next(error);
    }
  });
  
  router.post("/admin/sessions/:id/approve", requireAdmin, async (req, res, next) => {
    try {
      const reviewerId = (req.user as any).id;
      const session = await storage.approveSession(req.params.id, reviewerId);

      const [creator, reviewer] = await Promise.all([
        storage.getUser(session.createdBy),
        storage.getUser(reviewerId),
      ]);
      if (creator && reviewer) {
        await sendMessageBetween(
          reviewer,
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

      const [creator, reviewer] = await Promise.all([
        storage.getUser(session.createdBy),
        storage.getUser(reviewerId),
      ]);
      if (creator && reviewer) {
        await sendMessageBetween(
          reviewer,
          creator.id,
          creator.role,
          "Your Session Was Rejected",
          note
            ? `"${session.title}" was not approved. Reviewer's note: ${note}`
            : `"${session.title}" was not approved. You can edit it and resubmit for review.`
        );
      }

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

// Divisions of a Tournament/Club Championship "container" session -
// Men's Singles A, Mixed Doubles, etc. Same ownership rule as every
// other session-scoped route: the container's owner, not admin-only.
router.get("/sessions/:id/divisions", requireAuth, async (req, res, next) => {
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
    const divisions = await storage.getSessionDivisions(session.id);
    res.json(divisions);
  } catch (error) {
    next(error);
  }
});

// Quick-create a division. Fast by design: everything is inherited
// from a base session (the container itself, or an existing sibling
// division when cloneFromDivisionId is given - "duplicate this
// division" for setting up e.g. Men's Singles B once A already
// exists) except title, which is the only required field. Any other
// field can still be overridden (a later division on day 2 of a
// multi-day event, a different capacity, etc.).
router.post("/sessions/:id/divisions", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const container = (req as any).session_ as TennisSession;
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ message: "Division title is required" });
    }

    let baseSession: TennisSession = container;
    const cloneFromDivisionId = typeof req.body?.cloneFromDivisionId === "string" ? req.body.cloneFromDivisionId : null;
    if (cloneFromDivisionId) {
      const sibling = await storage.getSessionById(cloneFromDivisionId);
      const belongsHere = sibling && (sibling.id === container.id || sibling.parentSessionId === container.id);
      if (!belongsHere) {
        return res.status(400).json({ message: "That division doesn't belong to this event" });
      }
      baseSession = sibling!;
    }

    const overrides: any = { title };
    if (req.body?.startAt) overrides.startAt = new Date(req.body.startAt);
    if (req.body?.endAt) overrides.endAt = new Date(req.body.endAt);
    if (req.body?.maxParticipants !== undefined) overrides.maxParticipants = req.body.maxParticipants;
    if (typeof req.body?.description === "string") overrides.description = req.body.description;

    const division = await storage.createSessionDivision(baseSession, (req.user as any).id, overrides);
    res.status(201).json(division);
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

// Session Updates ("Messages" tab) - a real broadcast to everyone
// currently registered, not a mock feed. Uses the same
// sendMessageBetween() every other real notification in this file
// already uses, so a broadcast lands in the organiser's own existing
// thread with each player, right alongside "You're In!" etc., rather
// than being a separate, disconnected system.
router.post("/sessions/:id/broadcast", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }
    const session = (req as any).session_ as TennisSession;
    const organizer = await storage.getUser((req.user as any).id);
    if (!organizer) {
      return res.status(404).json({ message: "Organiser not found" });
    }

    const registrationsList = await storage.getRegistrationsForSession(session.id);
    const activeRecipients = registrationsList.filter((r) => r.status !== "cancelled");

    await Promise.all(
      activeRecipients.map((r) =>
        sendMessageBetween(
          organizer,
          r.userId,
          r.userRole,
          `Update: ${session.title}`,
          message
        )
      )
    );

    res.status(201).json({ sentTo: activeRecipients.length });
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

// Organiser invites a specific real player to this specific session -
// creates a real "invited" registration (shows up in the Invited tab
// alongside the mock ones) and sends a real message with the details.
router.post("/sessions/:id/invite", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : null;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const session = (req as any).session_ as TennisSession;
    const [organizer, invitee] = await Promise.all([
      storage.getUser((req.user as any).id),
      storage.getUser(userId),
    ]);
    if (!organizer || !invitee) {
      return res.status(404).json({ message: "User not found" });
    }

    const registration = await storage.createInvitedRegistration(session.id, userId);

    if (registration.status === "invited") {
      const sessionDate = new Date(session.startAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      await sendMessageBetween(
        organizer,
        invitee.id,
        invitee.role,
        `You're invited: ${session.title}`,
        `${organizer.name} invited you to "${session.title}" on ${sessionDate}.`,
        { messageType: "session_invite", relatedSessionId: session.id }
      );
    }

    res.status(201).json(registration);
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

      if (joiner && organizer) {
        await sendMessageBetween(
          organizer,
          joiner.id,
          joiner.role,
          waitlisted ? "You're on the Waiting List" : "You're In!",
          waitlisted
            ? `You've been added to the waiting list for "${session.title}" — you'll move up automatically if a spot opens.`
            : `You're registered for "${session.title}". It's now in your My Sessions.`
        );
      }

      if (organizer && joiner) {
        await sendMessageBetween(
          joiner,
          organizer.id,
          organizer.role,
          waitlisted ? "New Waiting List Signup" : "New Player Joined",
          waitlisted
            ? `${joiner.name} joined the waiting list for "${session.title}".`
            : `${joiner.name} just joined "${session.title}".`
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

      if (leaver && organizer) {
        await sendMessageBetween(
          organizer,
          leaver.id,
          leaver.role,
          "Registration Cancelled",
          `You're no longer registered for "${session.title}".`
        );
      }

      if (organizer && leaver) {
        await sendMessageBetween(
          leaver,
          organizer.id,
          organizer.role,
          "A Player Left Your Session",
          `${leaver.name} withdrew from "${session.title}".`
        );
      }
    }

    res.json(registration);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Unable to cancel registration" });
  }
});

export default router;