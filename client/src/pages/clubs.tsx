import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Search, Filter, Phone, Globe, DollarSign, Trophy, ArrowRight, Building2, Star, CheckCircle } from "lucide-react";
import { CLUBS_DATA } from "@/lib/dummy-data";
import { motion } from "framer-motion";
import SEO from "@/components/seo";
import { PartnerCTA } from "@/components/partnerCTA";

export default function ClubsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterService, setFilterService] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [clubs, setClubs] = useState<typeof CLUBS_DATA>([]);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

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
  const filteredClubs = clubs.filter(club => {
    const matchesSearch = 
      club.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      club.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesService = filterService 
      ? club.services.some(s => s.toLowerCase().includes(filterService.toLowerCase()))
      : true;

    return matchesSearch && matchesService;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredClubs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentClubs = filteredClubs.slice(startIndex, startIndex + itemsPerPage);

  const ClubCard = ({ club }: { club: typeof CLUBS_DATA[0] }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="group relative w-full"
    >
      <div className="flex flex-col lg:flex-row bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
        {/* Image Section */}
        <div className="w-full
          lg:w-[34%]
          h-52
          md:h-60
          lg:h-auto
          shrink-0
          overflow-hidden
          bg-muted">
          <img 
            src={club.image} 
            alt={club.name} 
            className="
              w-full
              h-full
              object-cover
              object-center
              transition-transform
              duration-700
              group-hover:scale-105"
          />
          <div className="absolute top-4 left-4 flex gap-2">
             <Badge className="bg-white/90 text-black hover:bg-white font-bold backdrop-blur-sm shadow-sm">
                <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" /> {club.rating}
             </Badge>
          </div>
           <div className="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t to-transparent lg:hidden" /> 
        </div>

        {/* Content Section */}
        <div className="p-3
            md:p-5
            lg:p-6
            flex
            flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-primary font-bold mb-2 text-sm uppercase tracking-wide">
              <MapPin className="w-4 h-4" /> {club.location}
            </div>
            <h2 className="
                text-lg
                md:text-2xl
                lg:text-3xl
                font-display
                font-bold
                leading-tight
                line-clamp-2
                min-h-[56px]
                md:min-h-[72px]">
              {club.name}
            </h2>
            <p className="text-sm
                md:text-base
                text-muted-foreground
                leading-relaxed
                line-clamp-3
                min-h-[72px]
                md:min-h-[84px]">
              {club.description}
            </p>
            
            <div className="flex
              flex-wrap
              gap-2
              min-h-[60px]">
              {club.services.slice(0, 4).map((service, i) => (
                <Badge key={i} variant="secondary" className="px-2
                  py-0.5
                  text-[10px]
                  md:text-xs bg-secondary/50">
                  {service}
                </Badge>
              ))}
            </div>

            <div className="grid
                grid-cols-2
                gap-3
                md:gap-6
                mb-4
                md:mb-6
                py-4
                border-y
                border-border/50">
              <div className="flex items-start gap-3">
                 <div className="p-2 rounded-full bg-primary/10 text-primary">
                   <DollarSign className="w-5 h-5" />
                 </div>
                 <div>
                   <p className="font-bold text-base md:text-lg">{club.price}</p>
                   <p className="text-xs text-muted-foreground">per hour / court</p>
                 </div>
              </div>
              <div className="flex items-start gap-3">
                 <div className="p-2 rounded-full bg-primary/10 text-primary">
                   <Trophy className="w-5 h-5" />
                 </div>
                 <div>
                   <p className="font-bold text-lg">Tournaments</p>
                   <p className="text-xs text-muted-foreground">Monthly Events</p>
                 </div>
              </div>
            </div>

            <div className="flex gap-2">
               <Button className="flex-1
                  h-10
                  md:h-12
                  text-sm
                  md:text-base
                  font-bold
                  rounded-xl" 
                  asChild>
                 <a href={`tel:${club.phone}`}>
                    <Phone className="w-4 h-4 mr-2" /> Call to Book
                 </a>
               </Button>
               <Button variant="outline" className="flex-1
                    h-10
                    md:h-12
                    text-sm
                    md:text-base
                    font-bold
                    rounded-xl hover:bg-secondary/50" asChild>
                 <a href={club.website} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4 mr-2" /> Visit Website
                 </a>
               </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

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
        
        {/* Intro / Hero Section */}
        <div className="relative min-h-[34vh]
          md:min-h-[30vh]
          lg:min-h-[35vh] flex items-center justify-center overflow-hidden">
          <div 
            className="absolute inset-0 z-0 opacity-70"
            style={{
              backgroundImage: "url(/assets/images/tennisClubs.png)",
              //backgroundImage: "url(https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=2000&auto=format&fit=crop)",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-background/30 via-background/10 to-background z-10" />
          
          <div className="relative z-20 container mx-auto px-4 text-center mt-14 md:mt-20">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge className="
                    mb-3
                    md:mb-6
                    px-4
                    md:px-5
                    py-1.5
                    text-[10px]
                    sm:text-xs
                    font-bold
                    uppercase
                    tracking-wider
                    shadow-md
                  "
                >Places To Play
                </Badge>
                  <h1 className="text-4xl
                    sm:text-4xl
                    md:text-6xl
                    lg:text-7xl
                    font-display
                    font-bold
                    tracking-tight
                    leading-none">
                  Find Tennis <span className="text-primary relative inline-block">
                  Communities
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                  </svg>
                </span>
              </h1>
              <p className="text-sm
                  sm:text-base
                  md:text-xl
                  lg:text-2xl
                  text-muted-foreground
                  max-w-xl
                  md:max-w-2xl
                  mx-auto
                  font-normal
                  leading-tight
                  md:leading-[1.3]">
                 Discover tennis courts, clubs, social groups, and local communities across Australia.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-background/80 backdrop-blur-lg border-y border-border/50 py-2 md:py-4">
          <div className="container mx-auto px-2 md:px-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80 lg:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <Input 
                  placeholder="Search by name or location..." 
                  className="pl-10 h-11 bg-secondary/50 border-transparent focus:border-primary focus:bg-background transition-all rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex
                  gap-2
                  overflow-x-auto
                  scrollbar-hide
                  w-full
                  md:w-auto
                  pb-1">
                {["Grass Courts", "Hard Courts", "Coaching", "Pro Shop", "Night Tennis"].map((tag) => (
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
                        : "bg-background hover:bg-secondary border-input hover:border-primary/50"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Clubs List Section */}
        <div className="container mx-auto px-4 py-16">

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
              onClick={() => {
                setSearchTerm("");
                setFilterService("");
              }}
              className="mt-4"
            >
              Clear all filters
            </Button>
          </div>

        ) : (

          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {currentClubs.map((club) => (
                <div key={club.id}>
                  <ClubCard club={club} />
                </div>
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