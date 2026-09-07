import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Footer } from "@/components/footer";
import { ClubCard } from "@/components/clubs/ClubCard";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Search, Filter, SlidersHorizontal, Phone, Globe, DollarSign, Trophy, ArrowRight, Building2, Star, CheckCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLUBS_DATA } from "@/lib/dummy-data";
import { motion } from "framer-motion";
import SEO from "@/components/seo";
import { PartnerCTA } from "@/components/partnerCTA";
import { COURT_SURFACES } from "@shared/constants/clubs";
import { getServiceLabel, getSurfaceLabel, formatLocation } from "@/lib/clubVariant";

// Quick filter chips shown above/near the search bar. Each tag is matched
// against a club's combined searchable text (see getClubSearchText) via
// keywords, so it works whether the underlying data stores service labels
// (dummy data, e.g. "Grass Courts") or slug values from CLUB_SERVICES /
// COURT_SURFACES (real API data, e.g. "grass", "coaching").
const SERVICE_FILTER_TAGS: { label: string; keywords: string[] }[] = [
  { label: "Grass Courts", keywords: ["grass"] },
  { label: "Hard Courts", keywords: ["hard court", "hard-court", "hardcourt", " hard "] },
  { label: "Coaching", keywords: ["coach"] },
  { label: "Pro Shop", keywords: ["pro-shop", "pro shop", "proshop"] },
  { label: "Night Tennis", keywords: ["light", "night"] },
];

// Price buckets for the price filter, based on hourly court/session price.
const PRICE_RANGE_OPTIONS = [
  { value: "all", label: "Any price" },
  { value: "under-20", label: "Under $20/hr" },
  { value: "20-35", label: "$20 – $35/hr" },
  { value: "35-plus", label: "$35+/hr" },
];

// Builds one lowercase blob of everything a club could reasonably be
// searched/filtered by, so a single .includes() check covers name,
// location (both the legacy `location` string and real suburb/state),
// services and court surfaces/courts info - resolving slugs (e.g. "hard",
// "pro-shop") to their human labels ("Hard Court", "Pro Shop") as well,
// so search and filters work regardless of which data shape a club uses.
function getClubSearchText(club: any): string {
  const parts: (string | undefined | null)[] = [
    club?.name,
    club?.location,
    club?.suburb,
    club?.state,
    club?.address,
    club?.shortDescription,
    club?.description,
    club?.pricingNotes,
    ...(Array.isArray(club?.services)
      ? club.services.flatMap((s: string) => [s, getServiceLabel(s)])
      : []),
    ...(Array.isArray(club?.courtSurfaces)
      ? club.courtSurfaces.flatMap((s: string) => [s, getSurfaceLabel(s)])
      : []),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function getClubPrice(club: any): number | null {
  const raw = club?.hourlyPrice ?? club?.price;
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
}

function matchesPriceRange(club: any, range: string): boolean {
  if (!range || range === "all") return true;
  const price = getClubPrice(club);
  if (price === null) return false;
  if (range === "under-20") return price < 20;
  if (range === "20-35") return price >= 20 && price <= 35;
  if (range === "35-plus") return price > 35;
  return true;
}

function getClubLocationLabel(club: any): string {
  return formatLocation(club) || club?.location || "";
}

export default function ClubsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterSurface, setFilterSurface] = useState("all");
  const [filterPriceRange, setFilterPriceRange] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [clubs, setClubs] = useState<typeof CLUBS_DATA>([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  const activeAdvancedFiltersCount =
    (filterSurface !== "all" ? 1 : 0) +
    (filterPriceRange !== "all" ? 1 : 0) +
    (filterLocation !== "all" ? 1 : 0);

  // Locations are derived from whatever clubs actually loaded (real API
  // data or the dummy fallback), so the dropdown never shows an option
  // with zero results.
  const locationOptions = Array.from(
    new Set(
      clubs
        .map((club: any) => getClubLocationLabel(club))
        .filter((loc): loc is string => Boolean(loc))
    )
  ).sort((a, b) => a.localeCompare(b));

  function clearAllFilters() {
    setSearchTerm("");
    setFilterService("");
    setFilterSurface("all");
    setFilterPriceRange("all");
    setFilterLocation("all");
  }

  useEffect(() => {
    async function fetchClubs() {
      try {
        const res = await fetch("/api/clubs");
        
        if (res.ok) {
          const data = await res.json();
          // Use API data if available
          if (data.length > 0) {
            setClubs(data);
          } else {
            // Fallback to dummy data if no clubs in database
            setClubs(CLUBS_DATA);
          }
        } else {
          setClubs(CLUBS_DATA);
        }
      } catch (error) {
        console.error("Failed to fetch clubs:", error);
        setClubs(CLUBS_DATA);
      } finally {
        setLoading(false);
      }
    }
    
    fetchClubs();
  }, []);

  // Filter Logic
  const filteredClubs = clubs.filter((club: any) => {
    const searchText = getClubSearchText(club);
    const term = searchTerm.trim().toLowerCase();

    // Searches name, location (suburb/state or legacy location), services
    // and court surfaces together - so searching "grass", "hard court",
    // a suburb, or a service all work, not just the club name.
    const matchesSearch = term ? searchText.includes(term) : true;

    const activeTag = SERVICE_FILTER_TAGS.find((t) => t.label === filterService);
    const matchesService = activeTag
      ? activeTag.keywords.some((k) => searchText.includes(k))
      : true;

    const matchesSurface =
      filterSurface === "all"
        ? true
        : searchText.includes(filterSurface.toLowerCase()) ||
          searchText.includes(getSurfaceLabel(filterSurface).toLowerCase());

    const matchesPrice = matchesPriceRange(club, filterPriceRange);

    const matchesLocation =
      filterLocation === "all" ? true : getClubLocationLabel(club) === filterLocation;

    return matchesSearch && matchesService && matchesSurface && matchesPrice && matchesLocation;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredClubs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentClubs = filteredClubs.slice(startIndex, startIndex + itemsPerPage);

  return (
   <>
      <SEO
      title="Tennis Clubs in Australia | TennisConnect"
      description="Discover tennis clubs across Australia. Find courts, social competitions, memberships and local tennis communities."
      canonical="/clubs"
      tags={[
        "tennis clubs",
        "tennis courts",
        "tennis membership",
        "Sydney tennis club",
        "Melbourne tennis club",
        "Australia tennis clubs",
      ]}
    />
      <div className="min-h-screen bg-background font-sans">
        <Navbar />
        
        {/* Intro / Hero Section — shares one photo backdrop with the
            filter bar below, same treatment as Partners/Coaches */}
        <div className="relative overflow-hidden">
          <img
            src="/assets/images/Dashboard_club.webp"
            alt="Tennis club"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover z-0 scale-125 md:scale-100"
          />
          <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />

          <div className="relative min-h-[28vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center justify-start">
          {/* Badge (mobile) — overlaps the bottom edge of the hero photo */}
          <div className="md:hidden absolute bottom-3 left-4 z-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-[10px] font-bold tracking-wider uppercase text-white">
                Places To Play
              </span>
            </div>
          </div>
          <div className="relative z-20 container mx-auto px-4 text-left mt-16 md:mt-20">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="hidden md:block"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md mb-3 md:mb-6">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wider uppercase text-white">
                  Places To Play
                </span>
              </div>
                  <h1 className="text-4xl
                    sm:text-5xl
                    md:text-6xl
                    xl:text-7xl
                    font-display
                    font-bold
                    tracking-tight
                    text-white
                    drop-shadow-md">
                  Find Tennis <span className="text-primary relative inline-block">
                  Communities
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                  </svg>
                </span>
              </h1>
              <p className="text-lg md:text-xl text-white/85 max-w-2xl font-medium leading-tight md:leading-[1.3] drop-shadow-sm">
                 Discover tennis courts, clubs, social groups, and local communities across Australia.
              </p>
            </motion.div>
          </div>
          </div>

        {/* Filter Bar (desktop) — floats over the tail of the photo */}
        <div className="hidden md:block relative z-20 mt-5 pb-5 md:pb-10">
          <div className="container mx-auto px-2 md:px-4">
            <div className="bg-card/50 backdrop-blur-lg border border-border/40 shadow-lg rounded-2xl p-3 md:p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80 lg:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <Input 
                  placeholder="Search by name, court, surface, location..." 
                  className="pl-10 h-11 bg-background/80 border-transparent focus:border-primary focus:bg-background transition-all rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex
                    gap-2
                    overflow-x-auto
                    scrollbar-hide
                    w-full
                    md:w-auto
                    pb-1">
                  {SERVICE_FILTER_TAGS.map(({ label: tag }) => (
                    <button
                      key={tag}
                      onClick={() => setFilterService(filterService === tag ? "" : tag)}
                      className={`px-4 md:px-4
                          py-2
                          rounded-full
                          text-sm
                          font-medium
                          whitespace-nowrap
                          transition-all
                          border
                          cursor-pointer
                          shrink-0 ${
                            filterService === tag 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-background/80 hover:bg-secondary border-input hover:border-primary/50"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={`shrink-0 h-11 px-4 flex items-center gap-2 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                        activeAdvancedFiltersCount > 0
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background/80 border-input hover:border-primary/50"
                      }`}
                      data-testid="clubs-more-filters-trigger"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Filters
                      {activeAdvancedFiltersCount > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs">
                          {activeAdvancedFiltersCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Court Surface
                      </Label>
                      <Select value={filterSurface} onValueChange={setFilterSurface}>
                        <SelectTrigger data-testid="clubs-surface-filter">
                          <SelectValue placeholder="Any surface" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any surface</SelectItem>
                          {COURT_SURFACES.map((surface) => (
                            <SelectItem key={surface.value} value={surface.value}>
                              {surface.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Price
                      </Label>
                      <Select value={filterPriceRange} onValueChange={setFilterPriceRange}>
                        <SelectTrigger data-testid="clubs-price-filter">
                          <SelectValue placeholder="Any price" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRICE_RANGE_OPTIONS.map((range) => (
                            <SelectItem key={range.value} value={range.value}>
                              {range.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Location
                      </Label>
                      <Select value={filterLocation} onValueChange={setFilterLocation}>
                        <SelectTrigger data-testid="clubs-location-filter">
                          <SelectValue placeholder="Any location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any location</SelectItem>
                          {locationOptions.map((loc) => (
                            <SelectItem key={loc} value={loc}>
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {activeAdvancedFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setFilterSurface("all");
                          setFilterPriceRange("all");
                          setFilterLocation("all");
                        }}
                      >
                        Reset these filters
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            </div>
          </div>
        </div>
        </div>

        {/* Hero text (mobile) — sits below the hero photo instead of
            overlapping it */}
        <div className="md:hidden relative z-20 bg-background pt-4 pb-1">
          <div className="container mx-auto px-4 text-left">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Find Tennis <span className="text-primary relative inline-block">
                Communities
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl font-medium leading-tight mt-2">
              Discover tennis courts, clubs, social groups, and local communities across Australia.
            </p>
          </div>
        </div>

        {/* Filter Bar (mobile) — sits below the hero photo instead of
            floating over it */}
        <div className="md:hidden relative z-20 bg-background pt-4 pb-2">
          <div className="container mx-auto px-4">
            <div className="flex gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, court, surface, location..."
                  className="pl-10 h-11 bg-secondary/50 border-transparent focus:border-primary rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Popover open={servicePopoverOpen} onOpenChange={setServicePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={`shrink-0 h-11 w-11 flex items-center justify-center rounded-xl border cursor-pointer transition-all relative ${
                      filterService || activeAdvancedFiltersCount > 0
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/50 border-input"
                    }`}
                    aria-label="Filter clubs"
                    data-testid="clubs-service-filter-trigger"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeAdvancedFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center border border-background">
                        {activeAdvancedFiltersCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3 space-y-3">
                  <div className="flex flex-col gap-1">
                    {SERVICE_FILTER_TAGS.map(({ label: tag }) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setFilterService(filterService === tag ? "" : tag);
                          setServicePopoverOpen(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-all cursor-pointer ${
                          filterService === tag
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary"
                        }`}
                        data-testid={`clubs-service-mobile-${tag}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border/50 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Court Surface
                      </Label>
                      <Select value={filterSurface} onValueChange={setFilterSurface}>
                        <SelectTrigger data-testid="clubs-surface-filter-mobile">
                          <SelectValue placeholder="Any surface" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any surface</SelectItem>
                          {COURT_SURFACES.map((surface) => (
                            <SelectItem key={surface.value} value={surface.value}>
                              {surface.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Price
                      </Label>
                      <Select value={filterPriceRange} onValueChange={setFilterPriceRange}>
                        <SelectTrigger data-testid="clubs-price-filter-mobile">
                          <SelectValue placeholder="Any price" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRICE_RANGE_OPTIONS.map((range) => (
                            <SelectItem key={range.value} value={range.value}>
                              {range.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Location
                      </Label>
                      <Select value={filterLocation} onValueChange={setFilterLocation}>
                        <SelectTrigger data-testid="clubs-location-filter-mobile">
                          <SelectValue placeholder="Any location" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any location</SelectItem>
                          {locationOptions.map((loc) => (
                            <SelectItem key={loc} value={loc}>
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Clubs List Section — pulled up so the photo dissolves under
            the top of the first row */}
        <div className="relative z-30 container mx-auto px-4 pt-4 pb-16 md:py-16 md:-mt-4">

        {filteredClubs.length === 0 ? (

          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="inline-flex p-5 rounded-full bg-muted mb-5">
              <Search className="w-9 h-9 text-muted-foreground" />
            </div>

            <h3 className="text-2xl font-bold mb-2">
              No clubs found
            </h3>

            <p className="text-muted-foreground max-w-md">
              Try adjusting your search or filters.
            </p>

            <Button
              variant="link"
              onClick={clearAllFilters}
              className="mt-4"
            >
              Clear all filters
            </Button>
          </div>

        ) : (

          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-3 xl:gap-8">
              {currentClubs.map((club) => (
                <ClubCard
                key={club.id}
                club={club}
             />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-16">
                {/* Pagination */}
              </div>
            )}
          </>

        )}
        <PartnerCTA />
        </div>
        <Footer />
      </div>
   </>
  );
}