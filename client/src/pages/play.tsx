import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { Input } from "@/components/ui/input";
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
import { Search, MapPin, X } from "lucide-react";
import { PlaySessionCard } from "@/components/play/session-card";
import { EventQuickViewModal } from "@/components/play/EventQuickViewModal";
import { PlayQuickFilters } from "@/components/play/PlayQuickFilters";
import { PlayFilters, PLAY_FILTER_ALL, PLAY_FORMAT_OPTIONS, type PlayFiltersDraft } from "@/components/play/PlayFilters";
import { PlayNoMatches, PlayNoActivitiesYet } from "@/components/play/PlayEmptyState";
import { AvailabilityNudge } from "@/components/play/AvailabilityNudge";
import { getPlaySessions, getPlayRecommendations } from "@/lib/api/play";
import { useAuth } from "@/lib/auth-context";
import { PLAY_DATE_FILTER_OPTIONS, resolveDateFilterRange, type PlayDateFilter } from "@/lib/play-status";
import playHeroDesktop from "/assets/images/play-hero-desktop.webp";
import playHeroMobile from "/assets/images/play-hero-mobile.webp";

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

    const defaultLocation = profile.preferredCourts?.[0] || profile.location || "";
    if (defaultLocation) setLocationFilter(defaultLocation);

    const levelMap: Record<string, string> = {
      Beginner: "Beginner",
      Intermediate: "Intermediate",
      Advanced: "Advanced",
      Pro: "Advanced",
    };
    const defaultLevel = levelMap[profile.skillLevel];
    if (defaultLevel) setLevel(defaultLevel);
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

  return (
    <div className="min-h-screen bg-background font-sans" data-testid="play-page">
      <SEO
        title="Find a Game | TennisConnect"
        description="Find tennis sessions, competitions and events near you - Social Tennis, Americano, Tournaments and more, all in one place."
      />
      <Helmet>
        <link rel="preload" as="image" href={playHeroMobile} media="(max-width: 639px)" />
        <link rel="preload" as="image" href={playHeroDesktop} media="(min-width: 640px)" />
      </Helmet>
      <Navbar />

      <main id="main-content">
        <div className="sm:hidden">
          <img src={playHeroMobile} alt="" className="w-full h-56 object-cover" fetchPriority="high" />
          <div className="px-4 pt-5 pb-2 text-center">
            <p className="text-primary text-xs font-bold tracking-widest uppercase mb-2">Play more tennis</p>
            <h1 className="text-3xl font-display font-bold" data-testid="play-page-title-mobile">Find a Game</h1>
            <p className="text-sm text-muted-foreground mt-2">Find tennis sessions, competitions and events near you.</p>
            <div className="relative max-w-xs mx-auto mt-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by session, venue or organiser..."
                className="pl-10 h-11"
                data-testid="play-page-search-input-mobile"
              />
            </div>
          </div>
        </div>

        <div className="hidden sm:flex relative min-h-[46vh] md:mt-10 md:min-h-[calc(46vh+50px)] items-center justify-center overflow-hidden bg-black">
          <img
            src={playHeroDesktop}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-background" />
          <div className="relative z-10 container mx-auto px-4 text-center mt-[106px] sm:mt-[114px]">
            <p className="text-primary text-xs sm:text-sm font-bold tracking-widest uppercase mb-2">Play more tennis</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white" data-testid="play-page-title">
              Find a Game
            </h1>
            <p className="text-sm sm:text-base text-gray-200 mt-2 max-w-xl mx-auto">
              Find tennis sessions, competitions and events near you.
            </p>

            <div className="relative max-w-xs mx-auto mt-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by session, venue or organiser..."
                className="pl-10 h-11 bg-background"
                data-testid="play-page-search-input"
              />
            </div>
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

          <PlayQuickFilters
            location={location}
            dateFilter={dateFilter}
            competitionsOnly={competitionsOnly}
            isAuthenticated={isAuthenticated}
            onNearMe={() => {
              const mine = myProfileQuery.data?.preferredCourts?.[0] || myProfileQuery.data?.location;
              setLocationFilter(mine || location);
            }}
            onToggleThisWeek={() => setDateFilter((v) => (v === "this_week" ? "any" : "this_week"))}
            onToggleThisWeekend={() => setDateFilter((v) => (v === "this_weekend" ? "any" : "this_weekend"))}
            onToggleCompetitions={() => setCompetitionsOnly((v) => !v)}
            onOpenFilters={openFilters}
          />

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
            {!hasActiveFilters && isAuthenticated && user?.role === "player" && myProfileQuery.data && !myProfileQuery.data.availability?.length && (
              <AvailabilityNudge
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/me/player-profile"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/play/recommendations"] });
                }}
              />
            )}

            {!hasActiveFilters && isAuthenticated && user?.role === "player" && recommendationsQuery.data && recommendationsQuery.data.recommendations.length > 0 && (
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
                <div className="space-y-4">
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

            {sessionsQuery.isLoading ? (
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
                <div className="space-y-4" data-testid="play-page-results">
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
            )}
          </div>
        </div>
      </main>

      <PlayFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        draft={draft}
        onDraftChange={setDraft}
        onClear={clearDraftFilters}
        onApply={applyDraftFilters}
      />

      <Footer />

      <EventQuickViewModal
        sessionId={selectedSessionId}
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
    </div>
  );
}
