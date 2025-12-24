import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Search, MessageCircle, User, Activity, Send } from "lucide-react";
import { PARTNERS_DATA } from "@/lib/dummy-data";
import { motion } from "framer-motion";
import { Link } from "wouter";

interface PartnerData {
  
  id: string | number;
  userId?: string;
  slug?: string;
  name: string;
  location: string;
  skillLevel: string;
  avatar: string;
  available: boolean;
  bio: string;
  
}

export default function PartnersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [partners, setPartners] = useState<PartnerData[]>(PARTNERS_DATA);
  const [loading, setLoading] = useState(true);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerData | null>(null);
  const [messageText, setMessageText] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive"
      });
      return;
    }

    if (!isAuthenticated) {
      if (!senderName.trim() || !senderEmail.trim()) {
        toast({
          title: "Error",
          description: "Please enter your name and email",
          variant: "destructive"
        });
        return;
      }
    }

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: selectedPartner?.userId || selectedPartner?.id,
          recipientType: "player",
          senderName: isAuthenticated ? user?.name : senderName,
          senderEmail: isAuthenticated ? user?.email : senderEmail,
          senderPhone: senderPhone || undefined,
          subject: `Message from ${isAuthenticated ? user?.name : senderName}`,
          content: messageText,
        }),
      });

      if (res.ok) {
        toast({
          title: "Message sent!",
          description: `Your message has been sent to ${selectedPartner?.name}. They will receive it in their inbox.`
        });
        setMessageModalOpen(false);
        setMessageText("");
        setSenderName("");
        setSenderEmail("");
        setSenderPhone("");
        setSelectedPartner(null);
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.message || "Failed to send message",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const openMessageModal = (partner: PartnerData) => {
    setSelectedPartner(partner);
    setMessageModalOpen(true);
  };

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch("/api/players");
        
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            const transformedPartners = data.map((player: any) => ({
              id: player.id,
              userId: player.userId,
              name: player.location || "Player",
              location: player.location || "Sydney",
              skillLevel: player.skillLevel || "Intermediate",
              avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop",
              available: true,
              bio: player.bio || "",
            }));
            setPartners([...transformedPartners, ...PARTNERS_DATA]);
          } else {
            setPartners(PARTNERS_DATA);
          }
        } else {
          setPartners(PARTNERS_DATA);
        }
      } catch (error) {
        console.error("Failed to fetch partners:", error);
        setPartners(PARTNERS_DATA);
      } finally {
        setLoading(false);
      }
    }

    fetchPlayers();
  }, []);

  const filteredPartners = partners.filter(partner => {
    const matchesSearch = 
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      partner.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLevel = filterLevel 
      ? partner.skillLevel === filterLevel
      : true;

    return matchesSearch && matchesLevel;
  });
  
  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      {/* Intro / Hero Section */}
      <div className="relative min-h-[50vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 z-0 opacity-30"
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
                Partner
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
              Connect with partners for games, join local matches, and expand your tennis network.
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
                data-testid="input-search"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
              {["Beginner", "Intermediate", "Advanced"].map((level) => (
                <button
                  key={level}
                  onClick={() => setFilterLevel(filterLevel === level ? "" : level)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border cursor-pointer ${
                    filterLevel === level 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background hover:bg-secondary border-input hover:border-primary/50"
                  }`}
                  data-testid={`button-filter-${level.toLowerCase()}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPartners.map((partner, index) => (
            <motion.div
              key={partner.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 group" data-testid={`card-partner-${partner.id}`}>
                <CardContent className="p-6 grow flex flex-col items-center text-center">
                  <div className="relative mb-4">
                     <Avatar className="w-24 h-24 border-4 border-background shadow-lg group-hover:scale-105 transition-transform duration-300">
                        <AvatarImage src={partner.avatar} className="object-cover" />
                        <AvatarFallback>{partner.name[0]}</AvatarFallback>
                     </Avatar>
                     <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-background ${partner.available ? "bg-green-500" : "bg-gray-300"}`} />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-1">{partner.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                    <MapPin className="w-3 h-3" /> {partner.location}
                  </div>

                  <Badge variant="secondary" className="mb-4">
                     <Activity className="w-3 h-3 mr-1" /> {partner.skillLevel}
                  </Badge>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {partner.bio}
                  </p>
                </CardContent>
                
                <CardFooter className="p-4 pt-0 grid grid-cols-2 gap-3">
                  <Link href={`/player/${partner.slug ?? partner.userId ?? partner.id}`}>
                    <Button variant="outline" className="w-full text-xs font-bold h-9 cursor-pointer" data-testid={`button-profile-${partner.slug}`}>
                      <User className="w-3 h-3 mr-1" /> Profile
                    </Button>
                  </Link>
                  <Button 
                    className="w-full text-xs font-bold h-9 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    onClick={() => openMessageModal(partner)}
                    data-testid={`button-message-${partner.slug}`}
                  >
                    <MessageCircle className="w-3 h-3 mr-1" /> Message
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredPartners.length === 0 && (
          <div className="text-center py-20">
             <div className="inline-flex p-4 rounded-full bg-muted mb-4">
               <User className="w-8 h-8 text-muted-foreground" />
             </div>
             <h3 className="text-xl font-bold mb-2">No partners found</h3>
             <p className="text-muted-foreground">Try adjusting your search filters.</p>
          </div>
        )}
      </div>

      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send a message to {selectedPartner?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!isAuthenticated && (
              <>
                <div>
                  <Label htmlFor="senderName">Your Name *</Label>
                  <Input
                    id="senderName"
                    placeholder="John Smith"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    data-testid="input-sender-name"
                  />
                </div>
                <div>
                  <Label htmlFor="senderEmail">Your Email *</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    placeholder="john@example.com"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    data-testid="input-sender-email"
                  />
                </div>
                <div>
                  <Label htmlFor="senderPhone">Your Phone (optional)</Label>
                  <Input
                    id="senderPhone"
                    type="tel"
                    placeholder="+61 400 000 000"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    data-testid="input-sender-phone"
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="message">Your message *</Label>
              <Textarea
                id="message"
                placeholder="Hi! I'd love to play a match together..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="min-h-[120px]"
                data-testid="input-message"
              />
            </div>
            {isAuthenticated && user && (
              <p className="text-sm text-muted-foreground">
                Sending as: {user.name} ({user.email})
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageModalOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage} 
              className="bg-primary text-primary-foreground"
              disabled={sending}
              data-testid="button-send-message"
            >
              {sending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
