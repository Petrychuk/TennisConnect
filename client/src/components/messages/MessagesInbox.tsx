import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailOpen, Trash2, ArrowLeft, Reply, Send, X, Check } from "lucide-react";
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

  // Who a conversation-LIST row is "with" - always the other
  // participant, even when the current user sent the most recent
  // message in the thread. Only present on rows from
  // /api/messages/conversations; individual message bubbles inside an
  // open thread keep using senderName/senderAvatar, which correctly
  // describe who sent that specific message.
  otherPartyName?: string;
  otherPartyAvatar?: string | null;

  content: string;
  isRead: boolean;
  createdAt: string;

  messageType?: "community_invite" | "session_invite" | null;
  relatedSessionId?: string | null;
  relatedOrganizationId?: string | null;
  actionStatus?: "pending" | "accepted" | "declined" | null;
}

// A conversation-list row (or the detail header above an open thread)
// should always show the OTHER participant, whether the current
// viewer sent the most recent message in it or received it - senderName/
// senderAvatar alone would show the viewer's own identity for a
// conversation they started that hasn't been replied to yet. Falls
// back to sender fields for rows from before otherParty existed.
function conversationPartner(message: Message) {
  return {
    name: message.otherPartyName ?? message.senderName,
    avatar: message.otherPartyAvatar ?? message.senderAvatar,
  };
}

// The stored avatar URL doesn't change when someone re-uploads their
// photo (it's the same file path, just new bytes behind it - see the
// upload flow's own note about this), so the browser can keep serving
// whatever it cached for that URL from before the change. Other pages
// (the players/coaches listing) already work around this with a fresh
// cache-buster on every fetch; messaging polls every 3s though, so
// busting on every render/poll would re-download every visible
// avatar that often. One timestamp captured when the inbox mounts is
// enough to guarantee a reload picks up a since-changed avatar,
// without re-fetching on every 3s poll in between.
function useAvatarCacheBust() {
  const stamp = useRef(Date.now()).current;
  return (avatar?: string | null) => (avatar ? `${avatar}?t=${stamp}` : undefined);
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
  const withCacheBust = useAvatarCacheBust();
  
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
    // Let the browser finish laying out the newly-rendered messages
    // before measuring where "the bottom" actually is - scrolling on
    // the same tick React committed the DOM can land short when the
    // conversation is long.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedMessage?.conversationId, selectedMessage?.id, conversation.length]);

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
          <div className="mb-3 md:mb-5">
            <h1 className="text-xl md:text-2xl font-bold font-display" data-testid="text-page-title">Messages</h1>
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
                        {uniqueConversations.map((message) => {
                          const partner = conversationPartner(message);
                          const isSelected =
                            selectedMessage?.conversationId === message.conversationId ||
                            selectedMessage?.id === message.id;
                          return (
                          <motion.div
                            key={message.conversationId || message.id}
                            animate={{ opacity: 1, x: 0 }}
                            className={`
                              group relative flex items-center gap-1
                              rounded-xl transition-all duration-200 mb-1.5
                              ${
                                isSelected
                                  ? "bg-primary/10 border border-primary/20 shadow-sm"
                                  : message.isRead
                                  ? "hover:bg-muted/50"
                                  : "bg-muted hover:bg-muted/80"
                              }
                            `}
                          >
                            <button
                              type="button"
                              onClick={() => selectMessage(message)}
                              className="flex-1 min-w-0 flex items-center gap-3 text-left p-2.5 sm:p-3"
                              data-testid={`message-item-${message.id}`}
                            >
                              <div className="relative shrink-0">
                                <Avatar className="h-10 w-10 sm:h-11 sm:w-11 border">
                                  <AvatarImage
                                    src={withCacheBust(partner.avatar)}
                                  />
                                  <AvatarFallback
                                    className={
                                      !message.isRead
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-primary/10 text-primary"
                                    }
                                  >
                                    {partner.name?.[0]}
                                  </AvatarFallback>
                                </Avatar>

                                {/* Unread badge - a count doesn't exist per
                                    conversation (isRead is a single flag for
                                    the whole thread), so this is a presence
                                    dot rather than a number. */}
                                {!message.isRead && (
                                  <span
                                    className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background"
                                    data-testid={`message-item-unread-${message.id}`}
                                  />
                                )}
                              </div>

                              <p
                                className={`
                                  flex-1 min-w-0 truncate text-sm sm:text-base
                                  ${!message.isRead ? "font-semibold" : "font-medium"}
                                `}
                              >
                                {partner.name}
                              </p>
                            </button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Delete conversation with ${partner.name}`}
                                  className="
                                    shrink-0 mr-2 p-1.5 rounded-lg text-muted-foreground
                                    opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100
                                    hover:text-destructive hover:bg-destructive/10
                                    transition-all
                                  "
                                  data-testid={`message-item-delete-${message.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete your conversation with {partner.name}.
                                    This can't be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel data-testid={`message-item-delete-cancel-${message.id}`}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid={`message-item-delete-confirm-${message.id}`}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </Card>
              )}
              {/* Message Detail */}
              {(mobileView === "chat" || window.innerWidth >= 1024) && (
                <Card className="lg:col-span-2">
                  {selectedMessage ? (
                    (() => {
                      // The representative row (selectedMessage) might be
                      // one the current viewer sent themselves - its
                      // senderEmail would then be the viewer's own contact
                      // info, not the other person's. Look through the
                      // actually-loaded thread for a message the other
                      // person sent, and use their email from that
                      // instead (for the "Reply via Email" mailto target
                      // below - not displayed anywhere anymore). If
                      // nobody's replied yet, there simply isn't one.
                      const otherPartyMessage = conversation.find(
                        (m) => m.senderUserId !== user?.id
                      );
                      const otherPartyEmail = otherPartyMessage?.senderEmail;

                      return (
                    <>
                      {/* Compact - no avatar/email header (that's what the
                          list on the left already shows). Mobile only:
                          just enough to get back to the list and know
                          which thread this is. */}
                      <div className="lg:hidden flex items-center gap-2 p-2 border-b border-border">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMobileView("list")}
                          data-testid="button-back-to-list"
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <span className="font-semibold truncate">
                          {conversationPartner(selectedMessage).name}
                        </span>
                      </div>
                      <CardContent className="px-3 pt-3 pb-3 md:px-6 md:pb-6">
                      <ScrollArea
                          className="h-[52vh] pr-4"
                          type="always"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-3 pr-2">
                            {conversation.map((msg) => {
                            const isMe = msg.senderUserId === user?.id;

                            return (
                              <div
                                key={msg.id}
                                className={`flex gap-2 sm:gap-3 w-full ${isMe ? "flex-row-reverse" : ""}`}
                              >
                                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                                  <AvatarImage
                                    src={withCacheBust(msg.senderAvatar)}
                                    alt={msg.senderName}
                                  />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                                    {msg.senderName?.charAt(0)?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>

                                <div className={`flex-1 min-w-0 flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                  <div className="text-xs mb-1 px-1 text-muted-foreground">
                                    {msg.senderName}
                                  </div>

                                  <div
                                    className={`
                                      max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 md:px-4 md:py-3 shadow-sm transition-all
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

                                  <div className="mt-1 text-xs text-muted-foreground px-1">
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

                        <Separator className="h-px w-full bg-linear-to-r from-transparent via-[hsl(var(--tennis-ball))] to-transparent my-3" />                    
                        {!showReplyForm && !conversation.some((m) => m.messageType && m.actionStatus === "pending") && (
                          <div className="flex flex-row gap-2 mt-3">
                            <Button
                              className="flex-1 md:flex-none md:min-w-[160px] px-2 md:px-6"
                              onClick={() => setShowReplyForm(true)}
                              data-testid="button-reply"
                            >
                              <Reply className="w-4 h-4 mr-2 shrink-0" />
                              Reply
                            </Button>

                            {otherPartyEmail && (
                              <Button
                                variant="outline"
                                className="flex-1 md:flex-none md:min-w-[160px] px-2 md:px-6"
                                onClick={() => {
                                  window.location.href = `mailto:${otherPartyEmail}`;
                                }}
                                data-testid="button-reply-email"
                              >
                                <Mail className="w-4 h-4 mr-2 shrink-0" />
                                <span className="md:hidden">Email</span>
                                <span className="hidden md:inline">Reply via Email</span>
                              </Button>
                            )}
                          </div>
                        )}
                        {showReplyForm && (
                          <div className="mt-3 pt-3 space-y-4">
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
                      );
                    })()
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
