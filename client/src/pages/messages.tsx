import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailOpen, Trash2, Clock, User, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";

interface Message {
  id: string;
  recipientId: string;
  recipientType: string;
  senderUserId: string | null;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  subject: string | null;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      fetchMessages();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/read`, {
        method: "PUT",
      });
      if (res.ok) {
        setMessages(messages.map(m => 
          m.id === messageId ? { ...m, isRead: true } : m
        ));
      }
    } catch (error) {
      console.error("Failed to mark message as read:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages(messages.filter(m => m.id !== messageId));
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null);
        }
        toast({
          title: "Message deleted",
          description: "The message has been removed from your inbox.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const selectMessage = (message: Message) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      handleMarkAsRead(message.id);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">Sign in to view messages</h2>
              <p className="text-muted-foreground mb-4">
                You need to be signed in to access your inbox.
              </p>
              <Link href="/auth">
                <Button className="bg-primary text-primary-foreground">
                  Sign In
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display" data-testid="text-page-title">Messages</h1>
          <p className="text-muted-foreground">
            View and manage messages from players and coaches
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : messages.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <MailOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">No messages yet</h2>
              <p className="text-muted-foreground">
                When someone sends you a message, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Message List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Inbox
                  {messages.filter(m => !m.isRead).length > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      {messages.filter(m => !m.isRead).length} new
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <Separator />
              <ScrollArea className="h-[500px]">
                <div className="p-2">
                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        <button
                          onClick={() => selectMessage(message)}
                          className={`w-full text-left p-3 rounded-lg transition-colors mb-2 cursor-pointer ${
                            selectedMessage?.id === message.id
                              ? "bg-primary/10 border border-primary/20"
                              : message.isRead
                              ? "hover:bg-muted/50"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                          data-testid={`message-item-${message.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className={!message.isRead ? "bg-primary text-primary-foreground" : ""}>
                                {message.senderName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-medium truncate ${!message.isRead ? "font-bold" : ""}`}>
                                  {message.senderName}
                                </p>
                                {!message.isRead && (
                                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {message.subject || "No subject"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(message.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </Card>

            {/* Message Detail */}
            <Card className="lg:col-span-2">
              {selectedMessage ? (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="lg:hidden"
                          onClick={() => setSelectedMessage(null)}
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {selectedMessage.senderName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{selectedMessage.senderName}</CardTitle>
                          <p className="text-sm text-muted-foreground">{selectedMessage.senderEmail}</p>
                          {selectedMessage.senderPhone && (
                            <p className="text-sm text-muted-foreground">{selectedMessage.senderPhone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedMessage.senderUserId && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Registered User
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                          data-testid="button-delete-message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-4">
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-1">Subject</p>
                      <p className="font-medium">{selectedMessage.subject || "No subject"}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-1">Received</p>
                      <p className="text-sm">
                        {format(new Date(selectedMessage.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Separator className="my-4" />
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t">
                      <Button
                        className="bg-primary text-primary-foreground"
                        onClick={() => {
                          window.location.href = `mailto:${selectedMessage.senderEmail}`;
                        }}
                        data-testid="button-reply-email"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Reply via Email
                      </Button>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-[500px]">
                  <div className="text-center text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a message to view its contents</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
