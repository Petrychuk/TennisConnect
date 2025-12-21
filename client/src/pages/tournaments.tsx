import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, MapPin, Users, Trophy, DollarSign, Phone, Mail, Globe, Search, Filter, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const TOURNAMENTS_DATA = [
  {
    id: 1,
    name: "Sydney Open 2025",
    date: "2025-02-15",
    endDate: "2025-02-17",
    location: "Olympic Park Tennis Centre, Sydney",
    address: "Olympic Blvd, Sydney Olympic Park NSW 2127",
    level: "Advanced",
    price: 150,
    prizePool: "5000 AUD",
    maxParticipants: 64,
    currentParticipants: 48,
    description: "Sydney's premier tennis tournament for advanced players. Three days of competition with a $5000 AUD prize pool. Held at the professional Olympic Park courts.",
    organizer: "Sydney Tennis Association",
    phone: "+61 2 9714 7888",
    email: "tournaments@sydneytennis.com.au",
    website: "https://sydneytennis.com.au",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&h=400&fit=crop",
    status: "upcoming",
    categories: ["Singles", "Doubles"],
    ageGroups: ["18+", "35+", "50+"]
  },
  {
    id: 2,
    name: "Melbourne Cup Tennis",
    date: "2025-03-10",
    endDate: "2025-03-12",
    location: "Melbourne Park, Melbourne",
    address: "Olympic Blvd, Melbourne VIC 3001",
    level: "Intermediate",
    price: 100,
    prizePool: "3000 AUD",
    maxParticipants: 128,
    currentParticipants: 95,
    description: "Melbourne's largest amateur tournament for intermediate players. Great opportunity to test your skills and connect with the tennis community.",
    organizer: "Tennis Victoria",
    phone: "+61 3 8420 8420",
    email: "events@tennisvic.com.au",
    website: "https://tennisvic.com.au",
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&h=400&fit=crop",
    status: "upcoming",
    categories: ["Singles", "Mixed Doubles"],
    ageGroups: ["Open", "40+"]
  },
  {
    id: 3,
    name: "Brisbane Junior Championship",
    date: "2025-01-20",
    endDate: "2025-01-22",
    location: "Queensland Tennis Centre, Brisbane",
    address: "190 King Arthur Terrace, Tennyson QLD 4105",
    level: "Beginner",
    price: 50,
    prizePool: "1000 AUD",
    maxParticipants: 32,
    currentParticipants: 28,
    description: "Tournament for beginner junior players. Great start for kids aged 8-16 who want to try competitive tennis.",
    organizer: "Tennis Queensland",
    phone: "+61 7 3120 7900",
    email: "juniors@tennisqld.com.au",
    website: "https://tennisqld.com.au",
    image: "https://images.unsplash.com/photo-1551773188-0801da12f5c1?w=800&h=400&fit=crop",
    status: "upcoming",
    categories: ["Singles"],
    ageGroups: ["8-12", "13-16"]
  },
  {
    id: 4,
    name: "Perth Summer Classic",
    date: "2024-12-05",
    endDate: "2024-12-07",
    location: "State Tennis Centre, Perth",
    address: "Victoria Park Dr, Burswood WA 6100",
    level: "Advanced",
    price: 120,
    prizePool: "4000 AUD",
    maxParticipants: 48,
    currentParticipants: 48,
    winner: "James Wilson",
    finalist: "Michael Chen",
    description: "Perth's prestigious summer tournament. Featured the best players from Australia's west coast.",
    organizer: "Tennis West",
    phone: "+61 8 6462 8300",
    email: "tournaments@tenniswest.com.au",
    website: "https://tenniswest.com.au",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&h=400&fit=crop",
    status: "past",
    categories: ["Singles", "Doubles"],
    ageGroups: ["Open"]
  },
  {
    id: 5,
    name: "Adelaide Autumn Open",
    date: "2024-11-10",
    endDate: "2024-11-12",
    location: "Memorial Drive Tennis Centre, Adelaide",
    address: "War Memorial Dr, Adelaide SA 5000",
    level: "Intermediate",
    price: 80,
    prizePool: "2500 AUD",
    maxParticipants: 64,
    currentParticipants: 64,
    winner: "Sarah Thompson",
    finalist: "Emma Davis",
    description: "Adelaide's autumn tournament for intermediate players. Wonderful atmosphere and friendly competition.",
    organizer: "Tennis SA",
    phone: "+61 8 8367 9400",
    email: "events@tennissa.com.au",
    website: "https://tennissa.com.au",
    image: "https://images.unsplash.com/photo-1529926706528-db9e5010cd3e?w=800&h=400&fit=crop",
    status: "past",
    categories: ["Singles", "Doubles", "Mixed Doubles"],
    ageGroups: ["Open", "35+", "50+"]
  }
];

export default function TournamentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const upcomingTournaments = TOURNAMENTS_DATA.filter(t => t.status === "upcoming");
  const pastTournaments = TOURNAMENTS_DATA.filter(t => t.status === "past");

  const filterTournaments = (tournaments: typeof TOURNAMENTS_DATA) => {
    return tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = filterLevel ? t.level === filterLevel : true;
      return matchesSearch && matchesLevel;
    });
  };

  const handleRegister = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "You need to sign in to register for tournaments",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Registration submitted!",
      description: `You've registered for "${selectedTournament?.name}". Confirmation will be sent to your email.`
    });
    setRegisterModalOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const TournamentCard = ({ tournament, isPast = false }: { tournament: any; isPast?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group">
        <div className="relative h-48 md:h-56 overflow-hidden">
          <img 
            src={tournament.image} 
            alt={tournament.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute top-4 left-4 flex gap-2">
            <Badge className={`${
              tournament.level === 'Advanced' ? 'bg-red-500' :
              tournament.level === 'Intermediate' ? 'bg-yellow-500' :
              'bg-green-500'
            } text-white font-bold`}>
              {tournament.level}
            </Badge>
          </div>

          {isPast && tournament.winner && (
            <div className="absolute top-4 right-4">
              <Badge className="bg-primary text-primary-foreground font-bold">
                <Trophy className="w-3 h-3 mr-1" /> Completed
              </Badge>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{tournament.name}</h3>
            <div className="flex flex-wrap gap-3 text-white/90 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(tournament.date)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {tournament.location.split(',')[0]}
              </span>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          <p className="text-muted-foreground mb-4 line-clamp-2">{tournament.description}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-bold">{tournament.price} AUD</p>
              <p className="text-xs text-muted-foreground">Entry Fee</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <Trophy className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-bold">{tournament.prizePool}</p>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-bold">{tournament.currentParticipants}/{tournament.maxParticipants}</p>
              <p className="text-xs text-muted-foreground">Participants</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-bold">{tournament.categories.length}</p>
              <p className="text-xs text-muted-foreground">Categories</p>
            </div>
          </div>

          {isPast && tournament.winner && (
            <div className="bg-primary/10 rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground mb-2">Results:</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="font-bold">{tournament.winner}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-sm">Runner-up: {tournament.finalist}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {tournament.categories.map((cat: string) => (
              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
            ))}
            {tournament.ageGroups.map((age: string) => (
              <Badge key={age} variant="secondary" className="text-xs">{age}</Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {!isPast ? (
              <Button 
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold cursor-pointer"
                onClick={() => {
                  setSelectedTournament(tournament);
                  setRegisterModalOpen(true);
                }}
              >
                Register
              </Button>
            ) : null}
            <Button 
              variant="outline" 
              className="flex-1 cursor-pointer"
              onClick={() => setSelectedTournament(tournament)}
            >
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      {/* Hero Section */}
      <div className="relative min-h-[50vh] flex items-center justify-center overflow-hidden bg-black">
        <div 
          className="absolute inset-0 z-0 opacity-40"
          style={{
            backgroundImage: "url(https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=2000&auto=format&fit=crop)",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background z-10" />
        
        <div className="relative z-20 container mx-auto px-4 text-center mt-20">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 bg-primary text-primary-foreground px-4 py-1.5 text-sm font-bold">
              <Trophy className="w-4 h-4 mr-2" /> Official Tournaments
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold mb-6 tracking-tight text-white">
              Tennis <span className="text-primary">Tournaments</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto font-light leading-relaxed">
              Compete in tournaments, test your skills, and climb the rankings among Australia's best players.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b py-4 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search tournaments..." 
                className="pl-10 h-11 bg-secondary/50 border-transparent focus:border-primary rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
              {[
                { value: "", label: "All Levels" },
                { value: "Beginner", label: "Beginner" },
                { value: "Intermediate", label: "Intermediate" },
                { value: "Advanced", label: "Advanced" }
              ].map((level) => (
                <button
                  key={level.value}
                  onClick={() => setFilterLevel(filterLevel === level.value ? "" : level.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer ${
                    filterLevel === level.value 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background hover:bg-secondary border-input"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tournaments Content */}
      <div className="container mx-auto px-4 py-12">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="upcoming" className="cursor-pointer">
              <Calendar className="w-4 h-4 mr-2" /> Upcoming
            </TabsTrigger>
            <TabsTrigger value="past" className="cursor-pointer">
              <Trophy className="w-4 h-4 mr-2" /> Past
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {filterTournaments(upcomingTournaments).map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
            {filterTournaments(upcomingTournaments).length === 0 && (
              <div className="text-center py-20">
                <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-bold mb-2">No tournaments found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {filterTournaments(pastTournaments).map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} isPast />
              ))}
            </div>
            {filterTournaments(pastTournaments).length === 0 && (
              <div className="text-center py-20">
                <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-bold mb-2">No tournaments found</h3>
                <p className="text-muted-foreground">Try adjusting your search criteria</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Registration Modal */}
      <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tournament Registration</DialogTitle>
            <DialogDescription>
              {selectedTournament?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTournament && (
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-bold">{formatDate(selectedTournament.date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Entry Fee</p>
                    <p className="font-bold">{selectedTournament.price} AUD</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Level</p>
                    <p className="font-bold">{selectedTournament.level}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Spots Left</p>
                    <p className="font-bold">{selectedTournament.maxParticipants - selectedTournament.currentParticipants}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Organizer Contact:</p>
                <div className="text-sm space-y-1">
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {selectedTournament.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {selectedTournament.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedTournament.address}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRegisterModalOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleRegister} className="bg-primary text-primary-foreground cursor-pointer">
              Confirm Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tournament Details Modal */}
      <Dialog open={!!selectedTournament && !registerModalOpen} onOpenChange={() => setSelectedTournament(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedTournament?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedTournament && (
            <div className="space-y-6">
              <img 
                src={selectedTournament.image} 
                alt={selectedTournament.name}
                className="w-full h-48 object-cover rounded-lg"
              />

              <p className="text-muted-foreground">{selectedTournament.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="font-bold text-sm">{formatDate(selectedTournament.date)}</p>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="font-bold">{selectedTournament.price} AUD</p>
                  <p className="text-xs text-muted-foreground">Entry Fee</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <Trophy className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="font-bold">{selectedTournament.prizePool}</p>
                  <p className="text-xs text-muted-foreground">Prizes</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="font-bold">{selectedTournament.currentParticipants}/{selectedTournament.maxParticipants}</p>
                  <p className="text-xs text-muted-foreground">Participants</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-bold mb-3">Organizer</h4>
                <p className="font-medium">{selectedTournament.organizer}</p>
                <div className="mt-2 space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${selectedTournament.phone}`} className="hover:text-primary">{selectedTournament.phone}</a>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${selectedTournament.email}`} className="hover:text-primary">{selectedTournament.email}</a>
                  </p>
                  <p className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a href={selectedTournament.website} target="_blank" className="hover:text-primary">{selectedTournament.website}</a>
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedTournament.address}
                  </p>
                </div>
              </div>

              {selectedTournament.status === "upcoming" && (
                <Button 
                  className="w-full bg-primary text-primary-foreground font-bold cursor-pointer"
                  onClick={() => setRegisterModalOpen(true)}
                >
                  Register for Tournament
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
