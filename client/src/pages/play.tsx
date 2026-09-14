import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, MapPin, CalendarDays, X, Sparkles } from "lucide-react";
import { PlaySessionCard } from "@/components/play/session-card";
import { getPlaySessions } from "@/lib/api/play";
import { SESSION_TYPE_OPTIONS } from "@/lib/organiser-session-wizard-types";
import { PLAY_DATE_FILTER_OPTIONS, PLAY_LEVEL_OPTIONS, resolveDateFilterRange, type PlayDateFilter } from "@/lib/play-status";
import playHeroDesktop from "/assets/images/play-hero-desktop.webp";
import playHeroMobile from "/assets/images/play-hero-mobile.webp";

const ALL = "all";

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

  return (
    <div className="min-h-screen bg-background font-sans" data-testid="play-page">
      <SEO
        title="Find a Game | TennisConnect"
        description="Find tennis sessions, competitions and events near you - Social Tennis, Americano, Tournaments and more, all in one place."
      />
      <Navbar />

      <main id="main-content">
        <div className="relative h-56 sm:h-72 md:h-80 overflow-hidden bg-black">
          <picture>
            <source media="(min-width: 768px)" srcSet={playHeroDesktop} />
            <img
              src={playHeroMobile}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              fetchPriority="high"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="relative h-full container mx-auto px-4 flex flex-col justify-end pb-6 sm:pb-8">
            <p className="text-primary text-xs sm:text-sm font-bold tracking-widest uppercase mb-1">Play more tennis</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white" data-testid="play-page-title">
              Find a Game
            </h1>
            <p className="text-sm sm:text-base text-gray-200 mt-1 max-w-xl">
              Tennis sessions, competitions and events near you.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 space-y-5">
          {organizerId && (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5"
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by session, venue or organiser..."
              className="pl-10 h-11"
              data-testid="play-page-search-input"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="play-page-filters">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={location}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Location"
                className="pl-9"
                data-testid="play-page-filter-location"
              />
            </div>

            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as PlayDateFilter)}>
              <SelectTrigger data-testid="play-page-filter-date">
                <CalendarDays className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAY_DATE_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`play-page-filter-date-${opt.value}`}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger data-testid="play-page-filter-format"><SelectValue placeholder="All Formats" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} data-testid="play-page-filter-format-all">All Formats</SelectItem>
                {SESSION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key} data-testid={`play-page-filter-format-${opt.key}`}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger data-testid="play-page-filter-level"><SelectValue placeholder="All Levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} data-testid="play-page-filter-level-all">All Levels</SelectItem>
                {PLAY_LEVEL_OPTIONS.filter((l) => l !== "All Levels").map((lvl) => (
                  <SelectItem key={lvl} value={lvl} data-testid={`play-page-filter-level-${lvl}`}>{lvl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dateFilter === "custom" && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="max-w-xs"
              data-testid="play-page-filter-custom-date"
            />
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
              <p className="text-sm text-muted-foreground" data-testid="play-page-results-count">
                {sessions.length} session{sessions.length === 1 ? "" : "s"} found
              </p>
              <div className="space-y-4" data-testid="play-page-results">
                {sessions.map((session) => (
                  <PlaySessionCard key={session.id} session={session} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
