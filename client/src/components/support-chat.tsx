import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Minus, Lock, UserRound, Users, Building2, Handshake, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supportSchema } from "@/lib/validations/support";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";

const SUPPORT_AGENT = {
  name: "Nataliia from Support",
  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
};
const SUPPORT_CATEGORIES = [
  {
    id: "account",
    label: "Account & Login Issues",
    icon: Lock,
  },
  /* {
    id: "coach",
    label: "Help Finding a Coach",
    icon: UserRound,
  },
  {
    id: "partner",
    label: "Help Finding a Tennis Player",
    icon: Users,
  }, */
  {
    id: "join-coach",
    label: "Join as a Coach",
    icon: UserRound,
  },
  {
    id: "club",
    label: "Become a Club Partner",
    icon: Building2,
  },
  {
    id: "partnership",
    label: "Partnership Opportunities",
    icon: Handshake,
  },
  {
    id: "bug",
    label: "Report a Problem",
    icon: Bug,
  },
  {
    id: "support",
    label: "General Support",
    icon: MessageCircle,
  },
];

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  // The fixed mobile bottom nav only renders when logged in and off /auth - lift the launcher above it so it doesn't overlap
  const hasMobileBottomNav = isAuthenticated && location !== "/auth";

  useEffect(() => {
    const handleOpenChat = () => {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    
      setTimeout(() => {
        setIsOpen(true);
        setIsMinimized(false);
      }, 300);
    };
  
    window.addEventListener(
      "open-support-chat",
      handleOpenChat
    );
  
    return () => {
      window.removeEventListener(
        "open-support-chat",
        handleOpenChat
      );
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen ]);

  // The maintenance page has its own social-links footer sitting in this
  // exact bottom-right corner - showing the chat bubble there overlaps it.
  // A "we're down for maintenance" page also isn't a place a live support
  // widget makes much sense on anyway (backend may well be part of what's
  // down), so it's simplest to just not render it there at all.
  if (location === "/maintenance") {
    return null;
  }

  return (
    <div
      className={`fixed right-4 md:right-6 z-40 flex flex-col items-end pointer-events-none ${
        hasMobileBottomNav ? "bottom-24 md:bottom-6" : "bottom-6"
      }`}
      data-testid="support-chat-launcher-wrapper"
    >
      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 pointer-events-auto origin-bottom-right"
          >
            <Card className="w-[350px] md:w-[380px] shadow-2xl border-primary/20 overflow-hidden">
              <CardHeader className="bg-primary p-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar  className="h-10 w-10 border-2 border-white/20">
                      <AvatarImage src={SUPPORT_AGENT.avatar} />
                      <AvatarFallback>S</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-primary rounded-full"></span>
                  </div>
                  <div>
                    <CardTitle className="text-primary-foreground text-base">TennisConnect Support</CardTitle>
                    <p className="text-primary-foreground/80 text-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                      Online Now
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10 rounded-full"
                    onClick={() => setIsMinimized(true)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10 rounded-full"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-background">
                <ScrollArea className="h-[350px] p-4">
                <div className="space-y-4">
                    {!selectedCategory && !submitted && (
                      <>
                        <div className="bg-muted rounded-xl p-4 text-sm">
                          Welcome to TennisConnect, How can we help today?
                        </div>

                        <div className="space-y-2">
                        {SUPPORT_CATEGORIES.map((category) => {
                            const Icon = category.icon;

                            return (
                              <Button
                                key={category.id}
                                variant="outline"
                                className="w-full justify-start gap-3"
                                onClick={() => setSelectedCategory(category.label)}
                              >
                                <Icon className="h-4 w-4 text-primary" />
                                {category.label}
                              </Button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {selectedCategory && !submitted && (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">
                          {selectedCategory}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto"
                          onClick={() => setSelectedCategory(null)}
                        >
                          ← Back to Categories
                        </Button>
                        <Input
                          placeholder="Name *"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              name: e.target.value,
                            })
                          }
                        />
                        <Input
                          placeholder="Email *"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              email: e.target.value,
                            })
                          }
                        />
                        <Input
                          placeholder="Phone"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              phone: e.target.value,
                            })
                          }
                        />

                        <textarea
                          className="w-full min-h-[120px] border rounded-md p-3 text-sm"
                          placeholder="Tell us how we can help..."
                          value={formData.message}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              message: e.target.value,
                            })
                          }
                        />

                      <Button
                        className="w-full"
                        onClick={async () => {

                          const validation = supportSchema.safeParse({
                            category: selectedCategory,
                            name: formData.name,
                            email: formData.email,
                            phone: formData.phone,
                            message: formData.message,
                          });
                          
                          if (!validation.success) {
                            toast({
                              variant: "destructive",
                              title: "Validation Error",
                              description: validation.error.errors[0].message,
                            });

                            return;
                          }

                          try {
                            const response = await fetch("/api/support", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                category: selectedCategory,
                                name: formData.name,
                                email: formData.email,
                                phone: formData.phone,
                                message: formData.message,
                              }),
                            });

                            if (!response.ok) {
                              throw new Error("Failed to submit request");
                            }

                            setSubmitted(true);
                          } catch (error) {
                            console.error(error);
                            toast({
                            variant: "destructive",
                            title: "Validation Error",
                            description: "Please try again later.",
                          });
                          }
                        }}
                      >
                        Submit Request
                      </Button>
                      </div>
                    )}

                    {submitted && (
                      <div className="text-center py-8">
                        <div className="text-lg font-semibold mb-2">
                          Thank You
                        </div>

                        <p className="text-sm text-muted-foreground">
                          Your request has been received.
                          Our team will get back to you shortly.
                        </p>

                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => {
                            setSubmitted(false);
                            setSelectedCategory(null);

                            setFormData({
                              name: "",
                              email: "",
                              phone: "",
                              message: "",
                            });
                          }}
                        >
                          New Request
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t bg-muted/10">
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto relative group">
        {(!isOpen || isMinimized) && (
          <Button
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            size="lg"
            className="h-[52px] w-[52px] md:h-14 md:w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-105"
          >
            <MessageCircle className="md:hidden" style={{ width: 24, height: 24 }} />
            <MessageCircle className="hidden md:block" style={{ width: 28, height: 28 }} />
            <span className="sr-only">Open Support Chat</span>
          </Button>
        )}
      </div>
    </div>
  );
}
