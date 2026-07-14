import { useState, useEffect, useRef } from "react";
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
import { AppPagination } from "@/components/shared/AppPagination";
import { MapPin, Search, MessageCircle, User, Activity, Send, Camera } from "lucide-react";
import { PARTNERS_DATA } from "@/lib/dummy-data";
import { motion } from "framer-motion";
import { Link } from "wouter";
import SEO from "@/components/seo";
import { quickMessageSchema } from "@/lib/validations/messages";
import bgImage from "/assets/images/subtle_abstract_tennis-themed_background_with_lime_green_accents.png";

interface PartnerData {
    id: string;
    userId: string | null;   // null = demo
    slug: string | null;     // null = demo
    name: string;
    location: string;
    skillLevel: string;
    avatar: string;
    available: boolean;
    bio: string;
    isDemo: boolean;      
  }

export default function PartnersPage() {
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [partners, setPartners] = useState<PartnerData[]>([]);
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
  const playersSectionRef = useRef<HTMLDivElement>(null);
  
  const handleSendMessage = async () => {
    const validation = quickMessageSchema.safeParse({
      content: messageText,
    });
    
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    
  setSending(true);

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: selectedPartner?.userId || selectedPartner?.id,
        recipientType: "player",
        content: messageText,
      }),
      credentials: "include",
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to send message");
    }

    toast({
      title: "Message sent!",
      description: `Your message has been sent to ${selectedPartner?.name}. They will receive it in their inbox.`,
    });

    setMessageModalOpen(false);
    setMessageText("");
    setSelectedPartner(null);

  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setSending(false);
  }
};

  const openMessageModal = (partner: PartnerData) => {
    if (!isAuthenticated) {
      toast({
        title: "Registration required",
        description: "Please sign up or log in to send messages to other players.",
        variant: "destructive",
      });
      return;
    }

    setSelectedPartner(partner);
    setMessageModalOpen(true);
  };

  const normalizeDemoPartners = (): PartnerData[] =>
      PARTNERS_DATA.map((p, index) => ({
        id: `demo-${index}`,
        userId: null,
        slug: null,
        name: p.name ?? "Demo Player",
        location: p.location ?? "Sydney",
        skillLevel: p.skillLevel ?? "Beginner",
        avatar: p.avatar,
        available: p.available ?? true,
        bio: p.bio ?? "",
        isDemo: true,
      }));
  const DEFAULT_AVATAR ="";
  
  const normalizeApiPlayers = (data: any[]): PartnerData[] =>
    data.map((item) => ({
      id: item.id,
      userId: item.id,
      slug: item.slug,
      name: item.name,
      location: item.location ?? "Sydney",
      skillLevel: item.skillLevel ?? "Beginner",
      avatar:
        item.avatar 
        ? `${item.avatar}?t=${item.updatedAt ?? Date.now()}`
      : DEFAULT_AVATAR,
      available: true,
      bio: item.bio ?? "",
      isDemo: false,
    }));

    useEffect(() => {
      async function fetchPartners() {
        try {
          setLoading(true);
    
          const res = await fetch(
            `/api/players?page=${page}&limit=20`
          );
    
          if (!res.ok) {
            throw new Error("API error");
          }
    
          const data = await res.json();
    
          setPagination(data.pagination);
    
          if (data.players.length > 0) {
            setPartners(normalizeApiPlayers(data.players));
          } else {
            setPartners(normalizeDemoPartners());
          }
        } catch (error) {
          console.error("Failed to fetch players:", error);
    
          setPartners(normalizeDemoPartners());
    
          setPagination({
            page: 1,
            limit: 24,
            total: normalizeDemoPartners().length,
            totalPages: 1,
          });
        } finally {
          setLoading(false);
        }
      }
    
      fetchPartners();
    }, [page]);

  const filteredPartners = partners.filter((partner) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      partner.name.toLowerCase().includes(search) ||
      partner.location.toLowerCase().includes(search);

    const matchesLevel = filterLevel
      ? partner.skillLevel === filterLevel
      : true;

    return matchesSearch && matchesLevel;
  });
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  useEffect(() => {
    if (!pagination) return;
  
    playersSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page]);

  console.log(
    'Pagination:',
    pagination
  );

  return (
    <>
      <SEO
        title="Find Tennis Players in Australia | TennisConnect"
        description="Connect with local tennis players across Australia. Find hitting partners, doubles teammates and tennis friends based on skill level, location and availability."
        canonical="/partners"
        tags={[
          "tennis partners",
          "find tennis partner",
          "tennis players Australia",
          "tennis community",
          "Sydney tennis",
          "Melbourne tennis",
          "Brisbane tennis",
          "social tennis",
        ]}
      />
    <div className="min-h-screen font-sans relative">
    <div
      className="fixed inset-0 z-0 pointer-events-none opacity-[0.06]"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        mixBlendMode: "multiply",
      }}
    />

      <Navbar />

      {/* Intro / Hero Section + Filter bar share one photo backdrop that
          fades gently all the way past the filter bar, so the image
          dissolves under the top of the card grid instead of stopping
          abruptly. Same treatment on mobile (no separate mobile variant). */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/assets/images/dashboard_players.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Light at the top (photo mostly visible), gradually settling to
            the page background well past the filter bar. */}
        <div className="absolute inset-0 bg-linear-to-b from-background/0 from-0% via-background/20 via-75% to-background to-100% z-10" />

        <div className="relative min-h-[26vh] md:min-h-[32vh] lg:min-h-[36vh] flex items-center justify-start">
          <div className="relative z-20 container mx-auto px-4 text-left mt-16 md:mt-20">
            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 backdrop-blur-md mb-3 md:mb-6">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wider uppercase text-white">
                  Find Best Player
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-2 md:mb-6 tracking-tight text-white drop-shadow-md">
                Find Your <span className="text-primary relative inline-block">
                  Player
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                  </svg>
                </span>
              </h1>
              <p className="text-base
                sm:text-lg
                md:text-2xl
                text-white/85
                max-w-2xl
                font-normal
                leading-snug
                md:leading-relaxed
                drop-shadow-sm">
                Connect with partners for games, join local matches, and expand your tennis network.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Filter Bar — floats over the tail of the photo instead of a
            solid block below it */}
        <div className="relative z-20 pb-24 md:pb-36">
          <div className="container mx-auto px-2 mt-0 mb-3 md:mb-6">
            <div
              className="
                bg-card/90
                backdrop-blur-md
                border border-border/40
                shadow-lg
                rounded-2xl
                p-2.5 md:p-4
              "
            >
              <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center justify-between">

                <div className="relative w-full md:w-80 lg:w-96 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />

                  <Input
                    placeholder="Search by name or location..."
                    className="
                      pl-9 md:pl-10
                      h-9 md:h-11
                      text-sm
                      rounded-xl
                      bg-background
                    "
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex w-full md:w-auto gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide">
                  {["Beginner", "Intermediate", "Advanced"].map((level) => (
                    <button
                      key={level}
                      onClick={() =>
                        setFilterLevel(filterLevel === level ? "" : level)
                      }
                      className={`
                        h-8 md:h-11
                        px-3 md:px-4
                        rounded-full
                        text-xs md:text-sm
                        font-medium
                        whitespace-nowrap
                        transition-all
                        border
                        cursor-pointer
                        ${
                          filterLevel === level
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input hover:border-primary/50"
                        }
                      `}
                    >
                      {level}
                    </button>
                  ))}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Partners Grid — pulled up slightly so the photo's fade visibly
          dissolves under the top of the first card row */}
      <div className="relative z-30 container mx-auto px-4 py-4 -mt-20 md:-mt-28 scroll-mt-24"
      ref={playersSectionRef}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredPartners.map((partner, index) => {

            const isMe =
              isAuthenticated &&
              !partner.isDemo &&
              user?.slug === partner.slug;

            return (
              <motion.div
                key={partner.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full
                    flex
                    flex-col
                    overflow-hidden
                    border-border/50
                    hover:shadow-xl
                    hover:-translate-y-1
                    transition-all
                    duration-300
                    group">
                  
                  <CardContent className="p-2 md:p-6 grow flex flex-col items-center text-center">
                  <div className="relative w-full h-36 sm:h-44 md:h-56 mb-4 overflow-hidden rounded-xl">
                    <img
                      src={
                        isMe && user?.avatar
                          ? user.avatar
                          : partner.avatar
                      }
                      alt={partner.name}
                      className="
                        w-full
                        h-full
                        object-cover
                        object-center
                        transition-transform
                        duration-300
                        group-hover:scale-105
                      "
                    />

                    {isMe && (
                      <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground z-10">
                        You
                      </Badge>
                    )}
                  </div>

                    <h3 className="text-sm md:text-lg font-bold mb-2 line-clamp-1">{partner.name}</h3>

                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1 md:mb-2">
                      <MapPin className="w-3 h-3" /> {partner.location}
                    </div>

                    <Badge variant="secondary" className="mb-1 md:mb-3 text-xs">
                      <Activity className="w-3 h-3 mr-1" />
                      {partner.skillLevel}
                    </Badge>

                    <p className="hidden
                        md:block
                        text-sm
                        text-muted-foreground
                        line-clamp-2
                        min-h-[40px]
                        mb-4">
                    {partner.bio}
                    </p>
                  </CardContent>

                  <CardFooter className="p-2 md:p-4 pt-0 grid grid-cols-2 gap-3">
                    <Link
                      href={
                        partner.isDemo
                          ? "/auth"
                          : isMe
                          ? `/${user.role}/${user.slug}`
                          : `/player/${partner.slug}`
                      }
                    >
                      <Button
                        variant="outline"
                        className="
                          w-full
                          h-9
                          font-bold
                          cursor-pointer
                        "
                      >
                        <User className="w-4 h-4" />

                        <span className="hidden sm:inline ml-1">
                          Profile
                        </span>
                      </Button>
                    </Link>

                    {!isMe && (
                      <Button
                      className="
                        w-full
                        h-9
                        bg-primary
                        text-primary-foreground
                        hover:bg-primary/90
                        cursor-pointer
                      "
                      onClick={() => openMessageModal(partner)}
                    >
                      <MessageCircle className="w-4 h-4" />
                    
                      <span className="hidden sm:inline ml-1">
                        Message
                      </span>
                    </Button>
                    )}
                  </CardFooter>

                </Card>
              </motion.div>
            );
          })}

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
     
        <AppPagination
          currentPage={page}
          totalPages={pagination?.totalPages ?? 1}
          onPageChange={handlePageChange}
        />

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
   </>
  );
}
