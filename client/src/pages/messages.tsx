import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { useMutation} from "@tanstack/react-query";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailOpen, Trash2, Clock, User, ArrowLeft, Reply, Send, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
import SEO from "@/components/seo";
import { replySchema } from "@/lib/validations/messages";

interface Message {
  id: string;

  parentMessageId?: string | null;
  conversationId?: string | null;

  recipientId: string;
  recipientType: string;

  senderUserId: string | null;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;

  subject: string | null;
  senderAvatar?: string | null;

  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const { user, isAuthenticated, loading: authLoading, } = useAuth();
  const { toast } = useToast();
  
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);

  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const selectedMessageRef = useRef<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };

  useEffect(() => {
    selectedMessageRef.current =
      selectedMessage;
  }, [selectedMessage]);

  useEffect(() => {
    if (!isAuthenticated) return;
  
    fetchMessages();
  
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
  
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (
      messages.length > 0 &&
      selectedMessage === null
    ) {
      selectMessage(messages[0]);
    }
  }, [messages.length]);
  
  useEffect(() => {
    scrollToBottom();
  }, [conversation.length]);

  const uniqueConversations = Array.from(
    new Map(
      [...messages]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        )
        .map((message) => [
          message.conversationId || message.id,
          message,
        ])
    ).values()
  );

  const replyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        "/api/messages/reply",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            originalMessageId: selectedMessage?.id,
            content: replyContent,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to send reply");
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Reply sent",
        description:
          "Your message has been sent successfully.",
      });
    
      setReplyContent("");
      setShowReplyForm(false);
    
      await fetchMessages();

      if (selectedMessage) {
        await loadConversation(
          selectedMessage.conversationId ||
          selectedMessage.id
        );
      }
      setTimeout(() => {
        scrollToBottom();
      }, 150);
    },

    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send reply.",
        variant: "destructive",
      });
    },
  });

  const handleReply = () => {
    if (!replyContent.trim()) {
      return;
    }
    
    const result = replySchema.safeParse({
      content: replyContent,
    });
    
    if (!result.success) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: result.error.errors[0].message,
      });
    
      return;
    } 
    
    replyMutation.mutate();
  };

  const fetchMessages = async () => {
    console.log(
      "FETCH REF:",
      selectedMessageRef.current?.senderName
    );
  
    try {
      const res = await fetch(
        "/api/messages/conversations",
        {
          credentials: "include",
        }
      );
  
      if (!res.ok) {
        throw new Error(
          `Failed to fetch messages: ${res.status}`
        );
      }
  
      const data = await res.json();
  
      setMessages(data);
  
      // Первый вход на страницу
      if (
        data.length > 0 &&
        selectedMessageRef.current === null
      ) {
        const firstMessage = data[0];
  
        setSelectedMessage(firstMessage);
  
        await loadConversation(
          firstMessage.conversationId ||
          firstMessage.id
        );
  
        if (!firstMessage.isRead) {
          await handleMarkAsRead(
            firstMessage.id
          );
        }
  
        return;
      }
  
      // Обновляем только текущий открытый чат
      const currentSelected =
        selectedMessageRef.current;
  
      if (currentSelected) {
        const conversationId =
          currentSelected.conversationId ||
          currentSelected.id;
  
        await loadConversation(
          conversationId
        );
      }
    } catch (error) {
      console.error(
        "Failed to fetch messages:",
        error
      );
    } finally {
      setMessagesLoading(false);
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
          title: "Conversation deleted",
          description: "All messages in this conversation have been removed.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  /* const remainingMessages = messages.filter(
    (m) => m.id !== messageId
  );
  
  setMessages(remainingMessages);
  
  if (selectedMessage?.id === messageId) {
    setSelectedMessage(
      remainingMessages.length > 0
        ? remainingMessages[0]
        : null
    );
  } */

  const loadConversation = async (
    conversationId: string
  ) => {
    try {
      const res = await fetch(
        `/api/messages/conversation/${conversationId}`,
        {
          credentials: "include",
        }
      );
  
      if (!res.ok) return;
  
      const data = await res.json();
  
      setConversation(data);
    } catch (error) {
      console.error(
        "Failed to load conversation:",
        error
      );
    }
  };

  const selectMessage = async (
    message: Message
  ) => {
    console.log(
      "CLICKED:",
      message.senderName,
      new Date().toISOString()
    );
    setSelectedMessage(message);
    
    // мобильный режим
    if (window.innerWidth < 1024) {
      setMobileView("chat");
    }

    await loadConversation(
      message.conversationId ||
      message.id
    );

    if (!message.isRead) {
      await handleMarkAsRead(
        message.id
      );
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
  
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
  
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        </div>
  
        <Footer />
      </div>
    );
  }
  return(
   <>
    <SEO
      title="Messages | TennisConnect"
      description="Private messages."
      canonical="/messages"
      noIndex
    />
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-display" data-testid="text-page-title">Messages</h1>
          </div>

          {messagesLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !selectedMessage ? (
              <Card className="max-w-md mx-auto">
                <CardContent className="pt-6 text-center">
                  <MailOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-xl font-bold mb-2">
                    No messages yet
                  </h2>
                  <p className="text-muted-foreground">
                    When someone sends you a message, it will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Message List */}
              {(mobileView === "list" || window.innerWidth >= 1024) && (
                  
                <Card className="lg:col-span-1">
                                
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Mail className="w-5 h-5" />

                      Inbox

                      {messages.filter((m) => !m.isRead).length > 0 && (
                        <Badge
                          variant="destructive"
                          className="ml-auto"
                        >
                          {messages.filter((m) => !m.isRead).length} new
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  
                  <div className="h-px w-full bg-linear-to-r from-transparent via-[hsl(var(--tennis-ball))] to-transparent" />
                  <ScrollArea             
                    className="
                      h-[52vh]"
                      onWheel={(e) => e.stopPropagation()}
                    
                  >
                    
                    <div className="p-2">
                      <AnimatePresence>
                        {uniqueConversations.map((message) => (
                          <motion.div
                            key={message.conversationId || message.id}
                            animate={{ opacity: 1, x: 0 }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                selectMessage(message);
                              }}
                              className={`
                                w-full
                                text-left
                                p-3
                                rounded-xl
                                transition-all
                                duration-200
                                mb-2
                                cursor-pointer

                                ${
                                  selectedMessage?.conversationId ===
                                    message.conversationId ||
                                  selectedMessage?.id === message.id
                                    ? "bg-primary/10 border border-primary/20 shadow-sm"
                                    : message.isRead
                                    ? "hover:bg-muted/50"
                                    : "bg-muted hover:bg-muted/80"
                                }
                              `}
                              data-testid={`message-item-${message.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10 shrink-0 border">
                                  <AvatarImage
                                    src={message.senderAvatar || undefined}
                                  />

                                  <AvatarFallback
                                    className={
                                      !message.isRead
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-primary/10 text-primary"
                                    }
                                  >
                                    {message.senderName?.[0]}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p
                                      className={`
                                        truncate
                                        ${
                                          !message.isRead
                                            ? "font-semibold"
                                            : "font-medium"
                                        }
                                      `}
                                    >
                                      {message.senderName}
                                    </p>

                                    {!message.isRead && (
                                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                                    )}
                                  </div>

                                  <p className="text-sm text-muted-foreground line-clamp-2 wrap-break-word mt-0.5">
                                    {message.content}
                                  </p>

                                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(
                                      new Date(message.createdAt),
                                      "MMM d, h:mm a"
                                    )}
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
              )}
              {/* Message Detail */}
              {(mobileView === "chat" || window.innerWidth >= 1024) && (
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
                              onClick={() => {
                                setMobileView("list");
                              }}
                            >
                              <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <Avatar className="h-12 w-12">
                              <AvatarImage
                                src={selectedMessage.senderAvatar || undefined}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {selectedMessage.senderName?.[0]}
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
                          {/*  {selectedMessage.senderUserId && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Registered User
                              </Badge>
                            )} */}
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
                      <Separator className="h-px w-full bg-linear-to-r from-transparent via-[hsl(var(--tennis-ball))] to-transparent my-4" />
                      <CardContent className="pt-4">
                      <ScrollArea
                          className="h-[45vh] pr-4"
                          type="always"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-4 pr-2">
                            {conversation.map((msg) => {
                            const isMe = msg.senderUserId === user?.id;

                            return (
                              <div key={msg.id} className="flex gap-3 w-full">
                                <Avatar className="h-10 w-10 shrink-0 ml-1">
                                  <AvatarImage
                                    src={msg.senderAvatar || undefined}
                                    alt={msg.senderName}
                                  />
                                  <AvatarFallback className="bg-primary/10 text-primary">
                                    {msg.senderName?.charAt(0)?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                  <div
                                    className={`text-xs mb-1 px-1 ${
                                      isMe
                                        ? "text-right text-muted-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {msg.senderName}
                                  </div>

                                  <div
                                    className={`
                                      w-full rounded-2xl px-4 py-3 shadow-sm transition-all
                                      ${
                                        isMe
                                          ? "bg-primary/5 border border-primary/20"
                                          : "bg-muted"
                                      }
                                    `}
                                  >
                                    <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                                      {msg.content}
                                    </p>
                                  </div>

                                  <div
                                    className={`mt-1 text-xs text-muted-foreground px-1 ${
                                      isMe ? "text-right" : ""
                                    }`}
                                  >
                                    {format(
                                      new Date(msg.createdAt),
                                      "MMM d, h:mm a"
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        <div ref={messagesEndRef} /> 
                        </div>
                      </ScrollArea>

                        <Separator className="h-px w-full bg-linear-to-r from-transparent via-[hsl(var(--tennis-ball))] to-transparent my-4" />                    
                        {!showReplyForm && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-6">
                            <Button
                              onClick={() => setShowReplyForm(true)}
                            >
                              <Reply className="w-4 h-4 mr-2" />
                              Reply
                            </Button>

                            <Button
                              variant="outline"
                              onClick={() => {
                                window.location.href = `mailto:${selectedMessage.senderEmail}`;
                              }}
                              data-testid="button-reply-email"
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Reply via Email
                            </Button>
                          </div>
                        )}
                        {showReplyForm && (
                          <div className="mt-6 pt-6 space-y-4">
                            <Textarea
                              value={replyContent}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setReplyContent(e.target.value)
                              }
                              placeholder="Type your reply..."
                              rows={1}
                              maxLength={1000}
                            />

                            <div className="grid grid-cols-2 gap-2">
                            <Button
                                onClick={handleReply}
                                disabled={
                                  !replyContent.trim() ||
                                  replyMutation.isPending
                                }
                              >
                                <Send className="w-4 h-4 mr-2" />
                                {replyMutation.isPending
                                  ? "Sending..."
                                  : "Send Reply"}
                              </Button>

                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowReplyForm(false);
                                  setReplyContent("");
                                }}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>

                            </div>
                          </div>
                        )}
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
              )}
            </div>
          )}
        </div>

        <Footer />
      </div>
    </> 
  );
} 
