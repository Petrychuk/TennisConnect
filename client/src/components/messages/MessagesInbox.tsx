import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailOpen, Trash2, Clock, User, ArrowLeft, Reply, Send, X, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
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

  messageType?: "community_invite" | "session_invite" | null;
  relatedSessionId?: string | null;
  relatedOrganizationId?: string | null;
  actionStatus?: "pending" | "accepted" | "declined" | null;
}

// The actual inbox+conversation UI, shared between the standalone
// /messages page (wrapped in Navbar/Footer) and the Organiser Hub's
// own /organiser/messages (wrapped in the Hub's own dark sidebar
// layout instead) - same data, same component, two different frames
// around it, so there's exactly one messaging experience rather than
// two that could drift apart.
export function MessagesInbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const { user, isAuthenticated, loading: authLoading, } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
  
        const firstConversationId = firstMessage.conversationId || firstMessage.id;
        await loadConversation(firstConversationId);
  
        await handleMarkConversationAsRead(firstConversationId);
  
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

  // Opening a conversation clears every unread message in it, not just
  // the single representative row the inbox list shows - otherwise the
  // unread badge stays inflated by messages the viewer never actually
  // sees marked individually.
  const handleMarkConversationAsRead = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messages/conversation/${conversationId}/read`, {
        method: "PUT",
        credentials: "include",
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => ((m.conversationId || m.id) === conversationId ? { ...m, isRead: true } : m))
        );
        setConversation((prev) => prev.map((m) => ({ ...m, isRead: true })));
        queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      }
    } catch (error) {
      console.error("Failed to mark conversation as read:", error);
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

  const [respondingId, setRespondingId] = useState<string | null>(null);

  const handleRespond = async (message: Message, action: "accept" | "decline") => {
    setRespondingId(message.id);
    try {
      const res = await fetch(`/api/messages/${message.id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to respond");
      }
      const updated = await res.json();
      setConversation((prev) => prev.map((m) => (m.id === message.id ? { ...m, actionStatus: updated.actionStatus } : m)));
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, actionStatus: updated.actionStatus } : m)));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Couldn't respond",
        description: error?.message ?? "Please try again.",
      });
    } finally {
      setRespondingId(null);
    }
  };

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

    const conversationId = message.conversationId || message.id;
    await loadConversation(conversationId);

    await handleMarkConversationAsRead(conversationId);
  };

  if (!isAuthenticated) {
    return (
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
    );
  }
  
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }
  return(
   <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold font-display" data-testid="text-page-title">Messages</h1>
          </div>

          {messagesLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !selectedMessage ? (
              <Card className="max-w-md mx-auto" data-testid="messages-empty-state">
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
                          data-testid="unread-badge"
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
                        <div className="flex items-start justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="lg:hidden shrink-0"
                              onClick={() => {
                                setMobileView("list");
                              }}
                            >
                              <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <Avatar className="h-10 w-10 lg:h-12 lg:w-12 shrink-0">
                              <AvatarImage
                                src={selectedMessage.senderAvatar || undefined}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {selectedMessage.senderName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <CardTitle className="text-lg truncate">{selectedMessage.senderName}</CardTitle>
                              <p className="text-sm text-muted-foreground truncate">{selectedMessage.senderEmail}</p>
                              {selectedMessage.senderPhone && (
                                <p className="text-sm text-muted-foreground truncate">{selectedMessage.senderPhone}</p>
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

                                  {msg.messageType && msg.actionStatus === "pending" && !isMe && (
                                    <div className="flex gap-2 mt-2" data-testid={`invitation-actions-${msg.id}`}>
                                      <Button
                                        size="sm"
                                        onClick={() => handleRespond(msg, "accept")}
                                        disabled={respondingId === msg.id}
                                        data-testid={`invitation-accept-${msg.id}`}
                                      >
                                        {msg.messageType === "community_invite" ? "Accept invitation" : "Join session"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRespond(msg, "decline")}
                                        disabled={respondingId === msg.id}
                                        data-testid={`invitation-decline-${msg.id}`}
                                      >
                                        Decline
                                      </Button>
                                    </div>
                                  )}

                                  {msg.messageType && msg.actionStatus === "accepted" && (
                                    <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2" data-testid={`invitation-status-${msg.id}`}>
                                      <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                                        <Check className="w-4 h-4" />
                                        {msg.messageType === "community_invite" ? "Invitation accepted" : "You're joining this session"}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {msg.messageType === "community_invite"
                                          ? "You are now a member of this tennis community."
                                          : "It's now in your Upcoming Sessions."}
                                      </p>
                                    </div>
                                  )}

                                  {msg.messageType && msg.actionStatus === "declined" && (
                                    <div className="mt-2 rounded-xl border border-border bg-muted/50 px-3 py-2" data-testid={`invitation-status-${msg.id}`}>
                                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                        <X className="w-4 h-4" />
                                        Invitation declined
                                      </p>
                                    </div>
                                  )}

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
                        {!showReplyForm && !conversation.some((m) => m.messageType && m.actionStatus === "pending") && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-6">
                            <Button
                              onClick={() => setShowReplyForm(true)}
                              data-testid="button-reply"
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
                              data-testid="textarea-reply"
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
                                data-testid="button-send-reply"
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
    </> 
  );
} 
