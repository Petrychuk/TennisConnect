import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, MapPin, X, Sparkles } from "lucide-react";
import { PlaySessionCard } from "@/components/play/session-card";
import { EventQuickViewModal } from "@/components/play/EventQuickViewModal";
import { PlayQuickFilters } from "@/components/play/PlayQuickFilters";
import { PlayFilterFields, PLAY_FILTER_ALL, PLAY_FORMAT_OPTIONS, type PlayFiltersDraft } from "@/components/play/PlayFilters";
import { PlayNoMatches, PlayNoActivitiesYet } from "@/components/play/PlayEmptyState";
import { AvailabilityNudge } from "@/components/play/AvailabilityNudge";
import { getPlaySessions, getPlayRecommendations, smartSearch, getPlayersLookingToPlay, type SmartSearchResponse } from "@/lib/api/play";
import { PlayerMatchCard } from "@/components/play/PlayerMatchCard";
import { QuickMessageModal } from "@/components/messaging/QuickMessageModal";
import { useAuth } from "@/lib/auth-context";
import { PLAY_DATE_FILTER_OPTIONS, resolveDateFilterRange, type PlayDateFilter } from "@/lib/play-status";
import { HeroBadge } from "@/components/shared/hero-badge";
import { HeroSearch, HeroSearchFiltersButton } from "@/components/shared/hero-search";
import { HeroFiltersPanel } from "@/components/shared/hero-filters";
import { HeroPhoto } from "@/components/shared/hero-photo";

/** Example smart searches shown under the search box. */
const EXAMPLES = ["Doubles this weekend", "Social tennis near me", "Competition around my level"];

const ALL = PLAY_FILTER_ALL;
const PAGE_SIZE = 6;

const COMPETITION_FORMAT_KEYS = new Set(["tournament", "league", "club-championship", "junior-event"]);

export default function PlayPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const organizerId = new URLSearchParams(searchString).get("organizer") ?? undefined;
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [smartSearchResult, setSmartSearchResult] = useState<SmartSearchResponse | null>(null);
  const [smartSearchLoading, setSmartSearchLoading] = useState(false);
  const [location, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<PlayDateFilter>("any");
  const [customDate, setCustomDate] = useState("");
  const [format, setFormat] = useState<string>(ALL);
  const [level, setLevel] = useState<string>(ALL);
  const [competitionsOnly, setCompetitionsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<PlayFiltersDraft>({
    location: "",
    dateFilter: "any",
    customDate: "",
    format: ALL,
    level: ALL,
  });

  const appliedSmartDefaults = useRef(false);
  // What was pre-filled from the player's profile (so the page can say so, and
  // so those filters don't count as something the player asked for themselves).
  const [profileDefaults, setProfileDefaults] = useState<{ location: string | null; level: string | null } | null>(null);
  const myProfileQuery = useQuery({
    queryKey: ["/api/me/player-profile", user?.id],
    queryFn: async () => {
      const res = await fetch("/api/me/player-profile", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && user?.role === "player",
  });

  useEffect(() => {
    if (appliedSmartDefaults.current) return;
    const profile = myProfileQuery.data;
    if (!profile) return;
    appliedSmartDefaults.current = true;

    // The area first: one preferred court would narrow the list to a single venue.
    const defaultLocation = profile.location || profile.preferredCourts?.[0] || "";
    if (defaultLocation) setLocationFilter(defaultLocation);

    const levelMap: Record<string, string> = {
      Beginner: "Beginner",
      Intermediate: "Intermediate",
      Advanced: "Advanced",
      Pro: "Advanced",
    };
    const defaultLevel = levelMap[profile.skillLevel];
    if (defaultLevel) setLevel(defaultLevel);
    setProfileDefaults({ location: defaultLocation || null, level: defaultLevel ?? null });
  }, [myProfileQuery.data]);

  const { from, to } = useMemo(() => resolveDateFilterRange(dateFilter, customDate), [dateFilter, customDate]);

  // "Recommended for You" (spec [PLAY] Personalised Recommendations) -
  // only fetched for a signed-in player, and only shown while the
  // player hasn't made an explicit request of their own (search or
  // any filter) - spec section 10 is explicit that personalisation
  // must never override/hide an explicit search or filter, and the
  // simplest way to guarantee that is to not show this block at all
  // once one is active, rather than trying to blend the two.
  const recommendationsQuery = useQuery({
    queryKey: ["/api/play/recommendations", user?.id],
    queryFn: getPlayRecommendations,
    enabled: isAuthenticated && user?.role === "player",
  });

  // [PLAY] Players Looking to Play
  const playersLookingQuery = useQuery({
    queryKey: ["/api/play/players-looking", user?.id],
    queryFn: getPlayersLookingToPlay,
    enabled: isAuthenticated && user?.role === "player",
  });
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null);

  // play_player_recommendation_impression (spec section 17) - fires
  // once per item, first time the Players Looking to Play list has
  // real data. Same guarded-ref pattern as the event recommendations'
  // own impression tracking above.
  const trackedPlayerImpressions = useRef(false);
  useEffect(() => {
    if (trackedPlayerImpressions.current) return;
    const players = playersLookingQuery.data?.players;
    if (!players || players.length === 0) return;
    trackedPlayerImpressions.current = true;
    players.forEach((match, position) => {
      (window as any).gtag?.("event", "play_player_recommendation_impression", {
        matchScore: match.hasEnoughSignal ? match.score : null,
        position,
        gameFormat: match.player.lookingToPlayFormat,
      });
    });
  }, [playersLookingQuery.data]);

  // [ANALYTICS][PLAY] Track personalised recommendation engagement -
  // impression fires once per item, the first time the list actually
  // has data (not on every re-render/refetch of the same data).
  // Deliberately minimal properties (spec section 15's own list) - no
  // player profile data goes into these events.
  const trackedImpressions = useRef(false);
  useEffect(() => {
    if (trackedImpressions.current) return;
    const recs = recommendationsQuery.data?.recommendations;
    if (!recs || recs.length === 0) return;
    trackedImpressions.current = true;
    recs.forEach(({ activity, recommendation }, position) => {
      (window as any).gtag?.("event", "play_recommendation_impression", {
        activityId: activity.id,
        matchScore: recommendation?.score ?? null,
        position,
        format: activity.type,
      });
    });
  }, [recommendationsQuery.data]);

  const trackRecommendationOpen = (activityId: string, score: number | undefined, position: number, format: string) => {
    (window as any).gtag?.("event", "play_recommendation_open", {
      activityId,
      matchScore: score ?? null,
      position,
      format,
    });
  };

  // [PLAY][AI] Smart Natural-Language Search - runs on submit (Enter),
  // not on every keystroke, given the latency/cost of an LLM call per
  // request. Deliberately does NOT put the raw query text into
  // analytics (spec section 17 - it could contain personal
  // information), only the interpreted intent and outcome.
  const handleSmartSearch = async (query: string) => {
    if (!query.trim()) {
      setSmartSearchResult(null);
      return;
    }
    setSmartSearchLoading(true);
    (window as any).gtag?.("event", "play_smart_search");
    try {
      const result = await smartSearch(query);
      setSmartSearchResult(result);
      if (!result.aiUsed) {
        (window as any).gtag?.("event", "play_smart_search_fallback");
      } else if (result.intent !== "FIND_PLAYER" && result.sessions.length === 0) {
        (window as any).gtag?.("event", "play_smart_search_no_results", { intent: result.intent });
      } else {
        (window as any).gtag?.("event", "play_smart_search_success", {
          intent: result.intent,
          resultCount: result.sessions.length,
        });
      }
    } catch {
      // The route itself already falls back safely server-side - a
      // failure here means the REQUEST couldn't even be made (offline,
      // etc). Same visible behaviour either way: clear the AI result
      // and let the page's own normal filter-driven search keep working.
      setSmartSearchResult(null);
      (window as any).gtag?.("event", "play_smart_search_fallback");
    } finally {
      setSmartSearchLoading(false);
    }
  };

  const clearSmartSearch = () => setSmartSearchResult(null);

  const sessionsQuery = useQuery({
    queryKey: ["/api/play/sessions", search, location, format, level, organizerId, from?.toISOString(), to?.toISOString()],
    queryFn: () =>
      getPlaySessions({
        search: search || undefined,
        location: location || undefined,
        format: format !== ALL ? format : undefined,
        level: level !== ALL ? level : undefined,
        organizerId,
        dateFrom: from?.toISOString(),
        dateTo: to?.toISOString(),
      }),
  });
  const allSessions = sessionsQuery.data ?? [];
  const sessions = competitionsOnly
    ? allSessions.filter((s) => COMPETITION_FORMAT_KEYS.has(s.type))
    : allSessions;
  const organiserName = sessions.find((s) => s.organizationId === organizerId)?.organizationName;

  useEffect(() => {
    setPage(1);
  }, [search, location, format, level, dateFilter, customDate, organizerId, competitionsOnly]);

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleSessions = sessions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters =
    !!search || !!location || dateFilter !== "any" || format !== ALL || level !== ALL || competitionsOnly;

  // Filters the player chose themselves. Profile-filled ones still in place
  // don't count, so "Recommended for You" stays visible for a signed-in player.
  const locationIsProfileDefault = !!profileDefaults && !!location && location === profileDefaults.location;
  const levelIsProfileDefault = !!profileDefaults && level !== ALL && level === profileDefaults.level;
  const explicitFiltersActive =
    !!search ||
    (!!location && !locationIsProfileDefault) ||
    dateFilter !== "any" ||
    format !== ALL ||
    (level !== ALL && !levelIsProfileDefault) ||
    competitionsOnly;

  const showEverything = () => {
    setLocationFilter("");
    setLevel(ALL);
    setProfileDefaults(null);
  };

  const clearFilters = () => {
    setSearch("");
    setLocationFilter("");
    setDateFilter("any");
    setCustomDate("");
    setFormat(ALL);
    setLevel(ALL);
    setCompetitionsOnly(false);
  };

  const clearOrganizerFilter = () => setLocation("/play");

  const openFilters = () => {
    setDraft({ location, dateFilter, customDate, format, level });
    setFiltersOpen(true);
  };

  const applyDraftFilters = () => {
    setLocationFilter(draft.location);
    setDateFilter(draft.dateFilter);
    setCustomDate(draft.customDate);
    setFormat(draft.format);
    setLevel(draft.level);
    setFiltersOpen(false);
  };

  const clearDraftFilters = () => {
    setDraft({ location: "", dateFilter: "any", customDate: "", format: ALL, level: ALL });
  };

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<{ score: number; reasons: string[] } | null>(null);
  const dateFilterLabel = PLAY_DATE_FILTER_OPTIONS.find((o) => o.value === dateFilter)?.label;
  const formatLabel = PLAY_FORMAT_OPTIONS.find((o) => o.key === format)?.label;

  // Hero search: typing keeps the normal filter-driven list in sync and
  // drops a stale AI answer; the lime button / Enter runs the smart search.
  const onSearchChange = (value: string) => {
    setSearch(value);
    if (smartSearchResult) setSmartSearchResult(null);
  };
  const runExample = (example: string) => {
    setSearch(example);
    handleSmartSearch(example);
  };
  // Filters set in the Filters dialog (shown as a badge on its button).
  const panelFiltersCount =
    (location ? 1 : 0) + (dateFilter !== "any" ? 1 : 0) + (format !== ALL ? 1 : 0) + (level !== ALL ? 1 : 0);
  // The Filters panel (dropdown on tablet/desktop, modal on phones). It
  // edits a draft; "Show results" applies it, as the old dialog did.
  const renderFiltersPanel = (variant: "desktop" | "mobile", triggerTestId: string) => (
    <HeroFiltersPanel
      variant={variant}
      open={filtersOpen}
      onOpenChange={(next) => (next ? openFilters() : setFiltersOpen(false))}
      trigger={<HeroSearchFiltersButton activeCount={panelFiltersCount} data-testid={triggerTestId} />}
      onClear={clearDraftFilters}
      onApply={applyDraftFilters}
      contentTestId="play-filters-dialog"
      clearTestId="play-filters-clear-all"
      applyTestId="play-filters-show-results"
    >
      <PlayFilterFields draft={draft} onDraftChange={setDraft} idSuffix={variant === "mobile" ? "-mobile" : ""} />
    </HeroFiltersPanel>
  );
  const quickFilterProps = {
    location,
    dateFilter,
    format,
    competitionsOnly,
    isAuthenticated,
    onNearMe: () => {
      const mine = myProfileQuery.data?.preferredCourts?.[0] || myProfileQuery.data?.location;
      setLocationFilter(mine || location);
    },
    onToggleThisWeek: () => setDateFilter((v) => (v === "this_week" ? "any" : "this_week")),
    onToggleThisWeekend: () => setDateFilter((v) => (v === "this_weekend" ? "any" : "this_weekend")),
    onToggleSocial: () => setFormat((v) => (v === "social" ? ALL : "social")),
    onToggleCompetitions: () => setCompetitionsOnly((v) => !v),
  };

  return (
    <div className="min-h-screen bg-background font-sans" data-testid="play-page">
      <SEO
        title="Find a Game | TennisConnect"
        description="Find tennis sessions, competitions and events near you - Social Tennis, Americano, Tournaments and more, all in one place."
      />
      {/* The hero photo is preloaded by client/index.html (before the JS bundle). */}
      <Navbar />

      <main id="main-content">
        {/* Hero - same structure as Players, Coaches, Clubs, Travels and
            Articles: one photo that fades into the page, the HeroBadge,
            a title with the key word in lime, the intro on its plate and
            the search pill with the quick-filter icons under it. Phones get
            the photo with the badge on its bottom edge, then the title and
            search below it. */}
        <div className="relative overflow-hidden">
          <HeroPhoto hero="games" alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_40%] z-0" />
          {/* Tablet/desktop: the left half of the photo darkens towards the left edge (smooth, no hard line) so the title, intro and search stay readable. Phones keep the plain photo. */}
          <div aria-hidden="true" className="tc-hero-left-shade absolute inset-0 hidden md:block z-10" />
          <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />

          <div className="relative min-h-[28vh] md:min-h-[32vh] lg:min-h-[36vh] flex items-center md:items-start justify-start">
            {/* Badge (mobile) - overlaps the bottom edge of the hero photo */}
            <div className="md:hidden absolute bottom-3 left-4 z-20">
              <HeroBadge size="sm">Play more tennis</HeroBadge>
            </div>
            <div className="relative z-20 container mx-auto px-4 text-left mt-24 md:mt-0 md:pt-[104px]">
              <div className="hidden md:block">
                <HeroBadge className="mb-6">Play more tennis</HeroBadge>
                <h1
                  className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-display font-bold mb-4 tracking-tight text-white tc-hero-text"
                  data-testid="play-page-title"
                >
                  Find a{" "}
                  <span className="relative inline-block text-primary">
                    Game
                    <svg
                      className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40"
                      viewBox="0 0 100 10"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                    </svg>
                  </span>
                </h1>
                <p className="text-lg md:text-[20px] md:leading-[1.3] text-white max-w-2xl font-medium tc-hero-intro">
                  Find tennis sessions, competitions and events near you.
                </p>
                <HeroSearch
                  className="mt-6 max-w-3xl"
                  value={search}
                  onValueChange={onSearchChange}
                  onSubmit={() => handleSmartSearch(search)}
                  busy={smartSearchLoading}
                  placeholder="Search tournaments, social tennis, sessions and more..."
                  label="What would you like to play?"
                  inputTestId="play-page-search-input"
                  submitTestId="play-page-search-submit"
                  filters={renderFiltersPanel("desktop", "play-quick-filter-open")}
                />
                {/* "Try" examples: small dark glass pills - plain white
                    links disappeared on the bright photo. */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-white tc-hero-text">Try:</span>
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="rounded-full bg-black/55 px-3 py-1 font-medium text-white ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => runExample(example)}
                      data-testid={`play-search-example-${example.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <PlayQuickFilters {...quickFilterProps} className="mt-6" />
              </div>
            </div>
          </div>

          <div className="pb-1.5 md:pb-16" />
        </div>

        {/* Hero text (mobile) - sits below the hero photo instead of overlapping it */}
        <div className="md:hidden relative z-20 bg-background pt-2 pb-1">
          <div className="container mx-auto px-4 text-left">
            <h1 className="text-3xl font-display font-bold mb-1 tracking-tight text-foreground" data-testid="play-page-title-mobile">
              Find a{" "}
              <span className="text-primary-text relative inline-block">
                Game
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary-text opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl font-medium leading-snug">
              Find tennis sessions, competitions and events near you.
            </p>
          </div>
        </div>

        {/* Search (mobile) - below the hero text, like the other pages */}
        <div className="md:hidden relative z-20 bg-background pt-1 pb-2">
          <div className="container mx-auto px-4">
            <HeroSearch
              tone="light"
              value={search}
              onValueChange={onSearchChange}
              onSubmit={() => handleSmartSearch(search)}
              busy={smartSearchLoading}
              placeholder="Tournaments, social tennis, sessions..."
              label="What would you like to play?"
              inputTestId="play-page-search-input-mobile"
              submitTestId="play-page-search-submit-mobile"
              filters={renderFiltersPanel("mobile", "play-quick-filter-open-mobile")}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => runExample(example)}
                  data-testid={`play-search-example-mobile-${example.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {example}
                </button>
              ))}
            </div>
            <PlayQuickFilters {...quickFilterProps} tone="light" testIdSuffix="-mobile" className="mt-3" />
          </div>
        </div>

        <div className="container mx-auto px-4 pt-6 pb-16">
          {organizerId && (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 mb-5"
              data-testid="play-page-organizer-filter-banner"
            >
              <p className="text-sm">
                Showing activities organised by <span className="font-semibold">{organiserName ?? "this organiser"}</span>
              </p>
              <Button variant="ghost" size="sm" onClick={clearOrganizerFilter} data-testid="play-page-clear-organizer-filter">
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            </div>
          )}


          {profileDefaults &&
            !smartSearchResult &&
            ((!!location && location === profileDefaults.location) || (level !== ALL && level === profileDefaults.level)) && (
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-sm text-muted-foreground"
                data-testid="play-profile-defaults-note"
              >
                <Sparkles className="w-4 h-4 text-primary-text shrink-0" />
                <span>Tailored to your profile. Sessions open to all levels are included.</span>
                <button type="button" className="underline underline-offset-2" onClick={showEverything} data-testid="play-profile-defaults-reset">
                  Show everything
                </button>
                <Link href="/player/profile" className="underline underline-offset-2" data-testid="play-profile-defaults-edit">
                  Edit profile
                </Link>
              </div>
            )}

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-5" data-testid="play-page-active-chips">
              {location && (
                <Badge variant="secondary" className="gap-1 pr-1.5" data-testid="play-chip-location">
                  {location}
                  <button onClick={() => setLocationFilter("")} aria-label="Remove location filter">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {dateFilter !== "any" && (
                <Badge variant="secondary" className="gap-1 pr-1.5" data-testid="play-chip-date">
                  {dateFilter === "custom" && customDate ? customDate : dateFilterLabel}
                  <button onClick={() => { setDateFilter("any"); setCustomDate(""); }} aria-label="Remove date filter">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {format !== ALL && (
                <Badge variant="secondary" className="gap-1 pr-1.5" data-testid="play-chip-format">
                  {formatLabel}
                  <button onClick={() => setFormat(ALL)} aria-label="Remove format filter">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {level !== ALL && (
                <Badge variant="secondary" className="gap-1 pr-1.5" data-testid="play-chip-level">
                  {level}
                  <button onClick={() => setLevel(ALL)} aria-label="Remove level filter">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {competitionsOnly && (
                <Badge variant="secondary" className="gap-1 pr-1.5" data-testid="play-chip-competitions">
                  Competitions
                  <button onClick={() => setCompetitionsOnly(false)} aria-label="Remove competitions filter">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="play-page-clear-filters-chips">
                Clear all
              </Button>
            </div>
          )}

          <div className="space-y-5">
            {!smartSearchResult && !explicitFiltersActive && isAuthenticated && user?.role === "player" && myProfileQuery.data && !myProfileQuery.data.availability?.length && (
              <AvailabilityNudge
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/me/player-profile"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/play/recommendations"] });
                }}
              />
            )}

            {!smartSearchResult && !explicitFiltersActive && isAuthenticated && user?.role === "player" && recommendationsQuery.data && recommendationsQuery.data.recommendations.length > 0 && (
              <div className="space-y-3" data-testid="play-recommendations-section">
                <div>
                  <h2 className="font-display font-bold text-lg flex items-center gap-1.5" data-testid="play-recommendations-heading">
                    {recommendationsQuery.data.isPersonalised ? (
                      <>✨ Recommended for You</>
                    ) : (
                      <>Popular near you</>
                    )}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {recommendationsQuery.data.isPersonalised
                      ? "Games that match your level, location and tennis preferences."
                      : "Tennis happening near you - add your preferences for better matches."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {recommendationsQuery.data.recommendations.map(({ activity, recommendation }, position) => (
                    <PlaySessionCard
                      key={activity.id}
                      session={activity}
                      recommendation={recommendation}
                      onView={() => {
                        setSelectedSessionId(activity.id);
                        setSelectedRecommendation(recommendation);
                        trackRecommendationOpen(activity.id, recommendation?.score, position, activity.type);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {!smartSearchResult && !explicitFiltersActive && isAuthenticated && user?.role === "player" && playersLookingQuery.data && playersLookingQuery.data.players.length > 0 && (
              <div className="space-y-3" data-testid="play-players-looking-section">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display font-bold text-lg" data-testid="play-players-looking-heading">
                      👥 Players Looking to Play
                    </h2>
                    <p className="text-sm text-muted-foreground">Find players near you who are ready for a game.</p>
                  </div>
                  <Link href="/players?lookingToPlay=true" className="text-sm text-primary-text font-medium shrink-0" data-testid="play-see-all-players">
                    See all players →
                  </Link>
                </div>
                <div className="space-y-3">
                  {playersLookingQuery.data.players.map((match) => (
                    <PlayerMatchCard
                      key={match.player.id}
                      match={match}
                      onInvite={() => setInviteTarget({ id: match.player.id, name: match.player.name })}
                    />
                  ))}
                </div>
              </div>
            )}

            {smartSearchLoading && (
              <div className="space-y-4" data-testid="play-smart-search-loading">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
              </div>
            )}

            {!smartSearchLoading && smartSearchResult && (
              <div className="space-y-4" data-testid="play-smart-search-result">
                {!smartSearchResult.aiUsed && (
                  <p className="text-sm text-muted-foreground" data-testid="play-smart-search-fallback-note">
                    We couldn't understand all of that, so we're showing results for "{search}".
                  </p>
                )}

                {smartSearchResult.intent === "FIND_PLAYER" ? (
                  smartSearchResult.players.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Players matching your search</p>
                      {smartSearchResult.players.map((match) => (
                        <PlayerMatchCard
                          key={match.player.id}
                          match={match}
                          onInvite={() => setInviteTarget({ id: match.player.id, name: match.player.name })}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2 py-16" data-testid="play-smart-search-find-player">
                      <Sparkles className="w-8 h-8 text-muted-foreground" />
                      <p className="font-semibold">{smartSearchResult.message}</p>
                    </div>
                  )
                ) : (
                  <>
                    {smartSearchResult.aiUsed && smartSearchResult.resolvedFilters && (
                      <div className="flex flex-wrap items-center gap-2" data-testid="play-smart-search-chips">
                        <span className="text-xs text-muted-foreground">Showing matches for:</span>
                        {[
                          smartSearchResult.resolvedFilters.location,
                          smartSearchResult.resolvedFilters.format,
                          smartSearchResult.resolvedFilters.level,
                          smartSearchResult.resolvedFilters.timeOfDay,
                          ...(smartSearchResult.resolvedFilters.gameFormat ?? []),
                        ]
                          .filter(Boolean)
                          .map((label, i) => (
                            <Badge key={i} variant="secondary">{label}</Badge>
                          ))}
                        <Button variant="ghost" size="sm" onClick={clearSmartSearch} data-testid="play-smart-search-clear">
                          <X className="w-3.5 h-3.5 mr-1" /> Clear
                        </Button>
                      </div>
                    )}

                    {smartSearchResult.sessions.length === 0 ? (
                      <div className="flex flex-col items-center text-center gap-3 py-12" data-testid="play-smart-search-no-results">
                        <Search className="w-8 h-8 text-muted-foreground" />
                        <p className="font-semibold">No exact matches</p>
                        {smartSearchResult.suggestions.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-2 mt-1">
                            {smartSearchResult.suggestions.map((s) => (
                              <Button
                                key={s.label}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSmartSearch(s.label)}
                                data-testid={`play-smart-search-suggestion-${s.label.replace(/\s+/g, "-").toLowerCase()}`}
                              >
                                {s.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {smartSearchResult.sessions.map((s, i) => (
                          <PlaySessionCard
                            key={s.id}
                            session={s}
                            recommendation={smartSearchResult.recommendations[i]}
                            onView={() => {
                              setSelectedSessionId(s.id);
                              setSelectedRecommendation(smartSearchResult.recommendations[i]);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!smartSearchResult && (sessionsQuery.isLoading ? (
              <div className="space-y-4" data-testid="play-page-loading">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
              </div>
            ) : sessions.length === 0 ? (
              hasActiveFilters || organizerId ? (
                <PlayNoMatches hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
              ) : (
                <PlayNoActivitiesYet />
              )
            ) : (
              <>
                <p className="text-sm text-muted-foreground" data-testid="play-page-results-count">
                  {sessions.length} session{sessions.length === 1 ? "" : "s"} found
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="play-page-results">
                  {visibleSessions.map((session) => (
                    <PlaySessionCard
                      key={session.id}
                      session={session}
                      onView={() => {
                        setSelectedSessionId(session.id);
                        setSelectedRecommendation(null);
                      }}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <Pagination data-testid="play-page-pagination">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setPage(currentPage - 1);
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                          data-testid="play-page-pagination-previous"
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === i + 1}
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(i + 1);
                            }}
                            data-testid={`play-page-pagination-${i + 1}`}
                          >
                            {i + 1}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) setPage(currentPage + 1);
                          }}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
                          data-testid="play-page-pagination-next"
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            ))}
          </div>
        </div>
      </main>


      <Footer />

      <EventQuickViewModal        sessionId={selectedSessionId}
        recommendation={selectedRecommendation}
        onJoinSuccess={(id) => {
          if (selectedRecommendation) {
            const activity = recommendationsQuery.data?.recommendations.find((r) => r.activity.id === id)?.activity;
            (window as any).gtag?.("event", "play_recommendation_join", {
              activityId: id,
              matchScore: selectedRecommendation.score,
              format: activity?.type ?? null,
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSessionId(null);
            setSelectedRecommendation(null);
          }
        }}
      />

      {/* [PLAY] Invite to Play - spec section 10: "use existing
          messaging functionality where possible" rather than a
          separate booking flow. Prefilled with a friendly default the
          player can edit before sending, same modal used elsewhere in
          the app for a quick message. */}
      {inviteTarget && (
        <QuickMessageModal
          open={!!inviteTarget}
          onOpenChange={(open) => !open && setInviteTarget(null)}
          recipient={{ id: inviteTarget.id, name: inviteTarget.name, type: "player" }}
          title={`Invite ${inviteTarget.name.split(" ")[0]} to play 🎾`}
          defaultMessage={`Hi ${inviteTarget.name.split(" ")[0]}, want to play sometime soon?`}
          messageType="play_invite"
        />
      )}
    </div>
  );
}
