import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar, MapPin, Users, Trophy, DollarSign, Phone, Mail, Globe, Search, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import SEO from "@/components/seo";

interface DBTournament {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  location: string;
  address: string | null;
  level: string;
  price: number;
  prizePool: string | null;
  maxParticipants: number;
  currentParticipants: number;
  description: string;
  organizer: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  coverImage: string;
  status: string;
  categories: string[];
  ageGroups: string[];
  winner: string | null;
  finalist: string | null;
}

export default function TournamentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<DBTournament | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [tournaments, setTournaments] = useState<DBTournament[]>([]);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch("/api/event-tournaments", { credentials: "include" })
      .then((r) => r.json())
      .then(setTournaments)
      .catch(() => setTournaments([]));
  }, []);

  const upcomingTournaments = tournaments.filter((t) => t.status === "upcoming");
  const pastTournaments = tournaments.filter((t) => t.status === "past");

  const filterTournaments = (list: DBTournament[]) =>
    list.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = filterLevel ? t.level === filterLevel : true;
      return matchesSearch && matchesLevel;
    });

  const handleRegister = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "You need to sign in to register for tournaments",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Registration submitted!",
      description: `You've registered for "${selectedTournament?.name}". Confirmation will be sent to your email.`,
    });
    setRegisterModalOpen(false);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const TournamentCard = ({ tournament, isPast = false }: { tournament: DBTournament; isPast?: boolean }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group">
        <div className="relative h-48 md:h-56 overflow-hidden">
          <img
            src={tournament.coverImage}
            alt={tournament.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute top-4 left-4 flex gap-2">
            <Badge className={`${
              tournament.level === "Advanced" ? "bg-red-500" :
              tournament.level === "Intermediate" ? "bg-yellow-500" : "bg-green-500"
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
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(tournament.startDate)}</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{tournament.location.split(",")[0]}</span>
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
              <p className="font-bold">{tournament.prizePool || "—"}</p>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-bold">{tournament.currentParticipants}/{tournament.maxParticipants}</p>
              <p className="text-xs text-muted-foreground">Participants</p>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="font-bold">{(tournament.categories || []).length}</p>
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
                {tournament.finalist && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">Runner-up: {tournament.finalist}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {(tournament.categories || []).map((cat: string) => (
              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
            ))}
            {(tournament.ageGroups || []).map((age: string) => (
              <Badge key={age} variant="secondary" className="text-xs">{age}</Badge>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {!isPast && (
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold cursor-pointer"
                onClick={() => {
                  setSelectedTournament(tournament);
                  setRegisterModalOpen(true);
                }}
                data-testid={`tournament-register-${tournament.slug}`}
              >
                Register
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={() => setSelectedTournament(tournament)}
              data-testid={`tournament-details-${tournament.slug}`}
            >
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <>
      <SEO
      title="Tennis Tournaments in Australia | TennisConnect"
      description="Explore upcoming tennis tournaments, social competitions and local tennis events across Australia."
      canonical="/tournaments"
      tags={[
        "tennis tournaments",
        "tennis events",
        "social tennis",
        "tennis competitions",
        "Sydney tournaments",
        "Australia tennis",
      ]}
    />
      <div className="min-h-screen bg-background font-sans">
        <Navbar />

        <div className="relative min-h-[50vh] flex items-center justify-center overflow-hidden bg-black">
          <div
            className="absolute inset-0 z-0 opacity-40"
            style={{
              backgroundImage: "url(https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=2000&auto=format&fit=crop)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/40 to-background z-10" />
          <div className="relative z-20 container mx-auto px-4 text-center mt-20">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
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
                  { value: "Advanced", label: "Advanced" },
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

        <div className="container mx-auto px-4 py-12">
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="upcoming" className="cursor-pointer"><Calendar className="w-4 h-4 mr-2" /> Upcoming</TabsTrigger>
              <TabsTrigger value="past" className="cursor-pointer"><Trophy className="w-4 h-4 mr-2" /> Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {filterTournaments(upcomingTournaments).map((t) => (<TournamentCard key={t.id} tournament={t} />))}
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
                {filterTournaments(pastTournaments).map((t) => (<TournamentCard key={t.id} tournament={t} isPast />))}
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

        <Dialog open={registerModalOpen} onOpenChange={setRegisterModalOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tournament Registration</DialogTitle>
              <DialogDescription>{selectedTournament?.name}</DialogDescription>
            </DialogHeader>

            {selectedTournament && (
              <div className="space-y-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Date</p><p className="font-bold">{formatDate(selectedTournament.startDate)}</p></div>
                    <div><p className="text-muted-foreground">Entry Fee</p><p className="font-bold">{selectedTournament.price} AUD</p></div>
                    <div><p className="text-muted-foreground">Level</p><p className="font-bold">{selectedTournament.level}</p></div>
                    <div><p className="text-muted-foreground">Spots Left</p><p className="font-bold">{selectedTournament.maxParticipants - selectedTournament.currentParticipants}</p></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Organizer Contact:</p>
                  <div className="text-sm space-y-1">
                    {selectedTournament.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{selectedTournament.phone}</p>}
                    {selectedTournament.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{selectedTournament.email}</p>}
                    {selectedTournament.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{selectedTournament.address}</p>}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setRegisterModalOpen(false)} className="cursor-pointer">Cancel</Button>
              <Button onClick={handleRegister} className="bg-primary text-primary-foreground cursor-pointer">Confirm Registration</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedTournament && !registerModalOpen} onOpenChange={() => setSelectedTournament(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedTournament?.name}</DialogTitle>
            </DialogHeader>

            {selectedTournament && (
              <div className="space-y-6">
                <img src={selectedTournament.coverImage} alt={selectedTournament.name} className="w-full h-48 object-cover rounded-lg" />
                <p className="text-muted-foreground">{selectedTournament.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="font-bold text-sm">{formatDate(selectedTournament.startDate)}</p>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                  </div>
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="font-bold">{selectedTournament.price} AUD</p>
                    <p className="text-xs text-muted-foreground">Entry Fee</p>
                  </div>
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <Trophy className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="font-bold">{selectedTournament.prizePool || "—"}</p>
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
                    {selectedTournament.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><a href={`tel:${selectedTournament.phone}`} className="hover:text-primary">{selectedTournament.phone}</a></p>}
                    {selectedTournament.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><a href={`mailto:${selectedTournament.email}`} className="hover:text-primary">{selectedTournament.email}</a></p>}
                    {selectedTournament.website && <p className="flex items-center gap-2"><Globe className="w-4 h-4 text-muted-foreground" /><a href={selectedTournament.website} target="_blank" className="hover:text-primary">{selectedTournament.website}</a></p>}
                    {selectedTournament.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{selectedTournament.address}</p>}
                  </div>
                </div>

                {selectedTournament.status === "upcoming" && (
                  <Button className="w-full bg-primary text-primary-foreground font-bold cursor-pointer" onClick={() => setRegisterModalOpen(true)}>
                    Register for Tournament
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Footer />
      </div>
    </>
  );
}
