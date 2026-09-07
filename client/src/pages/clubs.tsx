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
import { MapPin, Search, Filter, SlidersHorizontal, Phone, Globe, DollarSign, Trophy, ArrowRight, Building2, Star, CheckCircle, Users, GraduationCap, Trees, Handshake } from "lucide-react";
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
import { COURT_SURFACES, CLUB_SERVICES, CLUB_CATEGORIES } from "@shared/constants/clubs";
import { getServiceLabel, getSurfaceLabel, formatLocation } from "@/lib/clubVariant";

// Organisation Type options come from CLUB_CATEGORIES (shared with the
// admin form), but its labels carry emoji prefixes meant for the admin
// UI. For this page we pair each value with a proper lucide icon instead,
// matching the app's icon style - CLUB_CATEGORIES itself is left
// untouched since other screens (e.g. the club admin form) still use its
// emoji labels as-is.
const CATEGORY_DISPLAY: Record<string, { label: string; icon: typeof Trophy }> = {
  club: { label: "Tennis Club", icon: Trophy },
  community: { label: "Tennis Community", icon: Users },
  academy: { label: "Tennis Academy", icon: GraduationCap },
  "public-courts": { label: "Public Courts", icon: Trees },
  "tennis-centre": { label: "Tennis Centre", icon: Building2 },
  "social-group": { label: "Social Group", icon: Handshake },
};

function getCategoryDisplay(value: string) {
  if (CATEGORY_DISPLAY[value]) return CATEGORY_DISPLAY[value];
  // Fallback for any category value not in the map above (keeps this
  // page working even if CLUB_CATEGORIES gains a new entry later).
  const label = value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { label, icon: Trophy };
}

// Price buckets for the price filter, based on hourly court/session price.
const PRICE_RANGE_OPTIONS = [
  { value: "all", label: "Any price" },
  { value: "under-20", label: "Under $20/hr" },
  { value: "20-35", label: "$20 – $35/hr" },
  { value: "35-plus", label: "$35+/hr" },
];

// Builds one lowercase blob a club can be searched by in the free-text
// search box: name, location (both the legacy `location` string and real
// suburb/state/address), services and court surfaces - resolving slugs
// (e.g. "hard", "pro-shop") to their human labels ("Hard Court",
// "Pro Shop") as well, so typing a surface, a service or a suburb all
// work. Free-text prose (description/pricingNotes) is deliberately left
// out here - it's what caused "hard court" to also surface grass-only
// clubs whose description merely mentioned a hard court in passing; see
// getClubFacetText, which the structured filters use for the same reason.
function getClubSearchText(club: any): string {
  const parts: (string | undefined | null)[] = [
    club?.name,
    club?.location,
    club?.suburb,
    club?.state,
    club?.address,
    ...(Array.isArray(club?.services)
      ? club.services.flatMap((s: string) => [s, getServiceLabel(s)])
      : []),
    ...(Array.isArray(club?.courtSurfaces)
      ? club.courtSurfaces.flatMap((s: string) => [s, getSurfaceLabel(s)])
      : []),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

// Narrower blob used by the structured filters (surface/service chips and
// the Surface/Services dropdowns) - built ONLY from a club's actual
// services + court surfaces + lighting flag, never from name/description/
// location. This is what keeps a filter like "Hard Courts" from matching
// a club just because "hard" happens to appear somewhere in its prose.
function getClubFacetText(club: any): string {
  const parts: (string | undefined | null)[] = [
    ...(Array.isArray(club?.services)
      ? club.services.flatMap((s: string) => [s, getServiceLabel(s)])
      : []),
    ...(Array.isArray(club?.courtSurfaces)
      ? club.courtSurfaces.flatMap((s: string) => [s, getSurfaceLabel(s)])
      : []),
    club?.hasLighting ? "night lighting" : undefined,
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

// A club "has" a service if it's an exact hit on the real data's slug
// array, or a case-insensitive match against the dummy fallback data's
// display-label array - checked against facet text only (see
// getClubFacetText), never against free-text description.
function clubHasServiceValue(club: any, value: string, facetText: string): boolean {
  const target = value.toLowerCase();
  const label = getServiceLabel(value).toLowerCase();
  return facetText.includes(target) || facetText.includes(label);
}

export default function ClubsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSurface, setFilterSurface] = useState("all");
  const [filterPriceRange, setFilterPriceRange] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterServices, setFilterServices] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [servicePopoverOpen, setServicePopoverOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [clubs, setClubs] = useState<typeof CLUBS_DATA>([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  function toggleFilterService(value: string) {
    setFilterServices((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  // Full count across every advanced criterion - used by the mobile
  // "Filters" trigger badge, since on mobile all 5 filters live in one
  // popover (kept together there, there's just no room to split them out).
  const activeAdvancedFiltersCount =
    (filterSurface !== "all" ? 1 : 0) +
    (filterPriceRange !== "all" ? 1 : 0) +
    (filterLocation !== "all" ? 1 : 0) +
    (filterServices.length > 0 ? 1 : 0) +
    (filterCategory !== "all" ? 1 : 0);

  // Desktop count only covers what's actually still inside the "Filters"
  // popover there (Price + Services) - Organisation Type, Surface and
  // Location moved out to their own visible dropdowns in the toolbar, so
  // counting them here too would double up with those dropdowns' own
  // active-state styling.
  const desktopPopoverFiltersCount =
    (filterPriceRange !== "all" ? 1 : 0) + (filterServices.length > 0 ? 1 : 0);

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
    setFilterSurface("all");
    setFilterPriceRange("all");
    setFilterLocation("all");
    setFilterServices([]);
    setFilterCategory("all");
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
  //
  // Free-text search is always required when present (it's a deliberate
  // query, not a facet toggle). The structured facet filters (Organisation
  // Type, Court Surface, Location, Price, Services) are evaluated per
  // club, then combined in two passes:
  //   1. Strict AND across every active facet - the precise, narrow
  //      result set (e.g. "Hard Court" + "Lane Cove, NSW" together should
  //      behave as a direct combined match).
  //   2. If that strict pass comes back empty but at least one facet is
  //      active, fall back to OR across the active facets - clubs
  //      matching at least one selected facet - so combining several
  //      filters on a small dataset never dead-ends on zero results. A
  //      banner in the UI makes it clear when this relaxed match kicked
  //      in, so it never looks like a silent/wrong match.
  const searchTerm_ = searchTerm.trim().toLowerCase();

  const evaluatedClubs = clubs.map((club: any) => {
    const searchText = getClubSearchText(club);
    const facetText = getClubFacetText(club);

    const matchesSearch = searchTerm_ ? searchText.includes(searchTerm_) : true;

    const facetChecks: boolean[] = [];

    if (filterSurface !== "all") {
      facetChecks.push(
        facetText.includes(filterSurface.toLowerCase()) ||
          facetText.includes(getSurfaceLabel(filterSurface).toLowerCase())
      );
    }
    if (filterLocation !== "all") {
      facetChecks.push(getClubLocationLabel(club) === filterLocation);
    }
    if (filterCategory !== "all") {
      facetChecks.push(club?.category === filterCategory);
    }
    if (filterPriceRange !== "all") {
      facetChecks.push(matchesPriceRange(club, filterPriceRange));
    }
    if (filterServices.length > 0) {
      // Within the Services facet itself, a club still needs ALL picked
      // services - only the combination ACROSS different facet types
      // (surface vs location vs category vs price vs services) gets the
      // OR fallback above.
      facetChecks.push(filterServices.every((v) => clubHasServiceValue(club, v, facetText)));
    }

    return {
      club,
      matchesSearch,
      matchesAllFacets: facetChecks.every(Boolean),
      matchesAnyFacet: facetChecks.length === 0 || facetChecks.some(Boolean),
    };
  });

  const hasActiveFacets =
    filterSurface !== "all" ||
    filterLocation !== "all" ||
    filterCategory !== "all" ||
    filterPriceRange !== "all" ||
    filterServices.length > 0;

  const strictMatches = evaluatedClubs.filter((e) => e.matchesSearch && e.matchesAllFacets);
  const usedRelaxedMatch = hasActiveFacets && strictMatches.length === 0;
  const filteredClubs = (
    usedRelaxedMatch
      ? evaluatedClubs.filter((e) => e.matchesSearch && e.matchesAnyFacet)
      : strictMatches
  ).map((e) => e.club);

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
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center justify-between flex-wrap">
              <div className="relative w-full lg:w-72 xl:w-80 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <Input 
                  placeholder="Search by name, court, surface, location..." 
                  className="pl-10 h-11 bg-background/80 border-transparent focus:border-primary focus:bg-background transition-all rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Organisation Type / Court Surface / Location are the
                  filters people reach for most, so they're plain visible
                  dropdowns right in the toolbar instead of hidden inside
                  "Filters" - each highlights itself when set. Price and
                  Services stay inside the "Filters" popover below since
                  they don't need to be one-click visible and Services in
                  particular needs more room than the toolbar has. */}
              <div className="flex flex-wrap items-center gap-2 flex-1 lg:flex-none">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger
                    className={`h-11 w-[10.5rem] rounded-xl ${filterCategory !== "all" ? "bg-primary/15 border-primary text-primary font-medium" : "bg-background/80"}`}
                    data-testid="clubs-category-filter"
                  >
                    <SelectValue placeholder="Any type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any type</SelectItem>
                    {CLUB_CATEGORIES.map((cat) => {
                      const { label, icon: Icon } = getCategoryDisplay(cat.value);
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select value={filterSurface} onValueChange={setFilterSurface}>
                  <SelectTrigger
                    className={`h-11 w-[9.5rem] rounded-xl ${filterSurface !== "all" ? "bg-primary/15 border-primary text-primary font-medium" : "bg-background/80"}`}
                    data-testid="clubs-surface-filter"
                  >
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

                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger
                    className={`h-11 w-[10.5rem] rounded-xl ${filterLocation !== "all" ? "bg-primary/15 border-primary text-primary font-medium" : "bg-background/80"}`}
                    data-testid="clubs-location-filter"
                  >
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

                <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={`shrink-0 h-11 px-4 flex items-center gap-2 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                        desktopPopoverFiltersCount > 0
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background/80 border-input hover:border-primary/50"
                      }`}
                      data-testid="clubs-more-filters-trigger"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Filters
                      {desktopPopoverFiltersCount > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs">
                          {desktopPopoverFiltersCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  {/* Only Price + Services live here now - Organisation
                      Type/Surface/Location moved to their own toolbar
                      dropdowns above, so this panel stays short without
                      needing the two-column layout it used to. `sticky` +
                      a collision boundary keep it anchored to the trigger
                      (rather than jumping/hiding) as the page scrolls. */}
                  <PopoverContent
                    align="end"
                    sticky="always"
                    collisionPadding={16}
                    className="w-80 p-4 space-y-4 max-h-[80vh] overflow-y-auto"
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Price (per hour)
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
                        Services
                      </Label>
                      <div
                        className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1 border border-border/50 rounded-lg p-2"
                        onWheel={(e) => e.stopPropagation()}
                        data-testid="clubs-services-scroll-area"
                      >
                        {CLUB_SERVICES.map((service) => (
                          <button
                            key={service.value}
                            type="button"
                            onClick={() => toggleFilterService(service.value)}
                            data-testid={`clubs-service-option-${service.value}`}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shrink-0 ${
                              filterServices.includes(service.value)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background/80 hover:bg-secondary border-input hover:border-primary/50"
                            }`}
                          >
                            {service.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {desktopPopoverFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setFilterPriceRange("all");
                          setFilterServices([]);
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
                      activeAdvancedFiltersCount > 0
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
                <PopoverContent
                  align="end"
                  sticky="always"
                  collisionPadding={16}
                  className="w-72 p-3 space-y-3 max-h-[75vh] overflow-y-auto"
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Organisation Type
                      </Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger
                          className={filterCategory !== "all" ? "bg-primary/15 border-primary text-primary font-medium" : undefined}
                          data-testid="clubs-category-filter-mobile"
                        >
                          <SelectValue placeholder="Any type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any type</SelectItem>
                          {CLUB_CATEGORIES.map((cat) => {
                            const { label, icon: Icon } = getCategoryDisplay(cat.value);
                            return (
                              <SelectItem key={cat.value} value={cat.value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="w-4 h-4" />
                                  {label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

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
                        Price (per hour)
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

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Services
                      </Label>
                      <div
                        className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 border border-border/50 rounded-lg p-2"
                        onWheel={(e) => e.stopPropagation()}
                        data-testid="clubs-services-scroll-area-mobile"
                      >
                        {CLUB_SERVICES.map((service) => (
                          <button
                            key={service.value}
                            type="button"
                            onClick={() => toggleFilterService(service.value)}
                            data-testid={`clubs-service-option-mobile-${service.value}`}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shrink-0 ${
                              filterServices.includes(service.value)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background/80 hover:bg-secondary border-input hover:border-primary/50"
                            }`}
                          >
                            {service.label}
                          </button>
                        ))}
                      </div>
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
            {usedRelaxedMatch && (
              <div
                className="mb-6 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 text-sm text-foreground flex items-center gap-2"
                data-testid="clubs-relaxed-match-notice"
              >
                <SlidersHorizontal className="w-4 h-4 text-primary shrink-0" />
                <span>
                  No clubs match every selected filter - showing clubs that match at least one of them instead.
                </span>
              </div>
            )}

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