import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Search, MapPin, CalendarDays, X, Sparkles, Tag, BarChart3 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlaySessionCard } from "@/components/play/session-card";
import { getPlaySessions } from "@/lib/api/play";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { PLAY_DATE_FILTER_OPTIONS, PLAY_LEVEL_OPTIONS, resolveDateFilterRange, type PlayDateFilter } from "@/lib/play-status";
import playHeroDesktop from "/assets/images/play-hero-desktop.webp";

const ALL = "all";
const PAGE_SIZE = 6;

// "Custom Session" is an organiser-defined free-for-all format (spec:
// "Build your own format by choosing the rules, scoring..."), not a
// recognisable category a player would ever filter by - it's excluded
// from Play's own Format filter for that reason, even though it's a
// perfectly valid session type elsewhere (the organiser wizard, etc).
const PLAY_FORMAT_OPTIONS = SESSION_TYPE_OPTIONS.filter((opt) => opt.key !== "custom");

export default function PlayPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const organizerId = new URLSearchParams(searchString).get("organizer") ?? undefined;

  const [search, setSearch] = useState("");
  const [location, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<PlayDateFilter>("any");
  const [customDate, setCustomDate] = useState("");
  const [format, setFormat] = useState<string>(ALL);
  const [level, setLevel] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const { from, to } = useMemo(() => resolveDateFilterRange(dateFilter, customDate), [dateFilter, customDate]);

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
  const sessions = sessionsQuery.data ?? [];
  const organiserName = sessions.find((s) => s.organizationId === organizerId)?.organizationName;

  // Any filter change invalidates whatever page the person was on -
  // starting back at page 1 is the only choice that can't strand them
  // on a now-empty page.
  useEffect(() => {
    setPage(1);
  }, [search, location, format, level, dateFilter, customDate, organizerId]);

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleSessions = sessions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters = !!search || !!location || dateFilter !== "any" || format !== ALL || level !== ALL;

  const clearFilters = () => {
    setSearch("");
    setLocationFilter("");
    setDateFilter("any");
    setCustomDate("");
    setFormat(ALL);
    setLevel(ALL);
  };

  const clearOrganizerFilter = () => setLocation("/play");

  // Shared between the md+ sidebar and the mobile fallback row so the
  // two never drift out of sync with each other.
  const formatSelect = (testIdPrefix: string) => (
    <Select value={format} onValueChange={setFormat}>
      <SelectTrigger data-testid={`${testIdPrefix}-format`}><SelectValue placeholder="All Formats" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL} data-testid={`${testIdPrefix}-format-all`}>All Formats</SelectItem>
        {PLAY_FORMAT_OPTIONS.map((opt) => (
          <SelectItem key={opt.key} value={opt.key} data-testid={`${testIdPrefix}-format-${opt.key}`}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const levelSelect = (testIdPrefix: string) => (
    <Select value={level} onValueChange={setLevel}>
      <SelectTrigger data-testid={`${testIdPrefix}-level`}><SelectValue placeholder="All Levels" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL} data-testid={`${testIdPrefix}-level-all`}>All Levels</SelectItem>
        {PLAY_LEVEL_OPTIONS.filter((l) => l !== "All Levels").map((lvl) => (
          <SelectItem key={lvl} value={lvl} data-testid={`${testIdPrefix}-level-${lvl}`}>{lvl}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="min-h-screen bg-background font-sans" data-testid="play-page">
      <SEO
        title="Find a Game | TennisConnect"
        description="Find tennis sessions, competitions and events near you - Social Tennis, Americano, Tournaments and more, all in one place."
      />
      {/* The hero photo is the page's LCP element - preloaded so the
          browser starts fetching it immediately instead of only once
          it's discovered mid-way through parsing the DOM. */}
      <Helmet>
        <link rel="preload" as="image" href={playHeroDesktop} />
      </Helmet>
      <Navbar />

      <main id="main-content">
        {/* Full-bleed hero, same convention as the rest of the site
            (see tournaments.tsx): background photo + dark gradient +
            centered text. Same photo on every breakpoint now (no more
            picture/source swap) - object-position shifts per
            breakpoint instead, keeping the branded left-hand part of
            the photo in frame on a narrow/tall mobile screen rather
            than centre-cropping into the plain court/sideline area on
            the right (that stray white court line is what read as a
            floating "stripe" on mobile). The search field sits inside
            the hero, in its lower part, where the gradient is already
            almost fully the page's own background colour - legible
            regardless of which photo is behind it. */}
        <div className="relative min-h-[42vh] sm:min-h-[46vh] md:mt-10 md:min-h-[calc(46vh+50px)] flex items-center justify-center overflow-hidden bg-black">
          <img
            src={playHeroDesktop}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[20%_center] md:object-center"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-background" />
          <div className="relative z-10 container mx-auto px-4 text-center mt-[106px] sm:mt-[114px]">
            <p className="text-primary text-xs sm:text-sm font-bold tracking-widest uppercase mb-2">Play more tennis</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white" data-testid="play-page-title">
              Find a Game
            </h1>
            <p className="text-sm sm:text-base text-gray-200 mt-2 max-w-xl mx-auto">
              Your next match is closer than you think.
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

          {/* Mobile-only compact filter row - the sidebar (below) is
              md+ only. Clean 2x2: Location/Date on top, Format/Level
              below - no field spans a row on its own. */}
          <div className="md:hidden grid grid-cols-2 gap-2 mb-5" data-testid="play-page-filters-mobile">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={location}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Location"
                className="pl-9"
                data-testid="play-page-filter-location-mobile"
              />
            </div>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as PlayDateFilter)}>
              <SelectTrigger data-testid="play-page-filter-date-mobile">
                <CalendarDays className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAY_DATE_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`play-page-filter-date-mobile-${opt.value}`}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formatSelect("play-page-filter-mobile")}
            {levelSelect("play-page-filter-mobile")}
            {dateFilter === "custom" && (
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="col-span-2"
                data-testid="play-page-filter-custom-date-mobile"
              />
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Main filters - side column on tablet and desktop. */}
            <aside className="hidden md:block w-64 shrink-0" data-testid="play-page-filters-sidebar">
              <div className="sticky top-20 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="play-sidebar-location" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="play-sidebar-location"
                      value={location}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      placeholder="Suburb, city or venue..."
                      className="pl-9"
                      data-testid="play-page-filter-location"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5" /> Date
                  </p>
                  <RadioGroup
                    value={dateFilter}
                    onValueChange={(v) => setDateFilter(v as PlayDateFilter)}
                    className="gap-1.5"
                    data-testid="play-page-filter-date"
                  >
                    {PLAY_DATE_FILTER_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <RadioGroupItem value={opt.value} data-testid={`play-page-filter-date-${opt.value}`} />
                        {opt.label}
                      </label>
                    ))}
                  </RadioGroup>
                  {dateFilter === "custom" && (
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="mt-1.5"
                      data-testid="play-page-filter-custom-date"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <Tag className="w-3.5 h-3.5" /> Format
                  </Label>
                  {formatSelect("play-page-filter")}
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <BarChart3 className="w-3.5 h-3.5" /> Level
                  </Label>
                  {levelSelect("play-page-filter")}
                </div>

                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="w-full" onClick={clearFilters} data-testid="play-page-clear-filters-sidebar">
                    Clear all filters
                  </Button>
                )}
              </div>
            </aside>

            <div className="flex-1 min-w-0 space-y-5">
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
                      <p className="text-sm text-muted-foreground mt-1">Try changing your date, location or level.</p>
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
                        TennisConnect organisers are adding new sessions and events.
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground" data-testid="play-page-results-count">
                      {sessions.length} session{sessions.length === 1 ? "" : "s"} found
                    </p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" className="md:hidden" onClick={clearFilters} data-testid="play-page-clear-filters-mobile">
                        Clear filters
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4" data-testid="play-page-results">
                    {visibleSessions.map((session) => (
                      <PlaySessionCard key={session.id} session={session} />
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
        </div>
      </main>

      <Footer />
    </div>
  );
}

