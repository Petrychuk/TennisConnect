import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import SEO from "@/components/seo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { AppPagination } from "@/components/shared/AppPagination";
import { MapPin, Star, ArrowRight, DollarSign, Calendar, Trophy, Wallet, Coins } from "lucide-react";
import heroImage from "/assets/images/dashboard_coach.webp";

import { COACHES_DATA } from "@/lib/dummy-data";
import { resolveAvatarUrl, DEFAULT_AVATAR_URL, DEFAULT_AVATAR_ALT } from "@/lib/defaultAvatar";
import { HeroBadge } from "@/components/shared/hero-badge";
import { HeroSearch, HeroSearchFiltersButton, HeroShortcuts, type HeroShortcut } from "@/components/shared/hero-search";
import { HeroFiltersPanel, FilterSection } from "@/components/shared/hero-filters";

export default function CoachesPage() {
  const coachesSectionRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState("all");
  const [priceRange, setPriceRange] = useState([150]); // Max price
  const [minRating, setMinRating] = useState(0);
  const [coaches, setCoaches] = useState<
    (typeof COACHES_DATA[number] & { isOrganizer?: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 16,
    total: 0,
    totalPages: 0,
  });
  
  useEffect(() => {
    async function fetchCoaches() {
      try {
        setLoading(true);
  
        const res = await fetch(
          `/api/coaches?page=${page}&limit=16`
        );
  
        if (!res.ok) {
          throw new Error("Failed to fetch coaches");
        }
  
        const data = await res.json();
  
        // Pagination
        setPagination(data.pagination);
  
        // API -> UI
        const transformedCoaches = data.coaches.map((coach: any) => ({
          id: coach.id,
          slug: coach.slug,
  
          name: coach.name || coach.title || "Coach",
          title: coach.title || "Tennis Coach",
  
          location:
            coach.locations?.[0] ??
            coach.location ??
            "Sydney",
  
          rate: coach.rate
            ? Number(coach.rate)
            : 80,
  
          rating: coach.rating || "4.9",
  
          reviews: coach.reviews || 0,
  
          experience:
            coach.experience || "5 years",
  
          image: resolveAvatarUrl(coach.avatar),
  
          tags: coach.tags || [],
  
          schedule: coach.schedule || {},

          isOrganizer: Boolean(coach.isOrganizer),
        }));
  
        setCoaches(transformedCoaches);
      } catch (error) {
        console.error("Failed to fetch coaches:", error);
  
        setCoaches([]);
  
        setPagination({
          page: 1,
          limit: 16,
          total: 0,
          totalPages: 0,
        });
      } finally {
        setLoading(false);
      }
    }
  
    fetchCoaches();
  }, [page]);

  // Dynamically get all unique locations from coaches
  const uniqueLocations = useMemo(() => {
    const locations = coaches.map(coach => coach.location).filter(Boolean);
    return Array.from(new Set(locations)).sort();
  }, [coaches]);

  const filteredCoaches = coaches.filter(coach => {
    const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          coach.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter === "all" || coach.location === locationFilter;
    const matchesPrice = coach.rate <= priceRange[0];
    const matchesRating = coach.rating >= minRating;
    
    return matchesSearch && matchesLocation && matchesPrice && matchesRating;
  });

  const activeFiltersCount = (locationFilter !== "all" ? 1 : 0) + (priceRange[0] < 150 ? 1 : 0) + (minRating > 0 ? 1 : 0);

  // GA4 "search" - same debounced-on-settle approach as partners.tsx's
  // own player search, so this doesn't fire once per keystroke either.
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const timer = setTimeout(() => {
      (window as any).gtag?.("event", "search", {
        search_term: searchTerm.trim(),
        search_type: "coaches",
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Hero search (presentational - same state and filtering as before).
  // Filtering is live as you type; the lime button takes you to the results.
  const scrollToResults = () => coachesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Shortcuts only set values the Filters panel can already set. Rating
  // shortcuts and the rating filter are hidden until coaches have real
  // reviews (cards show "(0)" reviews today) - the minRating logic stays.
  const PRICE_SHORTCUTS = [50, 70, 100];
  const shortcutItems = (suffix = ""): HeroShortcut[] =>
    PRICE_SHORTCUTS.map((max, i) => ({
      key: `under-${max}`,
      label: `Under $${max}`,
      icon: [<Coins key="c" />, <Wallet key="w" />, <DollarSign key="d" />][i],
      selected: priceRange[0] === max,
      onClick: () => setPriceRange(priceRange[0] === max ? [150] : [max]),
      testId: `coaches-shortcut-under-${max}${suffix}`,
    }));
  // The Filters panel (dropdown on tablet/desktop, modal on phones):
  // location (was a select next to the search) and price.
  const renderFiltersPanel = (suffix: string) => (
    <HeroFiltersPanel
      variant={suffix ? "mobile" : "desktop"}
      open={filtersOpen}
      onOpenChange={setFiltersOpen}
      trigger={<HeroSearchFiltersButton activeCount={activeFiltersCount} data-testid={`coaches-filters-open${suffix}`} />}
      onClear={clearFilters}
      canClear={activeFiltersCount > 0}
      contentTestId="coaches-filters-panel"
      clearTestId={`coaches-clear-filters${suffix}`}
      applyTestId={`coaches-filters-show-results${suffix}`}
    >
      <FilterSection label="Location" icon={<MapPin />}>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger aria-label="Filter by location" className="w-full cursor-pointer" data-testid={`coaches-location-filter${suffix}`}>
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">All Sydney</SelectItem>
            {uniqueLocations.map((loc) => (
              <SelectItem key={loc} value={loc} className="cursor-pointer">{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection label="Price per hour" icon={<DollarSign />}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Up to</span>
          <span className="font-semibold">${priceRange[0]}/hr</span>
        </div>
        <Slider
          defaultValue={[150]}
          max={200}
          step={10}
          value={priceRange}
          onValueChange={setPriceRange}
          aria-label="Maximum price per hour"
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>$0</span>
          <span>$100</span>
          <span>$200+</span>
        </div>
      </FilterSection>
    </HeroFiltersPanel>
  );

  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("all");
    setPriceRange([150]);
    setMinRating(0);
  };

  const isFirstPageRender = useRef(true);
  useEffect(() => {
    if (!pagination) return;
    if (isFirstPageRender.current) {
      isFirstPageRender.current = false;
      return;
    }

    coachesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page]);

  return (
    <>
      <SEO
      title="Find Tennis Coaches in Australia | TennisConnect"
      description="Browse professional tennis coaches across Australia. Find private tennis lessons, group coaching sessions and certified tennis instructors near you."
      canonical="/coaches"
      tags={[
        "tennis coach",
        "tennis coaching",
        "tennis lessons",
        "private tennis coach",
        "Sydney tennis coach",
        "Melbourne tennis coach",
        "Australia tennis coaching",
      ]}
    />
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        
        <main>
          {/* Modern Hero Section — photo backdrop shared with the filter bar
              below, same treatment as the Partners page */}
          <section className="relative overflow-hidden">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
              <img 
                src={heroImage}
                alt="Tennis coach" 
                fetchPriority="high"
                decoding="async"
                className="w-full
                h-full
                object-cover
                object-[60%_55%]
                md:object-[60%_20%]
                scale-110 md:scale-100"
              />
              {/* Tablet/desktop: the left half of the photo darkens towards the left edge (smooth, no hard line) so the title, intro and search stay readable. Phones keep the plain photo. */}
              <div aria-hidden="true" className="tc-hero-left-shade absolute inset-0 hidden md:block" />
              <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100%" />
            </div>

            <div className="relative min-h-[28vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center md:items-start justify-start">
            {/* Badge (mobile) — overlaps the bottom edge of the hero photo */}
            <div className="md:hidden absolute bottom-3 left-4 z-20">
              <HeroBadge size="sm">Find Best Coach</HeroBadge>
            </div>
            <div className="container mx-auto px-4 relative z-10 md:pt-[104px]">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="hidden md:block max-w-3xl text-left"
              >
                <HeroBadge className="mb-3 md:mb-6">Find Best Coach</HeroBadge>
                <h1 className="text-3xl
                  sm:text-4xl
                  md:text-5xl
                  xl:text-6xl
                  font-display
                  font-bold
                  leading-[0.95]
                  mb-3
                  text-white
                  tc-hero-text">
                Level Up <span className="text-primary relative inline-block">Your Game<svg
                  className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 5 Q 50 10 100 5"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                  />
                </svg>
                </span>
                  </h1>
                <p className="
                    text-sm
                    sm:text-base
                    md:text-[20px]
                    text-white
                    leading-[1.2]
                    md:leading-[1.3]
                    max-w-xl
                    tc-hero-intro">
                  Connect with certified tennis coaches in Sydney to take your game to the next level, whether you're a beginner or a tournament player.
                </p>
                <HeroSearch
                  className="mt-6 max-w-3xl"
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  onSubmit={scrollToResults}
                  placeholder="Search by name or specialty..."
                  inputTestId="coaches-search-input"
                  submitTestId="coaches-search-submit"
                  filters={renderFiltersPanel("")}
                />
                <HeroShortcuts label="Quick filters" items={shortcutItems()} className="mt-6" />
              </motion.div>
            </div>
            </div>

          <div className="pb-1.5 md:pb-16" />
          </section>

          {/* Hero text (mobile) — sits below the hero photo instead of
              overlapping it */}
          <div className="md:hidden relative z-20 bg-background pt-2 pb-1">
            <div className="container mx-auto px-4 text-left">
              <h1 className="text-3xl font-display font-bold mb-1 leading-[0.95] tracking-tight text-foreground">
                Level Up <span className="text-primary-text relative inline-block">Your Game<svg
                  className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 5 Q 50 10 100 5"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                </svg>
                </span>
              </h1>
              <p className="text-sm text-gray-600 max-w-xl font-medium leading-snug">
                Connect with certified tennis coaches in Sydney to take your game to the next level, whether you're a beginner or a tournament player.
              </p>
            </div>
          </div>

          {/* Search (mobile) - below the hero text, like the other pages */}
          <div className="md:hidden relative z-20 bg-background pt-1 pb-2">
            <div className="container mx-auto px-4">
              <HeroSearch
                tone="light"
                value={searchTerm}
                onValueChange={setSearchTerm}
                onSubmit={scrollToResults}
                placeholder="Search by name or specialty..."
                inputTestId="coaches-search-input-mobile"
                submitTestId="coaches-search-submit-mobile"
                filters={renderFiltersPanel("-mobile")}
              />
              <HeroShortcuts label="Quick filters" tone="light" items={shortcutItems("-mobile")} className="mt-3" />
            </div>
          </div>

          {/* Coaches Grid — pulled up so the photo's fade dissolves under
              the top of the first row, matching the Partners page */}
          <section id="coaches-results" className="relative z-30 container mx-auto px-4 md:-mt-4 pb-24 scroll-mt-24"
            ref={coachesSectionRef}>
            {/* Visually hidden - same reasoning as partners.tsx's own
                "Search Results" heading: gives the card titles below a
                real H2 parent instead of skipping straight from the
                page's H1. */}
            <h2 className="sr-only">Search Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredCoaches.map((coach, index) => (
                <motion.div
                  key={coach.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card data-testid={`coach-card-${coach.id}`} className="h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 border-border/60 group cursor-pointer">
                    {/* Card Header with Image */}
                    <div className="relative h-36 md:h-52 lg:h-60 overflow-hidden">
                      <img 
                        src={coach.image} 
                        alt={
                          coach.image === DEFAULT_AVATAR_URL
                            ? DEFAULT_AVATAR_ALT
                            : coach.name
                        } 
                        loading="lazy"
                        className="w-full h-full object-cover object-[50%_35%] transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute
                          top-1
                          right-1
                          md:top-4
                          md:right-4
                          bg-background/90
                          backdrop-blur-sm
                          px-1
                          md:px-3
                          py-0.5
                          md:py-1
                          rounded-full
                          text-[10px]
                          md:text-xs
                          font-bold
                          flex
                          items-center
                          gap-1
                          shadow-sm">
                        <Star className="w-3 h-3 text-primary-text fill-primary" />
                        {coach.rating} ({coach.reviews})
                      </div>
                      {coach.isOrganizer && (
                        <div
                          className="absolute top-1 left-1 md:top-4 md:left-4 bg-[hsl(var(--tennis-ball))] text-black rounded-full p-1 md:p-1.5 shadow-sm"
                          title="Organiser"
                          data-testid={`organizer-badge-${coach.id}`}
                        >
                          <Trophy className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        </div>
                      )}
                    </div>

                    <CardHeader className="px-3 pt-3 pb-1 md:px-6 md:pb-2">
                      <div className="flex justify-between items-start">
                        <div className="min-h-14 md:min-h-[85px] min-w-0 w-full">
                          <h3 className="text-base md:text-lg lg:text-xl
                            font-bold
                            font-display
                            group-hover:text-primary-text
                            transition-colors

                            line-clamp-2
                            min-h-12
                            md:min-h-14">{coach.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">{coach.title}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="px-3 pb-3 space-y-1.5 md:space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                        <MapPin className="w-4 h-4 text-primary-text shrink-0" />
                        <span className="truncate">{coach.location}</span>
                      </div>

                      {coach.tags.length > 0 && (
                        <div className="hidden md:flex
                            flex-wrap
                            gap-2">
                          {coach.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="font-normal text-xs bg-muted/50">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex
                          items-center
                          justify-between
                          pt-2
                          md:pt-4
                          border-t
                          border-border/50">
                        <div className="flex flex-col">
                          <span className="text-[10px] md:text-xs text-muted-foreground">Hourly Rate</span>
                          <div className="flex items-center font-bold text-base md:text-lg">
                            <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-primary-text" />
                            {coach.rate}
                            <span className="text-xs md:text-sm font-normal text-muted-foreground ml-1">AUD</span>
                          </div>
                        </div>
                        
                        {/* Schedule Indicator */}
                        {coach.schedule && (
                          <div className="hidden md:flex flex-col items-end">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Today
                              </span>
                              <div className="text-sm font-medium">
                                {(() => {
                                  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                  const schedule = (coach.schedule as any)?.[today];
                                  if (schedule && schedule.active) {
                                    // Simple formatting
                                    const formatTime = (t: string) => {
                                      const [h, m] = t.split(':');
                                      const hour = parseInt(h);
                                      const ampm = hour >= 12 ? 'PM' : 'AM';
                                      const hour12 = hour % 12 || 12;
                                      return `${hour12}${ampm}`;
                                    };
                                    return `${formatTime(schedule.start)} - ${formatTime(schedule.end)}`;
                                  }
                                  return <span className="text-muted-foreground italic text-xs">Unavailable</span>;
                                })()}
                              </div>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="px-3 pb-3 pt-0 md:px-6 md:pb-6">
                      <Link href={`/coach/${coach.slug}`}>
                        <Button className="w-full h-9 md:h-10 text-xs md:text-sm group-hover:bg-primary group-hover:text-foreground transition-all">
                          View Profile <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>

            {filteredCoaches.length === 0 && (
              <div className="text-center py-20">
                <h3 className="text-2xl font-bold mb-2">No coaches found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filters to find more coaches.</p>
                <Button 
                  variant="link" 
                  onClick={clearFilters}
                  className="mt-4 text-primary-text"
                >
                  Clear all filters
                </Button>
              </div>
              
            )}
            {pagination && pagination.totalPages > 1 && (
              
              <AppPagination
                currentPage={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            )}
            </section>         
        </main>

        <Footer />
      </div>
    </>
  );
}
