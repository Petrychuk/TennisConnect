import { Router } from "express";
import { storage } from "../storage";
import { toPublicUser } from "../lib/sanitizeUser";
import { coachProfileAccess, publicCoachResponse, type ContactViewer } from "../lib/publicProfiles";
import { publicBrowseLimiter } from "../lib/rateLimiters";
import {
  COACHES_PAGE_SIZE,
  directoryLocations,
  pageOfCoaches,
  parseCoachDirectoryQuery,
  parseHourlyRate,
} from "@shared/coachDirectory";

const router = Router();
router.use(publicBrowseLimiter);

// GET /api/coaches?page=&limit=&q=&location=&maxRate=
// Filters run over the WHOLE directory before paging (shared/coachDirectory.ts);
// with no filters every listed coach comes back, newest first.
// `locations` = every location in the directory, for the page's Location filter.
router.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || COACHES_PAGE_SIZE));
  const query = parseCoachDirectoryQuery(req.query);

  const rows = await storage.getAllCoachesWithProfiles();

  const all = rows.map(row => ({
    id: row.user.id,
    slug: row.user.slug,
    name: row.user.name,
    avatar: row.user.avatar,
    cover: row.user.cover,
    location: row.profile.location,
    title: row.profile.title,
    bio: row.profile.bio,
    // Free text as the coach typed it ("$80/hr"); filtering uses the parsed number.
    rateText: row.profile.rate,
    rate: parseHourlyRate(row.profile.rate),
    isOrganizer: row.user.isOrganizer,
  }));

  const { coaches, pagination } = pageOfCoaches(all, query, page, limit);

  res.json({
    // `rate` keeps its existing meaning in the response: the coach's own text.
    coaches: coaches.map(({ rateText, ...coach }) => ({ ...coach, rate: rateText })),
    pagination,
    locations: directoryLocations(all),
  });
});

// GET /api/coaches/:slug
// Same visibility as the directory (server/lib/publicProfiles.ts
// isCoachPubliclyVisible): a draft, unapproved, hidden or inactive coach -
// or one who hasn't finished onboarding - is a 404 for the public, and for
// approved members following a direct link. The coach themselves and
// admins still get it (complete-profile sends a new, not-yet-approved
// coach straight to their own page). Allowlisted fields only; phone/email
// only for viewers the contact policy allows. The body depends on who
// asks, so no shared cache may keep it.
router.get("/:slug", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Cookie");

  const viewer = req.isAuthenticated?.() ? (req.user as ContactViewer) : null;
  const user = await storage.getUserBySlug(req.params.slug);
  const profile = user && user.role === "coach" ? await storage.getCoachProfile(user.id) : undefined;

  if (!user || coachProfileAccess(user, profile, viewer) === "not-found") {
    return res.status(404).json({
      message: "Coach not found",
    });
  }

  res.json(
    publicCoachResponse({ user, publicUser: toPublicUser(user), profile, viewer }),
  );
});

export default router;