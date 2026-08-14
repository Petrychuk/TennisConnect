import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { AppPagination } from "@/components/shared/AppPagination";
import { Search, MapPin, Star, Filter, ArrowRight, DollarSign, X, Calendar, Trophy } from "lucide-react";
import heroImage from "/assets/images/dashboard_coach.webp";

import { COACHES_DATA } from "@/lib/dummy-data";

export default function CoachesPage() {
  const coachesSectionRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
  
          image:
            coach.avatar ??
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
  
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
                className="w-full
                h-full
                object-cover
                object-[60%_20%]"
              />
              <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100%" />
            </div>

            <div className="relative min-h-[24vh] md:min-h-[30vh] lg:min-h-[35vh] flex items-center justify-start">
            <div className="container mx-auto px-2 relative z-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="hidden md:block max-w-3xl
                  pt-30
                  md:pt-12
                  lg:pt-0
                  px-4
                  md:pl-8
                  lg:pl-0
                  text-left
                  md:translate-y-10
                  lg:translate-y-2
                  xl:translate-y-6
                  xl:pt-20"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md mb-3 md:mb-6">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wider uppercase text-white">
                    Find Best Coach
                  </span>
                </div>
                <h1 className="text-3xl
                  sm:text-4xl
                  md:text-5xl
                  lg:text-6xl
                  font-display
                  font-bold
                  leading-[0.95]
                  mb-3
                  text-white
                  drop-shadow-md">
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
                    md:text-lg
                    text-white/85
                    leading-[1.2]
                    md:leading-relaxed
                    max-w-xl
                    drop-shadow-sm">
                  Connect with certified tennis coaches in Sydney to take your game to the next level, whether you're a beginner or a tournament player.
                </p>
              </motion.div>
            </div>
            </div>

          {/* Filter & Search Bar (desktop) - floats over the tail of the photo */}
          <div className="hidden md:block container mx-auto px-2 mt-5 relative z-20 pb-5 md:pb-10">
            <div className="bg-card/50
              backdrop-blur-sm
              border border-border/40
              shadow-lg
              rounded-2xl
              p-2.5 md:p-4 lg:p-4
              flex flex-col md:flex-row
              gap-3 md:gap-4
              items-center
              justify-between">
              <div className="relative w-full md:w-[280px] lg:w-[380px] xl:w-[450px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input 
                  data-testid="coaches-search-input"
                  placeholder="Search by name or specialty..." 
                  className="pl-10
                    h-11 md:h-12
                    text-sm md:text-base
                    bg-background
                    w-full
                    rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex flex-row md:flex-row w-full md:w-auto gap-2">
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-full flex-1 min-w-0 sm:w-full md:w-[180px] lg:w-[190px] h-11 md:h-12 bg-background cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <SelectValue placeholder="Location" className="flex-1 min-w-0 truncate" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="cursor-pointer">All Sydney</SelectItem>
                    {uniqueLocations.map(loc => (
                      <SelectItem key={loc} value={loc} className="cursor-pointer">{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-11 md:h-12 w-auto px-3 md:px-4 shrink-0 bg-background cursor-pointer ${activeFiltersCount > 0 ? 'border-primary text-primary' : ''}`}>
                      <Filter className="w-5 h-5 mr-2" />
                      Filters
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                          {activeFiltersCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-6 space-y-6" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold leading-none">Price Range</h4>
                        <span className="text-sm text-muted-foreground">Up to ${priceRange[0]}/hr</span>
                      </div>
                      <Slider
                        defaultValue={[150]}
                        max={200}
                        step={10}
                        value={priceRange}
                        onValueChange={setPriceRange}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>$0</span>
                        <span>$100</span>
                        <span>$200+</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold leading-none">Minimum Rating</h4>
                      <div className="flex gap-2">
                        {[4, 4.5, 4.8, 5].map((rating) => (
                          <Button
                            key={rating}
                            variant={minRating === rating ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMinRating(minRating === rating ? 0 : rating)}
                            className="flex-1 cursor-pointer px-2"
                          >
                            {rating}+ <Star className="w-3 h-3 ml-1 fill-current" />
                          </Button>
                        ))}
                      </div>
                    </div>

                    {activeFiltersCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearFilters}
                        className="w-full text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        Clear all filters
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>

                {activeFiltersCount > 0 && (
                  <Button 
                    variant="ghost" 
                    onClick={clearFilters}
                    className="h-12 hidden md:flex text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          </section>

          {/* Hero text (mobile) — sits below the hero photo instead of
              overlapping it */}
          <div className="md:hidden relative z-20 bg-background pt-5 pb-1">
            <div className="container mx-auto px-4 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-wider uppercase text-primary">
                  Find Best Coach
                </span>
              </div>
              <h1 className="text-3xl font-display font-bold mb-2 leading-[0.95] tracking-tight text-foreground">
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
              <p className="text-sm text-gray-600 max-w-xl font-medium leading-snug">
                Connect with certified tennis coaches in Sydney to take your game to the next level, whether you're a beginner or a tournament player.
              </p>
            </div>
          </div>

          {/* Filter & Search Bar (mobile) — sits below the hero photo
              instead of floating over it */}
          <div className="md:hidden relative z-20 bg-background pt-2 pb-2">
            <div className="container mx-auto px-4 space-y-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name or specialty..."
                  className="pl-10 h-11 text-sm bg-secondary/50 border-transparent focus:border-primary w-full rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex w-full gap-2">
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="flex-1 min-w-0 h-11 bg-secondary/50 border-transparent cursor-pointer">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <SelectValue placeholder="Location" className="flex-1 min-w-0 truncate" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="cursor-pointer">All Sydney</SelectItem>
                    {uniqueLocations.map(loc => (
                      <SelectItem key={loc} value={loc} className="cursor-pointer">{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-11 w-auto px-3 shrink-0 bg-secondary/50 border-transparent cursor-pointer ${activeFiltersCount > 0 ? 'border-primary text-primary' : ''}`}>
                      <Filter className="w-4 h-4 mr-1.5" />
                      Filters
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                          {activeFiltersCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4 space-y-5" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold leading-none">Price Range</h4>
                        <span className="text-sm text-muted-foreground">Up to ${priceRange[0]}/hr</span>
                      </div>
                      <Slider
                        defaultValue={[150]}
                        max={200}
                        step={10}
                        value={priceRange}
                        onValueChange={setPriceRange}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>$0</span>
                        <span>$100</span>
                        <span>$200+</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold leading-none">Minimum Rating</h4>
                      <div className="flex gap-2">
                        {[4, 4.5, 4.8, 5].map((rating) => (
                          <Button
                            key={rating}
                            variant={minRating === rating ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMinRating(minRating === rating ? 0 : rating)}
                            className="flex-1 cursor-pointer px-2"
                          >
                            {rating}+ <Star className="w-3 h-3 ml-1 fill-current" />
                          </Button>
                        ))}
                      </div>
                    </div>

                    {activeFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="w-full text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        Clear all filters
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Coaches Grid — pulled up so the photo's fade dissolves under
              the top of the first row, matching the Partners page */}
          <section className="relative z-30 container mx-auto px-4 md:-mt-4 pb-24 scroll-mt-24"
            ref={coachesSectionRef}>
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
                        alt={coach.name} 
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
                        <Star className="w-3 h-3 text-primary fill-primary" />
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
                        <div className="min-h-[56px] md:min-h-[85px] min-w-0 w-full">
                          <h3 className="text-base md:text-lg lg:text-xl
                            font-bold
                            font-display
                            group-hover:text-primary
                            transition-colors

                            line-clamp-2
                            min-h-[48px]
                            md:min-h-[56px]">{coach.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">{coach.title}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="px-3 pb-3 space-y-1.5 md:space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
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
                            <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-primary" />
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
                        <Button className="w-full h-9 md:h-10 text-xs md:text-sm font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all cursor-pointer">
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
                  className="mt-4 text-primary cursor-pointer"
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
