import { Router } from "express";
import { storage } from "../storage";
import { toPublicUser } from "../lib/sanitizeUser";
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
router.get("/:slug", async (req, res) => {
  const user = await storage.getUserBySlug(req.params.slug);

  // Matches the same check GET /api/players/:slug already has - a coach
  // who hasn't finished their onboarding wizard (still holding the
  // registration-time defaults: title "Coach", location "Sydney") isn't
  // in the public /api/coaches list, but was still directly reachable
  // by anyone who knew or guessed their slug, since only the role was
  // checked here, not profileCompleted.
  if (!user || user.role !== "coach" || !user.profileCompleted) {
    return res.status(404).json({
      message: "Coach not found",
    });
  }

  const profile = await storage.getCoachProfile(user.id);

  res.json({
    user: toPublicUser(user),
    profile,
  });
});

export default router;