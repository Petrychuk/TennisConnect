import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Search, Filter, Phone, Globe, DollarSign, Trophy, ArrowRight, Building2, Star, CheckCircle } from "lucide-react";
import { CLUBS_DATA } from "@/lib/dummy-data";
import { motion } from "framer-motion";

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
      className="group relative w-full mb-16 last:mb-0"
    >
      <div className="flex flex-col lg:flex-row bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
        {/* Image Section */}
        <div className="lg:w-1/2 relative h-64 lg:h-auto overflow-hidden">
          <img 
            src={club.image} 
            alt={club.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute top-4 left-4 flex gap-2">
             <Badge className="bg-white/90 text-black hover:bg-white font-bold backdrop-blur-sm shadow-sm">
                <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" /> {club.rating}
             </Badge>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-black/60 to-transparent lg:hidden" />
        </div>

        {/* Content Section */}
        <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center relative">
          <div className="mb-6">
            <div className="flex items-center gap-2 text-primary font-bold mb-2 text-sm uppercase tracking-wide">
              <MapPin className="w-4 h-4" /> {club.location}
            </div>
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-foreground mb-4 leading-tight">
              {club.name}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              {club.description}
            </p>
            
            <div className="flex flex-wrap gap-2 mb-8">
              {club.services.map((service, i) => (
                <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm bg-secondary/50">
                  {service}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 border-t border-b py-6 border-border/50">
              <div className="flex items-start gap-3">
                 <div className="p-2 rounded-full bg-primary/10 text-primary">
                   <DollarSign className="w-5 h-5" />
                 </div>
                 <div>
                   <p className="font-bold text-lg">${club.price}</p>
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

            <div className="flex flex-col sm:flex-row gap-4">
               <Button className="flex-1 font-bold text-base h-12 rounded-xl" asChild>
                 <a href={`tel:${club.phone}`}>
                    <Phone className="w-4 h-4 mr-2" /> Call to Book
                 </a>
               </Button>
               <Button variant="outline" className="flex-1 font-bold text-base h-12 rounded-xl border-2 hover:bg-secondary/50" asChild>
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
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      {/* Intro / Hero Section */}
      <div className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0 opacity-40"
          style={{
            backgroundImage: "url(https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=2000&auto=format&fit=crop)",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-background/80 via-background/20 to-background z-10" />
        
        <div className="relative z-20 container mx-auto px-4 text-center mt-20">
          <motion.div 
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-6 tracking-tight">
              Find Your <span className="text-primary relative inline-block">
                Court
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
              Discover premier tennis clubs, book courts, and join competitive tournaments in your area.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Filter Bar (Sticky) */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-y border-border/50 py-4 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <Input 
                placeholder="Search by name or location..." 
                className="pl-10 h-11 bg-secondary/50 border-transparent focus:border-primary focus:bg-background transition-all rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
              {["Grass Courts", "Hard Courts", "Coaching", "Pro Shop", "Night Tennis"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterService(filterService === tag ? "" : tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer ${
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
        <div className="max-w-6xl mx-auto space-y-16">
          {currentClubs.map((club, index) => (
             <div key={club.id}>
               <ClubCard club={club} />
               
               {/* Insert Partner Block after 1st item (or every 5th) for prototype demonstration */}
               {(index === 2 || (index === currentClubs.length - 1 && index < 2)) && (
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    className="my-16 bg-primary text-primary-foreground rounded-3xl p-8 md:p-16 relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                      <div className="max-w-2xl">
                         <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-sm font-bold mb-4 backdrop-blur-sm">
                           <Building2 className="w-4 h-4" /> Partner With Us
                         </div>
                         <h3 className="text-3xl md:text-5xl font-display font-bold mb-4">Own a Tennis Club?</h3>
                         <p className="text-lg opacity-90 mb-8 max-w-xl">
                           Join our network to manage bookings, attract new players, and streamline your operations. Get listed today!
                         </p>
                         <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="lg" variant="secondary" className="font-bold text-primary h-12 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer">
                                  Become a Partner
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Partner Inquiry</DialogTitle>
                                  <DialogDescription>Fill out this form and our team will contact you within 24 hours.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Club Name</Label>
                                    <Input placeholder="e.g. Grand Slam Tennis Centre" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Contact Person</Label>
                                    <Input placeholder="Your Name" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input placeholder="+61 ..." />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Message</Label>
                                    <Textarea placeholder="Tell us about your facilities..." />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button className="w-full cursor-pointer">Send Inquiry</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 h-12 px-8 rounded-xl backdrop-blur-sm cursor-pointer">
                               <Phone className="w-4 h-4 mr-2" /> Call Sales
                            </Button>
                         </div>
                      </div>
                      <div className="hidden md:block p-8 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 rotate-3 hover:rotate-0 transition-transform duration-500">
                         <div className="flex items-center gap-3 mb-4">
                            <CheckCircle className="w-8 h-8 text-white" />
                            <div className="text-left">
                              <p className="font-bold text-2xl">200+</p>
                              <p className="text-xs opacity-75">Active Clubs</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-white" />
                            <div className="text-left">
                              <p className="font-bold text-2xl">50k+</p>
                              <p className="text-xs opacity-75">Monthly Bookings</p>
                            </div>
                         </div>
                      </div>
                    </div>
                 </motion.div>
               )}
             </div>
          ))}

          {filteredClubs.length === 0 && (
            <div className="text-center py-20">
              <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No clubs found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters.</p>
              <Button 
                variant="link" 
                onClick={() => { setSearchTerm(""); setFilterService(""); }}
                className="mt-2"
              >
                Clear all filters
              </Button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-12 gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i}
                  variant={currentPage === i + 1 ? "default" : "outline"}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}