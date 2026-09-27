// Public "Play" discovery - the single player-facing answer to "where
// can I play tennis?" (see the [Player] Create Play page spec). No
// auth required to browse; a signed-in viewer just additionally gets
// their own registration status on the details endpoint.
import { Router } from "express";
import { storage } from "../storage";
import { publicBrowseLimiter } from "../lib/rateLimiters";
import {
  computeRecommendation,
  isEventEligibleForPlayer,
  hasEnoughSignalForPersonalisation,
  type RecommendationPlayerInput,
  type RecommendationEventInput,
} from "../services/recommendationEngine";
import {
  fallbackIntent,
  callSmartSearchLLM,
  matchesTimeOfDay,
  type PlaySearchIntent,
  type SmartSearchPlayerContext,
} from "../services/smartSearchEngine";
import {
  computePlayerMatch,
  isPlayerEligibleForMatching,
  hasEnoughSignalForPlayerMatch,
  type MatchCandidateInput,
} from "../services/playerMatchEngine";

const router = Router();
router.use(publicBrowseLimiter);

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// GET /api/play/sessions
router.get("/sessions", async (req, res, next) => {
  try {
    const sessions = await storage.getPublicSessions({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      location: typeof req.query.location === "string" ? req.query.location : undefined,
      format: typeof req.query.format === "string" ? req.query.format : undefined,
      level: typeof req.query.level === "string" ? req.query.level : undefined,
      organizationId: typeof req.query.organizerId === "string" ? req.query.organizerId : undefined,
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
    });
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

// POST /api/play/smart-search - [PLAY][AI] Smart Natural-Language
// Tennis Search. AI interprets intent only; it never invents events,
// prices, or match scores, and it never decides which events fall in
// a time window (matchesTimeOfDay/getPublicSessions's own date
// filtering do that deterministically). Works fully without AI - if
// ANTHROPIC_API_KEY isn't set, or the call times out/fails/returns
// something that doesn't validate, this silently falls back to a
// plain text search using the query as typed (spec section 14).
router.post("/smart-search", publicBrowseLimiter, async (req, res, next) => {
  try {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (!query) {
      return res.status(400).json({ message: "query is required" });
    }

    // Minimal profile context sent to the AI (spec section 16's own
    // allowlist) - never email, messages, DOB, photos, or account/
    // security info. The FULL profile is kept separately (below) for
    // server-side Match Score ranking (spec section 8) - that's a
    // local computation, not something sent to the model, so the
    // privacy allowlist doesn't constrain it the same way.
    let playerContext: SmartSearchPlayerContext | undefined;
    let fullProfile: Awaited<ReturnType<typeof storage.getPlayerProfile>> | undefined;
    if (req.isAuthenticated?.() && (req.user as any).role === "player") {
      fullProfile = await storage.getPlayerProfile((req.user as any).id);
      if (fullProfile) {
        playerContext = {
          skillLevel: fullProfile.skillLevel,
          preferredArea: fullProfile.preferredCourts?.[0] ?? null,
          playRadiusKm: fullProfile.playRadiusKm,
          gameFormat: fullProfile.gameFormat,
          playStyle: fullProfile.playStyle,
          availability: fullProfile.availability,
        };
      }
    }

    const aiIntent = await callSmartSearchLLM(query, playerContext);
    const usedAI = aiIntent !== null;
    const intent: PlaySearchIntent = aiIntent ?? fallbackIntent(query);

    // play_smart_search / play_smart_search_fallback (spec section 17) -
    // the raw query text is deliberately NOT included, only what's
    // needed to measure whether AI understood the request at all.
    const analyticsBase = { intent: intent.intent, usedAI };

    // FIND_PLAYER - Player Matching doesn't exist yet (spec section
    // 12). Never falls through to a normal event search for this -
    // that would silently misinterpret "find someone to hit with" as
    // an event query.
    if (intent.intent === "FIND_PLAYER") {
      if (!req.isAuthenticated?.() || (req.user as any).role !== "player") {
        return res.json({
          intent: "FIND_PLAYER",
          aiUsed: usedAI,
          message: "Sign in to find players to play with.",
          sessions: [],
          recommendations: [],
          players: [],
          analytics: analyticsBase,
        });
      }
      const matched = await getMatchedPlayers((req.user as any).id);
      return res.json({
        intent: "FIND_PLAYER",
        aiUsed: usedAI,
        message: matched.players.length === 0 ? "No players are currently looking to play right now." : undefined,
        sessions: [],
        recommendations: [],
        players: matched.players,
        analytics: { ...analyticsBase, resultCount: matched.players.length },
      });
    }

    // Explicit query values always win over profile defaults (spec
    // section 4/7) - profile is only consulted when the intent itself
    // says to defer to it (usePlayerLocation/usePlayerPreferences/
    // levelMode PLAYER_LEVEL), never as a silent override.
    const resolvedLocation = intent.location || (intent.usePlayerLocation ? playerContext?.preferredArea ?? undefined : undefined);
    const resolvedLevel =
      intent.levelMode === "PLAYER_LEVEL" ? playerContext?.skillLevel ?? undefined : intent.level;
    // The query layer supports one format value at a time - if the AI
    // returned more than one activityType, only the first is applied
    // as a hard filter; this is a real simplification, not a bug, and
    // is worth extending if multi-format search becomes common enough
    // to matter.
    const resolvedFormat = intent.activityType?.[0];

    const searchText = intent.intent === "TEXT_SEARCH" ? intent.query || query : undefined;

    const parsedDateFrom = intent.dateFrom ? new Date(intent.dateFrom) : undefined;
    const parsedDateTo = intent.dateTo ? new Date(intent.dateTo) : undefined;
    const dateFrom = parsedDateFrom && !isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : undefined;
    const dateTo = parsedDateTo && !isNaN(parsedDateTo.getTime()) ? parsedDateTo : undefined;

    const baseFilters = {
      search: searchText,
      location: resolvedLocation,
      format: resolvedFormat,
      level: resolvedLevel,
      dateFrom,
      dateTo,
    };

    let sessions = await storage.getPublicSessions(baseFilters);

    if (intent.timeOfDay) {
      sessions = sessions.filter((s) => matchesTimeOfDay(s.startAt, s.timeZone, intent.timeOfDay!));
    }
    // Note: intent.gameFormat (singles/doubles/mixed) isn't applied as
    // a filter here - PublicSessionCard has no singles/doubles field
    // to check it against yet (matchMode on PublicSessionDetails is a
    // different concept - scoring format, not game format). A real
    // gameFormat filter needs that field added to the session model
    // first; flagging rather than filtering against the wrong thing.

    // Spec section 8 ("Combine AI Search + Match Score"): once the AI's
    // interpreted criteria have found the eligible real events, the
    // EXISTING deterministic Recommendation Engine ranks them - the
    // LLM never generates these percentages. Scored (not filtered) for
    // a signed-in player: an event the player explicitly searched for
    // stays in the list even if it fails the recommendation engine's
    // OWN hard-eligibility check (e.g. their level is a poor fit) -
    // that check only decides whether to show a score at all, never
    // removes a result the player asked for by name/criteria. No
    // scoring at all for a signed-out visitor or non-player - sessions
    // are returned in their natural (soonest-first, from
    // getPublicSessions) order.
    let scoredSessions: { activity: (typeof sessions)[number]; recommendation: { score: number; reasons: string[] } | null }[];
    if (fullProfile) {
      const recPlayerInput: RecommendationPlayerInput = {
        skillLevel: fullProfile.skillLevel,
        preferredCourts: fullProfile.preferredCourts,
        playRadiusKm: fullProfile.playRadiusKm,
        latitude: fullProfile.latitude,
        longitude: fullProfile.longitude,
        availability: fullProfile.availability,
        gameFormat: fullProfile.gameFormat,
        playStyle: fullProfile.playStyle,
        lookingFor: fullProfile.lookingFor,
      };
      const toEventInputForScoring = (s: (typeof sessions)[number]): RecommendationEventInput => ({
        id: s.id,
        type: s.type,
        skillLevel: s.skillLevel,
        location: s.location,
        latitude: s.latitude,
        longitude: s.longitude,
        startAt: s.startAt,
        timeZone: s.timeZone,
        playStatus: s.playStatus,
        registeredCount: s.registeredCount,
        maxParticipants: s.maxParticipants,
      });
      scoredSessions = sessions
        .map((activity) => ({
          activity,
          recommendation: isEventEligibleForPlayer(recPlayerInput, toEventInputForScoring(activity))
            ? computeRecommendation(recPlayerInput, toEventInputForScoring(activity))
            : null,
        }))
        .sort((a, b) => (b.recommendation?.score ?? -1) - (a.recommendation?.score ?? -1));
    } else {
      scoredSessions = sessions.map((activity) => ({ activity, recommendation: null }));
    }

    // No-results AI-assisted recovery (spec section 11): only ever
    // offer a relaxation that's VERIFIED to actually return something -
    // never a suggestion that would itself come back empty. Tried one
    // relaxation at a time, cheapest/most-likely-useful first.
    let suggestions: { label: string; resultCount: number }[] = [];
    if (sessions.length === 0) {
      const tryRelaxation = async (label: string, filters: typeof baseFilters) => {
        const results = await storage.getPublicSessions(filters);
        if (results.length > 0) suggestions.push({ label, resultCount: results.length });
        return results;
      };

      if (intent.timeOfDay || dateFrom || dateTo) {
        await tryRelaxation("Show all this week", { ...baseFilters, dateFrom: undefined, dateTo: undefined });
      }
      if (resolvedLocation) {
        await tryRelaxation(`Show all ${resolvedFormat ? "matching" : ""} sessions nearby`, {
          ...baseFilters,
          location: undefined,
        });
      }
      if (resolvedFormat) {
        await tryRelaxation("Show all formats", { ...baseFilters, format: undefined });
      }
    }

    res.json({
      intent: intent.intent,
      aiUsed: usedAI,
      resolvedFilters: {
        location: resolvedLocation ?? null,
        format: resolvedFormat ?? null,
        level: resolvedLevel ?? null,
        gameFormat: intent.gameFormat ?? null,
        timeOfDay: intent.timeOfDay ?? null,
        dateFrom: dateFrom?.toISOString() ?? null,
        dateTo: dateTo?.toISOString() ?? null,
      },
      sessions: scoredSessions.map((s) => s.activity),
      recommendations: scoredSessions.map((s) => s.recommendation),
      suggestions: sessions.length === 0 ? suggestions : [],
      analytics: {
        ...analyticsBase,
        resultCount: sessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/play/recommendations - "Recommended for You" (spec: [PLAY]
// Personalised Recommendations). Deterministic, server-side scoring -
// see server/services/recommendationEngine.ts for the actual
// weighting; this route just wires it to real player/event data and
// applies the max-4/eligible-only/ranked-by-score contract.
router.get("/recommendations", async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      // Recommendations are a signed-in feature - Play itself stays
      // fully usable without an account, this endpoint just isn't
      // called for a guest (see the frontend's own isAuthenticated gate).
      return res.status(401).json({ message: "Sign in for personalised recommendations" });
    }
    const user = req.user as any;
    if (user.role !== "player") {
      return res.status(403).json({ message: "Recommendations are for players" });
    }

    const profile = await storage.getPlayerProfile(user.id);
    const playerInput: RecommendationPlayerInput = {
      skillLevel: profile?.skillLevel,
      preferredCourts: profile?.preferredCourts,
      playRadiusKm: profile?.playRadiusKm,
      latitude: profile?.latitude,
      longitude: profile?.longitude,
      availability: profile?.availability,
      gameFormat: profile?.gameFormat,
      playStyle: profile?.playStyle,
      lookingFor: profile?.lookingFor,
    };
    const isPersonalised = hasEnoughSignalForPersonalisation(playerInput);

    // Reuses the same eligible/published/non-cancelled query Play's
    // own search already goes through - no separate "recommendation
    // eligibility" query to keep in sync with the discovery one.
    const sessions = await storage.getPublicSessions({});

    const toEventInput = (s: (typeof sessions)[number]): RecommendationEventInput => ({
      id: s.id,
      type: s.type,
      skillLevel: s.skillLevel,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      startAt: s.startAt,
      timeZone: s.timeZone,
      playStatus: s.playStatus,
      registeredCount: s.registeredCount,
      maxParticipants: s.maxParticipants,
    });

    const eligible = sessions.filter((s) => isEventEligibleForPlayer(playerInput, toEventInput(s)));

    const results = isPersonalised
      ? eligible
          .map((s) => ({ activity: s, recommendation: computeRecommendation(playerInput, toEventInput(s)) }))
          .sort((a, b) => b.recommendation.score - a.recommendation.score)
      : // Low-data fallback (spec section 8) - "Popular near you", not a
        // faked percentage. Soonest-starting first, since there's no
        // real popularity/behavioural signal to rank by yet.
        eligible
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
          .map((s) => ({ activity: s, recommendation: null }));

    res.json({
      isPersonalised,
      recommendations: results.slice(0, 4),
    });
  } catch (error) {
    next(error);
  }
});

// Shared by /players-looking and smart-search's FIND_PLAYER intent
// (spec section 14 - "one Smart Search can eventually search both
// events AND players") - one matching computation, not duplicated
// per caller.
async function getMatchedPlayers(viewerId: string, limit = 4) {
  const viewerProfile = await storage.getPlayerProfile(viewerId);
  const now = new Date();

  const viewerInput: MatchCandidateInput = {
    userId: viewerId,
    skillLevel: viewerProfile?.skillLevel,
    latitude: viewerProfile?.latitude,
    longitude: viewerProfile?.longitude,
    playRadiusKm: viewerProfile?.playRadiusKm,
    gameFormat: viewerProfile?.gameFormat,
    playStyle: viewerProfile?.playStyle,
    lookingToPlayEnabled: !!viewerProfile?.lookingToPlayEnabled,
    lookingToPlayExpiresAt: viewerProfile?.lookingToPlayExpiresAt ?? null,
    lookingToPlayWhen: viewerProfile?.lookingToPlayWhen as any,
    lookingToPlayFormat: viewerProfile?.lookingToPlayFormat as any,
  };

  const candidates = await storage.getPlayersLookingToPlay();

  const results = candidates
    .map(({ user, profile }) => {
      const candidateInput: MatchCandidateInput = {
        userId: user.id,
        skillLevel: profile.skillLevel,
        latitude: profile.latitude,
        longitude: profile.longitude,
        playRadiusKm: profile.playRadiusKm,
        gameFormat: profile.gameFormat,
        playStyle: profile.playStyle,
        lookingToPlayEnabled: !!profile.lookingToPlayEnabled,
        lookingToPlayExpiresAt: profile.lookingToPlayExpiresAt,
        lookingToPlayWhen: profile.lookingToPlayWhen as any,
        lookingToPlayFormat: profile.lookingToPlayFormat as any,
        isSelf: user.id === viewerId,
        accountStatus: user.status,
        isHiddenFromDiscovery: !!user.isHidden,
      };

      if (!isPlayerEligibleForMatching(candidateInput, now)) return null;

      const match = computePlayerMatch(viewerInput, candidateInput);
      return {
        player: {
          id: user.id,
          slug: user.slug,
          name: user.name,
          avatar: user.avatar,
          location: profile.location,
          skillLevel: profile.skillLevel,
          lookingToPlayWhen: profile.lookingToPlayWhen,
          lookingToPlayFormat: profile.lookingToPlayFormat,
        },
        score: match.score,
        reasons: match.reasons,
        hasEnoughSignal: hasEnoughSignalForPlayerMatch(match.reasons),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score);

  return { players: results.slice(0, limit), total: results.length };
}

// GET /api/play/players-looking - [PLAY] Players Looking to Play.
// Signed-in players only (matching another player requires the viewer
// to have their own profile signals to compare against, and there's
// no sense showing this to a coach/organiser/guest). Uses the SAME
// playerMatchEngine as the profile's own "Good Match for You" would
// (spec section 13 - one matching service powers both).
router.get("/players-looking", async (req, res, next) => {
  try {
    if (!req.isAuthenticated?.() || (req.user as any).role !== "player") {
      return res.json({ players: [] });
    }
    const result = await getMatchedPlayers((req.user as any).id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/play/sessions/:id
router.get("/sessions/:id", async (req, res, next) => {
  try {
    const viewerUserId = req.isAuthenticated && req.isAuthenticated() ? (req.user as any).id : undefined;
    const session = await storage.getPublicSessionById(req.params.id, viewerUserId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    next(error);
  }
});

export default router;
