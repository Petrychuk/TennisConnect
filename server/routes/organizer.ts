import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../requireAuth";
import { env } from "../env";
import { sendMessageBetween, ORGANIZER_APPROVED_SUBJECT, ORGANIZER_APPROVED_MESSAGE } from "../services/systemMessages";
import {
  insertOrganizationSchema,
  insertSessionSchema,
  insertMatchScoreSchema,
  insertSessionTemplateSchema,
  type SessionTemplate,
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

/* =========================
   SESSION TEMPLATES
   ========================= */

router.get("/session-templates", requireAuth, requireOrganizer, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
    if (!organization) {
      return res.json([]);
    }
    const templates = await storage.getSessionTemplatesForOrganization(organization.id);
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

router.post("/session-templates", requireAuth, requireOrganizer, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
    if (!organization) {
      return res.status(404).json({ message: "Organisation not found" });
    }
    const parsed = insertSessionTemplateSchema.safeParse({
      ...req.body,
      organizationId: organization.id,
      createdBy: (req.user as any).id,
    });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }
    const template = await storage.createSessionTemplate(parsed.data);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

async function requireOwnTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await storage.getSessionTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    const organization = await storage.getOrganizationById(template.organizationId);
    if (!organization || organization.ownerId !== (req.user as any).id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    (req as any).template = template;
    next();
  } catch (error) {
    next(error);
  }
}

router.put("/session-templates/:id", requireAuth, requireOrganizer, requireOwnTemplate, async (req, res, next) => {
  try {
    // .partial() - editing a template is a partial update (e.g. just
    // renaming it), not required to resend every field every time.
    const parsed = insertSessionTemplateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error });
    }
    const updated = await storage.updateSessionTemplate(req.params.id, parsed.data);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post("/session-templates/:id/duplicate", requireAuth, requireOrganizer, requireOwnTemplate, async (req, res, next) => {
  try {
    const source = (req as any).template as SessionTemplate;
    const { id, createdAt, updatedAt, ...rest } = source;
    const copy = await storage.createSessionTemplate({
      ...rest,
      name: `${source.name} — Copy`,
    });
    res.status(201).json(copy);
  } catch (error) {
    next(error);
  }
});

router.delete("/session-templates/:id", requireAuth, requireOrganizer, requireOwnTemplate, async (req, res, next) => {
  try {
    // Deliberately does not touch the sessions table at all - see
    // deleteSessionTemplate's own comment. Nothing references this
    // template's id anywhere else, so there's nothing to cascade or
    // orphan.
    await storage.deleteSessionTemplate(req.params.id);
    res.status(204).end();
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

// Dashboard stat strip - Active Players / Attendance / Revenue.
router.get("/dashboard/stats", requireAuth, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
    if (!organization) {
      return res.json({ activePlayers: 0, attendancePercent: 0, revenueThisWeek: 0, revenueCurrency: "AUD" });
    }
    const stats = await storage.getOrganizerDashboardStats(organization.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Dashboard Activity Feed - real join/check-in events, most recent first.
router.get("/dashboard/activity", requireAuth, async (req, res, next) => {
  try {
    const organization = await storage.getOrganizationOwnedByUser((req.user as any).id);
    if (!organization) {
      return res.json([]);
    }
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const activity = await storage.getRecentActivityForOrganization(organization.id, limit);
    res.json(activity);
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
    const before = (req as any).session_ as TennisSession;
    const updated = await storage.updateSession(req.params.id, parsed.data);

    // Only startAt actually changing means a real reschedule - a
    // no-op PUT (saving the form without touching the date/time) or a
    // change to some other field shouldn't spam everyone who joined.
    // endAt moving on its own (session got longer/shorter, same start)
    // isn't included - that doesn't change when to show up, which is
    // the actual decision a "when's it now" notice needs to inform.
    const oldStart = new Date(before.startAt).getTime();
    const newStart = new Date(updated.startAt).getTime();
    if (oldStart !== newStart) {
      const organizer = await storage.getUser((req.user as any).id);
      if (organizer) {
        const newWhen = new Date(updated.startAt).toLocaleString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: updated.timeZone,
        });
        await notifyActiveRegistrants(
          before,
          organizer,
          `Rescheduled: ${updated.title}`,
          `${organizer.name} has rescheduled "${updated.title}" to ${newWhen}.`
        );
      }
    }

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

// Shared by the cancel route and the reschedule-detection below - both
// need "tell everyone actually registered", just with a different
// message. Same fetch-registrations-filter-active-send-to-each shape
// the existing manual /broadcast route already used (extracted here
// rather than duplicated a third time).
async function notifyActiveRegistrants(
  session: TennisSession,
  organizer: { id: string; name: string; role: string; slug: string },
  subject: string,
  message: string
) {
  const registrationsList = await storage.getRegistrationsForSession(session.id);
  const activeRecipients = registrationsList.filter((r) => r.status !== "cancelled");
  await Promise.all(
    activeRecipients.map((r) =>
      sendMessageBetween(organizer as any, r.userId, r.userRole, subject, message)
    )
  );
}

router.post("/sessions/:id/cancel", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const thisSession = (req as any).session_ as TennisSession;
    const [session, organizer] = await Promise.all([
      storage.cancelSession(req.params.id),
      storage.getUser((req.user as any).id),
    ]);
    // Whoever had already joined needs to hear this directly, not
    // discover it by the session quietly vanishing from their Upcoming
    // Sessions - a cancellation notice is exactly what a real organizer
    // would send by hand if this route didn't do it for them.
    if (organizer) {
      await notifyActiveRegistrants(
        thisSession,
        organizer,
        `Cancelled: ${thisSession.title}`,
        `${organizer.name} has cancelled "${thisSession.title}". We're sorry for the inconvenience.`
      );
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/archive", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const session = await storage.archiveSession(req.params.id);
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
    const enriched = await storage.getSessionByIdWithDetails(req.params.id, (req.user as any).id);
    res.json(enriched);
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

/* =========================
   TC LIVE ENGINE (v0.1)
   Organizer-only score entry, games-count scoring, doubles+singles.
   See memory/PRD.md TC Live section / liveEngine.ts for the full spec.
========================= */

// storage.ts throws plain Error with these exact messages for expected
// domain-rule violations (not-live session, round still in progress,
// not enough players, etc.) - surfaced as 400s here instead of falling
// through to the generic 500 handler, which would log them as bugs.
const LIVE_ENGINE_KNOWN_ERRORS = [
  "Current round isn't fully confirmed yet",
  "Need at least 2 eligible checked-in players to generate a round",
  "Can only enter scores while the session is live",
  "Match not found",
  "Registration not found",
  "Session not found",
];

function handleLiveEngineError(error: any, res: Response, next: NextFunction) {
  if (LIVE_ENGINE_KNOWN_ERRORS.includes(error?.message)) {
    return res.status(400).json({ message: error.message });
  }
  next(error);
}

// TC Live is staging-only until it's fully ready for real sessions -
// production keeps a stub (client/src/pages/organiser/session-live.tsx
// shows a "coming soon" screen instead of the real one). Gated on
// env.DB_ENV rather than NODE_ENV because `npm start` sets
// NODE_ENV=production on every deployed instance, staging included -
// see server/env.ts. 404 (not 403) so the route looks like it simply
// doesn't exist on production, and this runs before requireAuth so it
// doesn't leak anything about auth state either.
function requireStagingEnv(_req: Request, res: Response, next: NextFunction) {
  if (env.DB_ENV !== "staging") {
    return res.status(404).json({ message: "Not found" });
  }
  next();
}


// Check-in itself is a normal, everyday Players-tab action (an
// organizer marking who's physically arrived) - not staging-only TC
// Live tooling, even though it's also used by the live engine.
// requireStagingEnv deliberately NOT applied here (unlike go-live and
// the rest of the TC Live routes below) - it was gating this
// unintentionally until the regular Players tab started calling it
// too, which would have made a completely ordinary check-in button
// 404 outside staging.
router.post(
  "/sessions/:id/checkin/:registrationId",
  requireAuth,
  requireOrganizer,
  requireOwnSession,
  async (req, res, next) => {
    try {
      const registration = await storage.checkInRegistration(req.params.registrationId);
      res.json(registration);
    } catch (error) {
      handleLiveEngineError(error, res, next);
    }
  }
);

// Players tab's "Remove" action - cancels this specific player's
// registration. Same effect as the player cancelling their own spot
// (DELETE /sessions/:id/join), just organizer-initiated.
router.delete(
  "/sessions/:id/registrations/:registrationId",
  requireAuth,
  requireOrganizer,
  requireOwnSession,
  async (req, res, next) => {
    try {
      const registration = await storage.cancelRegistrationById(req.params.registrationId);
      res.json(registration);
    } catch (error) {
      next(error);
    }
  }
);

// Players tab's "Move to Waiting" action - an admin override moving an
// already-registered player onto the waiting list.
router.post(
  "/sessions/:id/registrations/:registrationId/waitlist",
  requireAuth,
  requireOrganizer,
  requireOwnSession,
  async (req, res, next) => {
    try {
      const registration = await storage.moveRegistrationToWaitlist(req.params.registrationId);
      res.json(registration);
    } catch (error) {
      next(error);
    }
  }
);

// body: { liveStatus: "unavailable" | "withdrawn" | null } - null clears it
// (e.g. organizer marked someone unavailable by mistake).
router.post(
  "/sessions/:id/registrations/:registrationId/live-status",
  requireStagingEnv,
  requireAuth,
  requireOrganizer,
  requireOwnSession,
  async (req, res, next) => {
    try {
      const liveStatus = req.body?.liveStatus;
      if (liveStatus !== null && liveStatus !== "unavailable" && liveStatus !== "withdrawn") {
        return res.status(400).json({ message: "liveStatus must be 'unavailable', 'withdrawn', or null" });
      }
      const registration = await storage.setRegistrationLiveStatus(req.params.registrationId, liveStatus);
      res.json(registration);
    } catch (error) {
      handleLiveEngineError(error, res, next);
    }
  }
);

router.post("/sessions/:id/go-live", requireStagingEnv, requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const thisSession = (req as any).session_ as TennisSession;
    if (thisSession.status !== "published") {
      return res.status(400).json({ message: `Can't go live from status "${thisSession.status}" - session must be published first` });
    }
    if (!thisSession.courtsCount || thisSession.courtsCount < 1) {
      return res.status(400).json({ message: "Set a court count for this session before going live" });
    }
    const registrationsList = await storage.getRegistrationsForSession(req.params.id);
    const checkedIn = registrationsList.filter((r) => !!r.checkedInAt);
    if (checkedIn.length < 2) {
      return res.status(400).json({ message: "Need at least 2 checked-in players to go live" });
    }
    const session = await storage.goLiveSession(req.params.id);
    console.log(`[TC LIVE] session ${req.params.id}: went live (${checkedIn.length} checked in)`);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/rounds/generate", requireStagingEnv, requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const thisSession = (req as any).session_ as TennisSession;
    if (thisSession.status !== "live") {
      return res.status(400).json({ message: "Session must be live to generate a round" });
    }
    console.log(`[TC LIVE] session ${req.params.id}: generate round requested`);
    const result = await storage.generateNextRound(req.params.id);
    res.status(201).json(result);
  } catch (error: any) {
    handleLiveEngineError(error, res, next);
  }
});

router.get("/sessions/:id/rounds/current", requireStagingEnv, requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const result = await storage.getCurrentRound(req.params.id);
    res.json(result ?? null);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/sessions/:id/matches/:matchId/start",
  requireStagingEnv,
  requireAuth,
  requireOrganizer,
  requireOwnSession,
  async (req, res, next) => {
    try {
      const match = await storage.startMatch(req.params.matchId);
      res.json(match);
    } catch (error) {
      handleLiveEngineError(error, res, next);
    }
  }
);

// body: { teamAGames: number, teamBGames: number }. Saving confirms the
// match immediately - see storage.reportMatchScore for why (no
// self-report/confirm step in v0.1).
router.post(
  "/sessions/:id/matches/:matchId/score",
  requireStagingEnv,
  requireAuth,
  requireOrganizer,
  requireOwnSession,
  async (req, res, next) => {
    try {
      const parsed = insertMatchScoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid score", errors: parsed.error });
      }
      const organizerId = (req.user as any).id;
      const match = await storage.reportMatchScore(
        req.params.matchId,
        organizerId,
        parsed.data.teamAGames,
        parsed.data.teamBGames
      );
      res.json(match);
    } catch (error) {
      handleLiveEngineError(error, res, next);
    }
  }
);

router.post("/sessions/:id/finish", requireStagingEnv, requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const session = await storage.finishSession(req.params.id);
    console.log(`[TC LIVE] session ${req.params.id}: finished`);
    res.json(session);
  } catch (error) {
    handleLiveEngineError(error, res, next);
  }
});

// Viewing final standings for a completed session is basic, always-
// needed functionality (like check-in - see its own route above for
// the same reasoning), not an experimental live-scoring feature - only
// go-live/rounds/pairing/QR check-in stay staging-gated.
router.get("/sessions/:id/leaderboard", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const leaderboard = await storage.getSessionLeaderboard(req.params.id);
    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

// Final standings, sent to every active registrant as a real message -
// same notifyActiveRegistrants() helper the cancel/reschedule notices
// already use. One shared summary (not a per-player personalized
// message) - everyone sees the same full standings, matching what a
// results page itself shows.
router.post("/sessions/:id/send-results", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const session = (req as any).session_ as TennisSession;
    if (session.status !== "completed") {
      return res.status(400).json({ message: "Results are only available once the session has finished" });
    }
    const [leaderboard, organizer] = await Promise.all([
      storage.getSessionLeaderboard(session.id),
      storage.getUser((req.user as any).id),
    ]);
    if (!organizer) {
      return res.status(404).json({ message: "Organiser not found" });
    }
    if (leaderboard.length === 0) {
      return res.status(400).json({ message: "No results to send yet" });
    }

    const standingsText = leaderboard
      .map((row, i) => `${i + 1}. ${row.userName} - ${row.wins}W${row.draws > 0 ? `-${row.draws}D` : ""}-${row.losses}L`)
      .join("\n");

    await notifyActiveRegistrants(
      session,
      organizer,
      `Results: ${session.title}`,
      `Final standings for "${session.title}":\n${standingsText}`
    );

    res.status(201).json({ sentTo: leaderboard.length });
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

    // A real, queryable record of this specific broadcast - separate
    // from the per-recipient rows sendMessageBetween just wrote to the
    // messages table - so the Messages tab's own history survives a
    // page refresh instead of resetting to whatever's still in local
    // component state.
    await storage.createSessionUpdate({
      sessionId: session.id,
      organizerId: organizer.id,
      message,
      sentTo: activeRecipients.length,
    });

    res.status(201).json({ sentTo: activeRecipients.length });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions/:id/updates", requireAuth, requireOrganizer, requireOwnSession, async (req, res, next) => {
  try {
    const updates = await storage.getSessionUpdates(req.params.id);
    res.json(updates);
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
        timeZone: session.timeZone,
      });
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: session.timeZone,
      };
      const startTime = new Date(session.startAt).toLocaleTimeString("en-US", timeOptions);
      const endTime = session.endAt ? new Date(session.endAt).toLocaleTimeString("en-US", timeOptions) : null;
      const timeRange = endTime ? `${startTime}–${endTime}` : startTime;

      const formatLabel = session.matchMode === "singles" ? "Singles" : "Doubles";
      const priceValue = session.price ? Number(session.price) : 0;
      const costLabel = priceValue > 0 ? `$${priceValue} ${session.currency}` : "Free";

      // Enough to actually decide Join vs Decline without opening the
      // session first - just the date used to say "on 13 Sept 2026"
      // with none of the details (time, venue, format, cost) that
      // actually matter for that decision.
      const detailParts = [
        session.location,
        formatLabel,
        costLabel,
      ].filter(Boolean);

      await sendMessageBetween(
        organizer,
        invitee.id,
        invitee.role,
        `You're invited: ${session.title}`,
        `${organizer.name} invited you to "${session.title}" on ${sessionDate}, ${timeRange}` +
          (detailParts.length ? ` — ${detailParts.join(" · ")}.` : "."),
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