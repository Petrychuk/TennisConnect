import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { FilterChip, FilterIcon } from "@/components/shared/filters";
import { Footer } from "@/components/footer";
import { ClubCard } from "@/components/clubs/ClubCard";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Search, Phone, Globe, DollarSign, Trophy, ArrowRight, Building2, Star, CheckCircle, Users, GraduationCap, Trees, Handshake, X } from "lucide-react";
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
import { HeroBadge } from "@/components/shared/hero-badge";
import { HeroSearch, HeroSearchFiltersButton, HeroShortcuts, type HeroShortcut } from "@/components/shared/hero-search";
import { HeroFiltersPanel, FilterSection } from "@/components/shared/hero-filters";

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

  // Full count across every advanced criterion - the badge on the Filters
  // button in the search bar (all 5 filters live in that one panel).
  const activeAdvancedFiltersCount =
    (filterSurface !== "all" ? 1 : 0) +
    (filterPriceRange !== "all" ? 1 : 0) +
    (filterLocation !== "all" ? 1 : 0) +
    (filterServices.length > 0 ? 1 : 0) +
    (filterCategory !== "all" ? 1 : 0);


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

  // Hero search (presentational - same state and filtering as before).
  // Filtering is live as you type; the lime button takes you to the results.
  const scrollToResults = () =>
    document.getElementById("clubs-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Shortcuts = the existing Organisation Type filter, one tap per type.
  const CATEGORY_SHORT_LABELS: Record<string, string> = {
    club: "Clubs",
    community: "Communities",
    academy: "Academies",
    "public-courts": "Public Courts",
    "tennis-centre": "Centres",
    "social-group": "Social Groups",
  };
  const shortcutItems = (suffix = ""): HeroShortcut[] =>
    CLUB_CATEGORIES.map((cat) => {
      const { label, icon: Icon } = getCategoryDisplay(cat.value);
      return {
        key: cat.value,
        label: CATEGORY_SHORT_LABELS[cat.value] ?? label,
        icon: <Icon />,
        selected: filterCategory === cat.value,
        onClick: () => setFilterCategory(filterCategory === cat.value ? "all" : cat.value),
        testId: `clubs-shortcut-${cat.value}${suffix}`,
      };
    });
  // One Filters panel for every screen size (it was split between toolbar
  // dropdowns and a popover on desktop). Test ids keep their old names:
  // desktop without a suffix, phones with "-mobile".
  const renderFiltersPanel = (variant: "desktop" | "mobile") => {
    const sfx = variant === "mobile" ? "-mobile" : "";
    const open = variant === "mobile" ? servicePopoverOpen : moreFiltersOpen;
    const setOpen = variant === "mobile" ? setServicePopoverOpen : setMoreFiltersOpen;
    return (
      <HeroFiltersPanel
        variant={variant}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <HeroSearchFiltersButton
            label="Filter clubs"
            activeCount={activeAdvancedFiltersCount}
            data-testid={variant === "mobile" ? "clubs-service-filter-trigger" : "clubs-more-filters-trigger"}
          />
        }
        onClear={clearAllFilters}
        canClear={hasAnyActiveFilter}
        contentTestId={`clubs-filters-panel${sfx}`}
        clearTestId={`clubs-clear-all-filters${sfx}`}
        applyTestId={`clubs-filters-show-results${sfx}`}
      >
          <FilterSection label="Organisation Type">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger aria-label="Filter by club type" data-testid={`clubs-category-filter${sfx}`}>
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
          </FilterSection>

          <FilterSection label="Court Surface">
            <Select value={filterSurface} onValueChange={setFilterSurface}>
              <SelectTrigger aria-label="Filter by court surface" data-testid={`clubs-surface-filter${sfx}`}>
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
          </FilterSection>

          <FilterSection label="Price (per hour)">
            <Select value={filterPriceRange} onValueChange={setFilterPriceRange}>
              <SelectTrigger aria-label="Filter by price" data-testid={`clubs-price-filter${sfx}`}>
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
          </FilterSection>

          <FilterSection label="Location">
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger aria-label="Filter by location" data-testid={`clubs-location-filter${sfx}`}>
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
          </FilterSection>

          <FilterSection label="Services">
            <div
              className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1 border border-border/50 rounded-lg p-2"
              onWheel={(e) => e.stopPropagation()}
              data-testid={`clubs-services-scroll-area${sfx}`}
            >
              {CLUB_SERVICES.map((service) => (
                <FilterChip
                  key={service.value}
                  compact
                  selected={filterServices.includes(service.value)}
                  onClick={() => toggleFilterService(service.value)}
                  data-testid={`clubs-service-option${sfx}-${service.value}`}
                >
                  {service.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>
      </HeroFiltersPanel>
    );
  };

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

  const hasAnyActiveFilter = searchTerm.trim() !== "" || hasActiveFacets;

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

        <main id="main-content">
        {/* Intro / Hero Section — shares one photo backdrop with the
            filter bar below, same treatment as Partners/Coaches */}
        <div className="relative overflow-hidden">
          <picture>
            <source media="(max-width: 639px)" srcSet="/assets/images/Dashboard_club-mobile.webp" />
            <img
              src="/assets/images/Dashboard_club.webp"
              alt="Tennis club"
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover z-0 scale-125 md:scale-100"
            />
          </picture>
          {/* Tablet/desktop: the left half of the photo darkens towards the left edge (smooth, no hard line) so the title, intro and search stay readable. Phones keep the plain photo. */}
          <div aria-hidden="true" className="tc-hero-left-shade absolute inset-0 hidden md:block z-10" />
          <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />

          <div className="relative min-h-[28vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center md:items-start justify-start">
          {/* Badge (mobile) — overlaps the bottom edge of the hero photo */}
          <div className="md:hidden absolute bottom-3 left-4 z-20">
            <HeroBadge size="sm">Places To Play</HeroBadge>
          </div>
          <div className="relative z-20 container mx-auto px-4 text-left mt-16 md:mt-0 md:pt-[104px]">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="hidden md:block"
            >
              <HeroBadge className="mb-3 md:mb-6">Places To Play</HeroBadge>
                  <h1 className="text-4xl
                    sm:text-5xl
                    md:text-6xl
                    xl:text-7xl
                    font-display
                    font-bold
                    tracking-tight
                    text-white
                    tc-hero-text">
                  Find Tennis <span className="text-primary relative inline-block">
                  Communities
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                  </svg>
                </span>
              </h1>
              <p className="text-lg md:text-[20px] md:leading-[1.3] text-white max-w-2xl font-medium leading-tight tc-hero-intro">
                 Discover tennis courts, clubs, social groups, and local communities across Australia.
              </p>
              <HeroSearch
                className="mt-6 max-w-3xl"
                value={searchTerm}
                onValueChange={setSearchTerm}
                onSubmit={scrollToResults}
                placeholder="Search by name, court, surface, location..."
                inputTestId="clubs-search-input"
                submitTestId="clubs-search-submit"
                filters={renderFiltersPanel("desktop")}
              />
              <HeroShortcuts label="Organisation type" items={shortcutItems()} className="mt-6" />
            </motion.div>
          </div>
          </div>

        <div className="pb-1.5 md:pb-16" />
        </div>

        {/* Hero text (mobile) — sits below the hero photo instead of
            overlapping it */}
        <div className="md:hidden relative z-20 bg-background pt-2 pb-1">
          <div className="container mx-auto px-4 text-left">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Find Tennis <span className="text-primary-text relative inline-block">
                Communities
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary-text opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl font-medium leading-tight mt-1">
              Discover tennis courts, clubs, social groups, and local communities across Australia.
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
              placeholder="Search name, court, surface, location..."
              inputTestId="clubs-search-input-mobile"
              submitTestId="clubs-search-submit-mobile"
              filters={renderFiltersPanel("mobile")}
            />
            <HeroShortcuts label="Organisation type" tone="light" items={shortcutItems("-mobile")} className="mt-3" />
          </div>
        </div>

        {/* Clubs List Section — pulled up so the photo dissolves under
            the top of the first row */}
        <div id="clubs-results" className="relative z-30 container mx-auto px-4 pt-4 pb-16 md:py-16 md:-mt-4 scroll-mt-24">

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
                <FilterIcon className="text-primary-text" />
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
        </main>
        <Footer />
      </div>
   </>
  );
}