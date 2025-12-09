import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MapPin, Star, Filter, ArrowRight, DollarSign, X } from "lucide-react";
import heroImage from "@assets/generated_images/professional_tennis_coaching_session_on_a_sunny_court.png";
import avatarImage from "@assets/generated_images/female_tennis_coach_portrait.png";

// Mock Data for Coaches
const INITIAL_COACHES = [
  {
    id: 1,
    name: "Nataliia Petrychuk",
    title: "Tennis Coach (ITF Level 2)",
    location: "Manly",
    rating: 4.9,
    reviews: 24,
    rate: 90,
    experience: "10 years",
    image: avatarImage,
    tags: ["High Performance", "Kids", "Technique"]
  },
  {
    id: 2,
    name: "David Chen",
    title: "Former ATP Player & Elite Coach",
    location: "Sydney CBD",
    rating: 5.0,
    reviews: 42,
    rate: 120,
    experience: "15 years",
    image: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop",
    tags: ["Pro Level", "Strategy", "Fitness"]
  },
  {
    id: 3,
    name: "Emily Wilson",
    title: "Junior Development Specialist",
    location: "Eastern Suburbs",
    rating: 4.8,
    reviews: 18,
    rate: 75,
    experience: "5 years",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    tags: ["Beginners", "Kids", "Fun"]
  },
  {
    id: 4,
    name: "Michael Ross",
    title: "Club Coach & Tournament Director",
    location: "Inner West",
    rating: 4.7,
    reviews: 31,
    rate: 85,
    experience: "8 years",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    tags: ["Tournaments", "Adults", "Social"]
  },
  {
    id: 5,
    name: "Jessica Lee",
    title: "Performance Coach",
    location: "North Shore",
    rating: 4.9,
    reviews: 15,
    rate: 95,
    experience: "7 years",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
    tags: ["Advanced", "Footwork", "Mental Game"]
  },
  {
    id: 6,
    name: "James Wilson",
    title: "Tennis Australia Club Professional",
    location: "Sutherland Shire",
    rating: 4.6,
    reviews: 28,
    rate: 80,
    experience: "12 years",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
    tags: ["Groups", "Cardio Tennis", "Adults"]
  }
];

export default function CoachesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [priceRange, setPriceRange] = useState([150]); // Max price
  const [minRating, setMinRating] = useState(0);
  const [coaches, setCoaches] = useState(INITIAL_COACHES);

  useEffect(() => {
    // Function to load profile
    const loadProfile = () => {
      const savedProfile = localStorage.getItem("tennis_connect_coach_profile");
      if (savedProfile) {
        try {
          const parsedProfile = JSON.parse(savedProfile);
          
          setCoaches(prevCoaches => {
            const newCoaches = [...prevCoaches];
            newCoaches[0] = {
              ...newCoaches[0],
              name: parsedProfile.name || newCoaches[0].name,
              title: parsedProfile.title || newCoaches[0].title,
              location: parsedProfile.locations?.[0] || parsedProfile.location || newCoaches[0].location,
              rate: parsedProfile.rate ? parseInt(parsedProfile.rate) : newCoaches[0].rate,
              experience: parsedProfile.experience ? `${parsedProfile.experience} years` : newCoaches[0].experience,
              image: parsedProfile.avatar || newCoaches[0].image,
            };
            return newCoaches;
          });
        } catch (e) {
          console.error("Failed to parse local profile for coaches list", e);
        }
      }
    };

    // Load initially
    loadProfile();

    // Listen for storage changes (in case profile is updated in another tab or component)
    window.addEventListener('storage', loadProfile);
    
    // Custom event listener for same-tab updates
    window.addEventListener('profile-updated', loadProfile);

    return () => {
      window.removeEventListener('storage', loadProfile);
      window.removeEventListener('profile-updated', loadProfile);
    };
  }, []);

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

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <main>
        {/* Modern Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-black text-white">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img 
              src={heroImage}
              alt="Tennis Court" 
              className="w-full h-full object-cover object-[50%_25%] opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              <Badge className="mb-6 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-1.5 text-sm font-bold uppercase tracking-wider cursor-default">
                Find Your Coach
              </Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold leading-tight mb-6">
                Elevate your game with <span className="text-primary">pro coaching.</span>
              </h1>
              <p className="text-xl text-gray-300 max-w-xl mb-8 leading-relaxed">
                Connect with certified tennis coaches in Sydney who can take your skills to the next level, whether you're a beginner or a tournament player.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Filter & Search Bar - Floating */}
        <div className="container mx-auto px-4 -mt-8 relative z-20 mb-16">
          <div className="bg-card border border-border/50 shadow-xl rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input 
                placeholder="Search by name or specialty..." 
                className="pl-10 h-12 text-lg bg-background w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col md:flex-row w-full md:w-auto gap-4">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full md:w-[200px] h-12 bg-background cursor-pointer">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <SelectValue placeholder="Location" />
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
                  <Button variant="outline" className={`h-12 w-full md:w-auto px-4 flex-shrink-0 bg-background cursor-pointer ${activeFiltersCount > 0 ? 'border-primary text-primary' : ''}`}>
                    <Filter className="w-5 h-5 mr-2" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-6 space-y-6" align="start">
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
                          className="flex-1 cursor-pointer"
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

        {/* Coaches Grid */}
        <section className="container mx-auto px-4 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCoaches.map((coach, index) => (
              <motion.div
                key={coach.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 border-border/60 group cursor-pointer">
                  {/* Card Header with Image */}
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src={coach.image} 
                      alt={coach.name} 
                      className="w-full h-full object-cover object-[50%_35%] transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 text-primary fill-primary" />
                      {coach.rating} ({coach.reviews})
                    </div>
                  </div>

                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold font-display group-hover:text-primary transition-colors">{coach.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{coach.title}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary" />
                      {coach.location}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {coach.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="font-normal text-xs bg-muted/50">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                       <div className="flex flex-col">
                         <span className="text-xs text-muted-foreground">Hourly Rate</span>
                         <div className="flex items-center font-bold text-lg">
                           <DollarSign className="w-4 h-4 text-primary" />
                           {coach.rate}
                           <span className="text-sm font-normal text-muted-foreground ml-1">AUD</span>
                         </div>
                       </div>
                       <div className="text-right">
                         <span className="text-xs text-muted-foreground">Experience</span>
                         <p className="font-bold">{coach.experience}</p>
                       </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Link href="/coach/profile">
                      <Button className="w-full font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all cursor-pointer">
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
        </section>
      </main>

      <Footer />
    </div>
  );
}
