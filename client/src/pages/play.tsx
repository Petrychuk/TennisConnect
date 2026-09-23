import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, MapPin, CalendarDays, X, Sparkles, Tag, BarChart3, SlidersHorizontal, Trophy } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlaySessionCard } from "@/components/play/session-card";
import { EventQuickViewModal } from "@/components/play/EventQuickViewModal";
import { getPlaySessions, getPlayRecommendations } from "@/lib/api/play";
import { useAuth } from "@/lib/auth-context";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { PLAY_DATE_FILTER_OPTIONS, PLAY_LEVEL_OPTIONS, resolveDateFilterRange, type PlayDateFilter } from "@/lib/play-status";
import playHeroDesktop from "/assets/images/play-hero-desktop.webp";
import playHeroMobile from "/assets/images/play-hero-mobile.webp";

const ALL = "all";
const PAGE_SIZE = 6;

const PLAY_FORMAT_OPTIONS = SESSION_TYPE_OPTIONS.filter((opt) => opt.key !== "custom");
const COMPETITION_FORMAT_KEYS = new Set(["tournament", "league", "club-championship", "junior-event"]);

export default function PlayPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const organizerId = new URLSearchParams(searchString).get("organizer") ?? undefined;
  const { user, isAuthenticated } = useAuth();

  const [search, setSearch] = useState("");
  const [location, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<PlayDateFilter>("any");
  const [customDate, setCustomDate] = useState("");
  const [format, setFormat] = useState<string>(ALL);
  const [level, setLevel] = useState<string>(ALL);
  const [competitionsOnly, setCompetitionsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftLocation, setDraftLocation] = useState("");
  const [draftDateFilter, setDraftDateFilter] = useState<PlayDateFilter>("any");
  const [draftCustomDate, setDraftCustomDate] = useState("");
  const [draftFormat, setDraftFormat] = useState<string>(ALL);
  const [draftLevel, setDraftLevel] = useState<string>(ALL);

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
    setDraftLocation(location);
    setDraftDateFilter(dateFilter);
    setDraftCustomDate(customDate);
    setDraftFormat(format);
    setDraftLevel(level);
    setFiltersOpen(true);
  };

  const applyDraftFilters = () => {
    setLocationFilter(draftLocation);
    setDateFilter(draftDateFilter);
    setCustomDate(draftCustomDate);
    setFormat(draftFormat);
    setLevel(draftLevel);
    setFiltersOpen(false);
  };

  const clearDraftFilters = () => {
    setDraftLocation("");
    setDraftDateFilter("any");
    setDraftCustomDate("");
    setDraftFormat(ALL);
    setDraftLevel(ALL);
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

          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0"
            data-testid="play-page-quick-filters"
          >
            <Button
              variant={location ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => {
                const mine = myProfileQuery.data?.preferredCourts?.[0] || myProfileQuery.data?.location;
                setLocationFilter(mine || location);
              }}
              disabled={!isAuthenticated}
              title={!isAuthenticated ? "Sign in to filter by your own area" : undefined}
              data-testid="play-quick-filter-near-me"
            >
              <MapPin className="w-3.5 h-3.5 mr-1.5" /> Near me
            </Button>
            <Button
              variant={dateFilter === "this_week" ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => setDateFilter((v) => (v === "this_week" ? "any" : "this_week"))}
              data-testid="play-quick-filter-this-week"
            >
              This week
            </Button>
            <Button
              variant={dateFilter === "this_weekend" ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => setDateFilter((v) => (v === "this_weekend" ? "any" : "this_weekend"))}
              data-testid="play-quick-filter-this-weekend"
            >
              This weekend
            </Button>
            <Button
              variant={competitionsOnly ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => setCompetitionsOnly((v) => !v)}
              data-testid="play-quick-filter-competitions"
            >
              <Trophy className="w-3.5 h-3.5 mr-1.5" /> Competitions
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-full"
              onClick={openFilters}
              data-testid="play-quick-filter-open"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters
            </Button>
          </div>

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
            {!hasActiveFilters && isAuthenticated && user?.role === "player" && recommendationsQuery.data && recommendationsQuery.data.recommendations.length > 0 && (
              <div className="space-y-3" data-testid="play-recommendations-section">
                <div>
                  <h2 className="font-display font-bold text-lg flex items-center gap-1.5">
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
                  {recommendationsQuery.data.recommendations.map(({ activity, recommendation }) => (
                    <PlaySessionCard
                      key={activity.id}
                      session={activity}
                      recommendation={recommendation}
                      onView={() => {
                        setSelectedSessionId(activity.id);
                        setSelectedRecommendation(recommendation);
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
                <div className="flex flex-col items-center text-center gap-3 py-16" data-testid="play-page-no-matches">
                  <Search className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">No games found</p>
                    <p className="text-sm text-muted-foreground mt-1">Try changing your date, location or filters.</p>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters} data-testid="play-page-clear-filters">
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-3 py-16" data-testid="play-page-empty">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">New games are coming soon</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      TennisConnect organisers are adding new sessions and competitions.
                    </p>
                  </div>
                </div>
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

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-md" data-testid="play-filters-dialog">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="play-filter-location" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> Location
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="play-filter-location"
                  value={draftLocation}
                  onChange={(e) => setDraftLocation(e.target.value)}
                  placeholder="Suburb, city or venue..."
                  className="pl-9"
                  data-testid="play-filter-location"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5" /> Date
              </p>
              <RadioGroup
                value={draftDateFilter}
                onValueChange={(v) => setDraftDateFilter(v as PlayDateFilter)}
                className="gap-1.5"
                data-testid="play-filter-date"
              >
                {PLAY_DATE_FILTER_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value={opt.value} data-testid={`play-filter-date-${opt.value}`} />
                    {opt.label}
                  </label>
                ))}
              </RadioGroup>
              {draftDateFilter === "custom" && (
                <Input
                  type="date"
                  value={draftCustomDate}
                  onChange={(e) => setDraftCustomDate(e.target.value)}
                  className="mt-1.5"
                  data-testid="play-filter-custom-date"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Tag className="w-3.5 h-3.5" /> Format
              </Label>
              <Select value={draftFormat} onValueChange={setDraftFormat}>
                <SelectTrigger data-testid="play-filter-format"><SelectValue placeholder="All Formats" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} data-testid="play-filter-format-all">All Formats</SelectItem>
                  {PLAY_FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key} data-testid={`play-filter-format-${opt.key}`}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <BarChart3 className="w-3.5 h-3.5" /> Level
              </Label>
              <Select value={draftLevel} onValueChange={setDraftLevel}>
                <SelectTrigger data-testid="play-filter-level"><SelectValue placeholder="All Levels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} data-testid="play-filter-level-all">All Levels</SelectItem>
                  {PLAY_LEVEL_OPTIONS.filter((l) => l !== "All Levels").map((lvl) => (
                    <SelectItem key={lvl} value={lvl} data-testid={`play-filter-level-${lvl}`}>{lvl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="ghost" onClick={clearDraftFilters} data-testid="play-filters-clear-all">
              Clear all
            </Button>
            <Button onClick={applyDraftFilters} data-testid="play-filters-show-results">
              Show results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />

      <EventQuickViewModal
        sessionId={selectedSessionId}
        recommendation={selectedRecommendation}
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
