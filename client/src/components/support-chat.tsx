import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'support';
  timestamp: Date;
}

const SUPPORT_AGENT = {
  name: "Sarah from Support",
  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
  initialMessage: "Hi there! 👋 Welcome to TennisConnect. How can I help you find a coach or improve your game today?"
};

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: SUPPORT_AGENT.initialMessage,
      sender: 'support',
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate response delay
    setTimeout(() => {
      const responseText = getAutomatedResponse(userMessage.text);
      const supportMessage: Message = {
        id: messages.length + 2,
        text: responseText,
        sender: 'support',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, supportMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const getAutomatedResponse = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("coach") || lowerText.includes("find")) return "You can browse our top coaches on the 'Coaches' page. Use the filters to find someone in your area!";
    if (lowerText.includes("price") || lowerText.includes("cost")) return "Coach rates typically range from $60 to $120 per hour depending on their experience and location.";
    if (lowerText.includes("location") || lowerText.includes("where")) return "We have coaches across Sydney! Check the map view or search by suburb to find one near you.";
    if (lowerText.includes("booking") || lowerText.includes("book")) return "To book a session, simply visit a coach's profile and click the 'Contact Coach' or 'Book Practice' button.";
    return "Thanks for your message! A real support agent will be with you shortly. In the meantime, feel free to browse our FAQ section.";
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
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
                    <Avatar className="h-10 w-10 border-2 border-white/20">
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
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex w-full",
                          msg.sender === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                            msg.sender === 'user'
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-muted text-foreground rounded-bl-none"
                          )}
                        >
                          {msg.text}
                          <span className={cn(
                            "text-[10px] block mt-1 opacity-70",
                            msg.sender === 'user' ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-none">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"></span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
                <div className="p-3 border-t bg-muted/10">
                  <form 
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type a message..."
                      className="rounded-full bg-background border-muted-foreground/20 focus-visible:ring-primary"
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      className="rounded-full bg-primary text-primary-foreground shadow-sm h-10 w-10 shrink-0"
                      disabled={!inputValue.trim()}
                    >
                      <Send className="h-4 w-4 ml-0.5" />
                    </Button>
                  </form>
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
            className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-105"
          >
            <MessageCircle className="h-7 w-7" />
            <span className="sr-only">Open Support Chat</span>
          </Button>
        )}
      </div>
    </div>
  );
}
