import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileCover } from "@/components/profile/shared/ProfileCover";
import { Skeleton } from "@/components/ui/skeleton";
import defaultPlayerCover from "/assets/images/default_player_cover.webp";
import defaultPlayerCoverMobile from "/assets/images/default_player_cover_mobile.webp";
import { PlayerHero } from "@/components/profile/player/PlayerHero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogDescription, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useLocation, useRoute, useSearch } from "wouter";
import { MapPin, Calendar, Trophy, Edit2, ShoppingBag, Plus, Trash2, Camera, Globe, Phone, Mail, MessageCircle, Send, LogIn, User, ClipboardList, Users2, Heart, Award } from "lucide-react";
import { PARTNERS_DATA } from "@/lib/dummy-data";
import bgImage from "/assets/images/subtle_abstract_tennis-themed_background_with_lime_green_accents.webp";
import SEO from "@/components/seo";
import { Footer } from "@/components/footer";
import { BecomeOrganizerCard } from "@/components/profile/shared/BecomeOrganizerCard";
import { messageSchema } from "@/lib/validations/messages";
import { MySessionsSection } from "@/components/profile/shared/MySessionsSection";
import { MyClubsSection } from "@/components/profile/shared/MyClubsSection";
import { SetScoreBuilder, looksLikeSetScore, looksLikePoints } from "@/components/profile/shared/SetScoreBuilder";
import { MyOrganizedSessionsSection } from "@/components/profile/shared/MyOrganizedSessionsSection";
import { useOrganizerStatus } from "@/hooks/use-organizer-status";
import { TennisLoader } from "@/components/ui/tennisLoader";
import { uploadMedia } from "@/lib/uploadImage";
import { computeMatchScore, type MatchProfileInput } from "@/lib/matchScore";
import { QuickMessageModal } from "@/components/messaging/QuickMessageModal";
import {
  AboutMeCard,
  LookingForCard,
  PlayingPreferencesCard,
  PhotosCard,
  GoodMatchCard,
  AvailabilityQuickCard,
  LatestActivityCard,
  PlayerBottomCTA,
  type LookingForData,
  type PlayingPrefsData,
  type ActivityItem,
} from "@/components/profile/player/PlayerOverviewSections";

type MarketplaceDraft = {
  id: string;
  name: string;
  price: string;
  description: string;
  condition: string;
  location: string;
  photos: string[];
  files?: File[];
};

type TournamentDraft = {
  id: string;
  name: string;
  location: string;
  date: string;
  result: string;
  award: string;
  photos: string[];
  entryType: "session" | "tournament";
};

export type PlayerProfile = {
  name: string;
  location: string;
  age: string;
  country: string;
  skillLevel: string;
  bio: string;
  avatar?: string | null;
  cover?: string | null;
  createdAt?: string;
  preferredCourts: string[];
  photos?: string[];
  sex?: string;
  lookingFor?: string[];
  gameFormat?: string;
  playStyle?: string;
  availability?: string[];
  playRadiusKm?: number;
  courtSurfacePreference?: string;
  playingHand?: string;
  availabilityStatus?: string;
  coaches: number[];          
  marketplaceItems: any[];
  tournaments: any[];
  phone: string;
  email: string;
};

// Default Profile State
export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  name: "New Player",
  location: "Sydney, NSW",
  age: "25",
  country: "Australia",
  skillLevel: "Intermediate",
  bio: "Hi! I love tennis and I'm looking for partners to play with on weekends.",
  avatar: null,
  cover: null,
  preferredCourts: ["Bondi Beach", "Manly"],
  photos: [],
  sex: "",
  lookingFor: [],
  gameFormat: "",
  playStyle: "",
  availability: [],
  playRadiusKm: 15,
  courtSurfacePreference: "",
  playingHand: "",
  availabilityStatus: "",
  coaches: [1], // IDs of connected coaches
  marketplaceItems: [] as any[],
  tournaments: [] as any[],
  phone: "",
  email: "",
};

// The "main" type split inside My Sessions - everything else (social,
// americano, round-robin, etc.) falls under "Sessions", these two
// under "Tournaments". Kept as an explicit list rather than deriving
// it, since it's a genuinely small, stable set.
const TOURNAMENT_TYPES = ["tournament", "club-championship"];

const PRESET_RESULTS = ["Winner", "Runner Up", "Semi-Finalist", "Quarter-Finalist", "Round of 16", "Round of 32", "Participation"];

export default function PlayerProfile() {
  const [match, params] = useRoute("/player/:slug");
  const profileSlug = params?.slug; 
  const { user, isAuthenticated, loading: authLoading, updateUserProfile, updateUserLocal, fetchCurrentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const profileSearch = useSearch();
  const initialTabParams = new URLSearchParams(profileSearch);
  const initialTab = initialTabParams.has("joinSession")
    ? "organizing"
    : initialTabParams.get("tab") || "overview";

  const isOwnProfile = isAuthenticated && user?.slug === profileSlug; 
  const organizerStatus = useOrganizerStatus(isOwnProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [showPlayerPhone, setShowPlayerPhone] = useState(false);
  const [showPlayerEmail, setShowPlayerEmail] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [playerUserId, setPlayerUserId] = useState<string>("");

  // --- Profile redesign (2026) - Overview section state ---------------
  // About Me / Looking For / Playing Preferences / Photos now live on
  // `profile` itself (real, persisted fields - see saveProfileFields
  // below and the playerProfileUpdateSchema/player_profiles migration
  // that added them). Latest Activity stays mock per the spec (it's
  // meant to be auto-generated from real activity later, never
  // manually edited).
  const mockActivity: ActivityItem[] = [
    { icon: "session", label: "Joined a session", date: "Thu, 25 Sep" },
    { icon: "competition", label: "Played a competition", date: "Sun, 7 Sep" },
    { icon: "venue", label: "Visited a new venue", date: "Wed, 3 Sep" },
  ];
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageModalDefaultText, setMessageModalDefaultText] = useState("");
  const [viewerProfile, setViewerProfile] = useState<MatchProfileInput | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);
  const [originalProfile, setOriginalProfile] = useState<PlayerProfile>(DEFAULT_PLAYER_PROFILE);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileIsOrganizer, setProfileIsOrganizer] = useState(false);
  const showOrganisingTab = isOwnProfile
    ? !!user?.isOrganizer
    : profileIsOrganizer;
  
    // Tournament State
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [resultInputMode, setResultInputMode] = useState<"sets" | "points" | "text">("sets");
  const [resultsFilter, setResultsFilter] = useState<"all" | "session" | "tournament">("all");
  const [newTournament, setNewTournament] = useState<TournamentDraft>({
      id: "",
      name: "",
      location: "",
      date: "",
      result: "",
      award: "",
      photos: [],
      entryType: "tournament",
    });
  const [tournaments, setTournaments] = useState<TournamentDraft[]>([]);
  const [editingTournament, setEditingTournament] = useState<TournamentDraft | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  // True once we've confirmed there's genuinely no real profile to
  // show (fetch 404'd and no demo-data fallback matched either) - lets
  // the render branch show an honest "not available" message instead
  // of silently falling through to DEFAULT_PLAYER_PROFILE's
  // placeholder content as if it were this person's real profile.
  // True for someone else's real-but-incomplete profile (registered,
  // never finished "set up your profile") - lets the render show an
  // honest "still setting up their profile" note instead of quietly
  // presenting DEFAULT_PLAYER_PROFILE's specific placeholder values
  // as if they were this person's real choices.
  const [profileSetupIncomplete, setProfileSetupIncomplete] = useState(false);
  const [profileNotFound, setProfileNotFound] = useState(false);
  
  // Marketplace State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState<MarketplaceDraft>({
      id: "",
      name: "",
      price: "",
      description: "",
      condition: "Used - Good",
      location: "",
      photos: [],
      files: [],
    });
  const [marketplaceItems, setMarketplaceItems] = useState<any[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (isOwnProfile && user && !user.profileCompleted) {
      setLocation("/complete-profile");
    }
  }, [authLoading, isOwnProfile, user, setLocation]);

  // Fetches the VIEWER's own player profile so the Good Match card can
  // compute a real score against the profile being viewed (see
  // lib/matchScore.ts) - only needed when looking at someone else's
  // profile while logged in as a player.
  useEffect(() => {
    if (isOwnProfile || !user || user.role !== "player") {
      setViewerProfile(null);
      return;
    }
    let cancelled = false;
    fetch("/api/me/player-profile", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setViewerProfile(data);
      })
      .catch(() => {
        /* Good Match card just won't render if this fails - not worth surfacing an error for. */
      });
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user]);

   useEffect(() => {
    if (!profileSlug) return;

      const loadPublicProfile = async () => {
        try {
          setLoading(true);

          /* ===== PROFILE ===== */
          const res = await fetch(`/api/players/${profileSlug}`, {
            credentials: "include",
          });

          if (!res.ok) throw new Error("Not found");

          const data = await res.json();

          // The stored avatar/cover URL already has its own cache-buster
          // baked in from upload time (server/routes/uploadMedia.ts's
          // urlWithCacheBuster) - the upload path there is fixed
          // (players/<id>/avatar.webp, not a fresh filename per upload),
          // so a NEW upload needs a NEW query string for the browser to
          // notice it changed, and the server already does exactly
          // that once, at upload time. Appending ANOTHER ?t=Date.now()
          // here on every single page load defeated that: the URL
          // became different on every render, so the browser could
          // never cache the image at all, even when it hadn't
          // actually changed since the last visit. Using the stored
          // URL as-is lets the browser cache it normally between
          // visits, while still busting the cache correctly the
          // moment a real new upload happens (a new value arrives from
          // the server, not a client-invented one).
          const normalizedUser = {
            ...data.user,
            avatar: data.user.avatar || null,
            cover: data.user.cover || null,
          };

          // A player who hasn't finished their own "set up your
          // profile" step yet has a real name (captured at
          // registration) but no real player_profiles row - showing
          // DEFAULT_PLAYER_PROFILE's specific placeholder values
          // (Sydney NSW, Intermediate, Bondi Beach/Manly, the canned
          // bio) here would make them look like real choices this
          // person made, which they never did. Honest neutral
          // placeholders instead - only used for someone ELSE'S
          // incomplete profile, never for editing your own (the
          // "complete profile" flow handles that separately).
          const isIncomplete = !normalizedUser.profileCompleted;
          setProfileSetupIncomplete(isIncomplete);

          setProfile({
            ...DEFAULT_PLAYER_PROFILE,
            name: normalizedUser.name,
            avatar: normalizedUser.avatar || DEFAULT_PLAYER_PROFILE.avatar,
            cover: normalizedUser.cover || DEFAULT_PLAYER_PROFILE.cover,
            createdAt: data.user.createdAt,
            location: data.profile?.location || (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.location),
            age: data.profile?.age || (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.age),
            country: data.profile?.country || (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.country),
            skillLevel: data.profile?.skillLevel || (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.skillLevel),
            bio: data.profile?.bio || (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.bio),
            preferredCourts:
              data.profile?.preferredCourts ||
              (isIncomplete ? [] : DEFAULT_PLAYER_PROFILE.preferredCourts),
            phone: data.profile?.phone ?? "",
            email: data.profile?.email ?? "",
            sex: data.profile?.sex ?? "",
            lookingFor: data.profile?.lookingFor ?? [],
            gameFormat: data.profile?.gameFormat || (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.gameFormat),
            playStyle: data.profile?.playStyle || (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.playStyle),
            availability: data.profile?.availability ?? [],
            playRadiusKm: data.profile?.playRadiusKm ?? DEFAULT_PLAYER_PROFILE.playRadiusKm,
            courtSurfacePreference:
              data.profile?.courtSurfacePreference ||
              (isIncomplete ? "" : DEFAULT_PLAYER_PROFILE.courtSurfacePreference),
            playingHand: data.profile?.playingHand || "",
            availabilityStatus: data.profile?.availabilityStatus || "",
            photos: data.profile?.photos ?? [],
          });

          setProfileData(data.profile || null);
          setProfileIsOrganizer(!!data.user.isOrganizer);
          setPlayerUserId(data.user.id);
          setProfileNotFound(false);

          /* ===== PUBLIC TOURNAMENTS + MARKETPLACE (parallel - neither
             depends on the other, only on data.user.id from the fetch
             above, but they were previously awaited one after another,
             tripling this part of the wait for no reason) ===== */
          const [tournamentsRes, marketplaceRes] = await Promise.all([
            fetch(`/api/profile/tournament-history?userId=${data.user.id}`),
            fetch(`/api/profile/marketplace/public/${data.user.id}`),
          ]);
          if (!tournamentsRes.ok) {
            console.error("❌ tournaments fetch failed", tournamentsRes.status);
          } else {
            const tournamentsData = await tournamentsRes.json();
            setTournaments(tournamentsData);
          }
          if (marketplaceRes.ok) {
            setMarketplaceItems(await marketplaceRes.json());
          }

        } catch (err) {
          console.error("Public profile load failed", err);
          // Try to find in demo data
          const demoPlayer = PARTNERS_DATA.find(p => p.slug === profileSlug);
          if (demoPlayer) {
            setProfile({
              ...DEFAULT_PLAYER_PROFILE,
              name: demoPlayer.name,
              avatar: demoPlayer.avatar,
              location: demoPlayer.location,
              //age: demoPlayer.age,
              //country: demoPlayer.country,
              skillLevel: demoPlayer.skillLevel,
              bio: demoPlayer.bio,
              //preferredCourts: demoPlayer.courts || [],
            });
            setIsDemo(true);
          } else {
            // No real account and no demo match - this is a genuinely
            // missing/not-yet-public profile (most commonly: someone
            // registered but hasn't finished their profile yet, which
            // GET /api/players/:slug 404s on by design). Showing
            // DEFAULT_PLAYER_PROFILE's placeholder content here would
            // otherwise look exactly like a real account with a name
            // of "New Player" and fabricated stats.
            setProfileNotFound(true);
          }
        } finally {
          setLoading(false);
        }
      };

      loadPublicProfile();
    }, [profileSlug]);
      
  const handleContactSubmit = async () => {
    const validation = messageSchema.safeParse({
      subject: contactSubject,
      message: contactMessage,
      phone: contactPhone,
    });

    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: validation.error.errors[0].message,
      });
      return;
    }

    if (!playerUserId) {
      toast({
        variant: "destructive",
        title: "Player not found",
      });
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: playerUserId,
          recipientType: "player",
          subject: contactSubject,
          phone: contactPhone,
          content: contactMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to send");
      }

      toast({
        title: "Message sent",
        description: "The player will receive your message shortly.",
      });

      // GA4 "send_message" - same event as the coach/player contact
      // forms elsewhere, distinguished by context.
      (window as any).gtag?.("event", "send_message", { context: "player_contact" });

      setContactSubject("");
      setContactMessage("");
      setContactPhone("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send message",
        description: error.message || "Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Partial save for the redesigned Overview cards (About Me, Looking
  // For, Playing Preferences) - each field on playerProfileUpdateSchema
  // is optional, so a PUT with just the changed keys is a real, safe
  // partial update, not a mock. Updates local state only on success -
  // an optimistic update here could show a value that never actually
  // saved.
  const saveProfileFields = async (fields: Partial<PlayerProfile>) => {
    try {
      const res = await fetch("/api/me/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      setProfile((prev) => ({ ...prev, ...fields }));
      toast({ title: "Saved" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/me/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          location: profile.location,
          age: profile.age,
          country: profile.country,
          skillLevel: profile.skillLevel,
          bio: profile.bio,
          preferredCourts: profile.preferredCourts,
          sex: profile.sex,
          playingHand: profile.playingHand,
          availabilityStatus: profile.availabilityStatus,
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update profile");

      const updatedProfile = await res.json();
      setProfile(prev => ({
        ...prev,
        ...updatedProfile,
      }));
      //await fetchCurrentUser();
      setIsEditing(false);

      toast({
        title: "Profile Updated",
        description: "Your changes have been saved.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile",
      });
    }
  };

  const handleSaveItem = async () => {
    const isEdit = Boolean(newItem.id);

    const url = isEdit
      ? `/api/profile/marketplace/${newItem.id}`
      : `/api/profile/marketplace`;

    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: newItem.name,
        price: newItem.price,
        condition: newItem.condition,
        description: newItem.description,
        location: newItem.location,
      }),
    });

    if (!res.ok) throw new Error("Save failed");

    const savedItem = await res.json();

    /* 🔥 ЗАГРУЖАЕМ ФОТО ДЛЯ НОВОГО ТОВАРА */
    if (!isEdit && newItem.files?.length) {
      for (const file of newItem.files.slice(0, 3)) {
        const formData = new FormData();
        formData.append("file", file);

        await fetch(
          `/api/profile/marketplace/${savedItem.id}/photos`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );
      }
    }

    /* 🔥 РЕФЕТЧ ПОСЛЕ ВСЕГО */
    const refreshed = await fetch(`/api/profile/marketplace`, {
      credentials: "include",
    });

    setMarketplaceItems(await refreshed.json());

    // очищаем форму
    setNewItem({
      id: "",
      name: "",
      price: "",
      description: "",
      condition: "Used - Good",
      location: "",
      photos: [],
      files: [],
    });

    setIsItemModalOpen(false);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/profile/marketplace/${id}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to delete item");
      
      setMarketplaceItems(prev => prev.filter(item => item.id !== id));
      toast({ title: "Item Deleted", description: "Your item has been removed." });
    } catch (error) {
      console.error("Failed to delete item", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete marketplace item"
      });
    }
  };

  /* ======================
   TOURNAMENTS (CRUD + PHOTOS)
   ====================== */  
  const handleSaveTournament = async () => {
  const editingTournamentId = editingTournament?.id ?? null;
  const isEdit = Boolean(editingTournamentId); 

  const url = isEdit
    ? `/api/profile/tournament-history/${editingTournamentId}`
    : `/api/profile/tournament-history`;

  const res = await fetch(url, {
    method: isEdit ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: newTournament.name,
      location: newTournament.location,
      date: newTournament.date,
      result: newTournament.result,
      award: newTournament.award,
    }),
    credentials: "include",
  });

  const saved = await res.json();

  setTournaments(prev =>
    prev.some(t => t.id === saved.id)
      ? prev.map(t => (t.id === saved.id ? saved : t))
      : [...prev, saved]
  );

  if (isEdit) {
    setIsTournamentModalOpen(false);
    resetTournamentForm();
    toast({ title: "Tournament updated" });
  } else {
    setNewTournament(saved); // ⬅️ теперь есть id
    setEditingTournament(saved);
    toast({ title: "Tournament created. Upload photos." });
  }
  };

  const handleTournamentPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user || !newTournament.id) return;

    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 5 - (newTournament.photos?.length ?? 0);
    const filesToUpload = files.slice(0, remaining);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `/api/profile/tournament-history/${newTournament.id}/photos`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );

        if (!res.ok) {
          throw new Error("Upload failed");
        }

        /**
         * ✅ backend возвращает ОБНОВЛЁННЫЙ турнир из БД
         * { id, name, ..., photos: string[] }
         */
        const updatedTournament = await res.json();

        // ✅ обновляем форму (модалка)
        setNewTournament(updatedTournament);

        // ✅ обновляем список турниров
        setTournaments(prev =>
          prev.map(t =>
            t.id === updatedTournament.id ? updatedTournament : t
          )
        );

      } catch (err) {
        console.error("Tournament image upload failed", err);
      }
    }

    // reset input (важно, чтобы можно было загрузить тот же файл снова)
    e.target.value = "";
  };
        
  const removeTournamentPhoto = async (index: number) => {
    if (!newTournament.id) return;

      const res = await fetch(
      `/api/profile/tournament-history/${newTournament.id}/photos/${index}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!res.ok) {
      toast({ variant: "destructive", title: "Failed to remove photo" });
      return;
    }

    const updatedTournament = await res.json();

    // обновляем форму
    setNewTournament(updatedTournament);

    // обновляем список
    setTournaments(prev =>
      prev.map(t =>
        t.id === updatedTournament.id ? updatedTournament : t
      )
    );
  };
 
  const resetTournamentForm = () => {
    setNewTournament({
      id: "",
      name: "",
      location: "",
      date: "",
      result: "",
      award: "",
      photos: [],
      entryType: "tournament",
    });
    setEditingTournament(null);
    setResultInputMode("sets");
  };

  const handledeleteTournamentHistory = async (id: string) => {
    const res = await fetch(
      `/api/profile/tournament-history/${id}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!res.ok) throw new Error("Delete failed");

    // ❗️после delete — сразу рефетч или обновление state
    setTournaments(prev => prev.filter(t => t.id !== id));
  };

 const handleDeletePhoto = async (photoUrl: string) => {
    // Optimistic - removes it from view immediately, restores it if the
    // request actually fails.
    const previousPhotos = profile.photos || [];
    setProfile((prev) => ({ ...prev, photos: previousPhotos.filter((p) => p !== photoUrl) }));
    try {
      const res = await fetch("/api/me/player-profile/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) throw new Error("Failed to delete photo");
    } catch (err) {
      setProfile((prev) => ({ ...prev, photos: previousPhotos }));
      toast({
        variant: "destructive",
        title: "Couldn't delete photo",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

 const handleGalleryPhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/me/player-profile/photos", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to upload photo");
      }
      const updatedProfile = await res.json();
      setProfile((prev) => ({ ...prev, photos: updatedProfile.photos || [] }));
      toast({ title: "Photo added" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      e.target.value = "";
    }
  };

 const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "avatar" | "cover"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      // Resized client-side (square crop for avatar, wide crop for
      // cover) before upload - through the same helper coach-profile.tsx
      // uses for the identical flow, see uploadImage.ts.
      const data = await uploadMedia(field, file);

      const { url: imageUrl, user: updatedUserObject } = data;

      setProfile(prev => ({
        ...prev,
        [field]: imageUrl,
      }));
      
      updateUserLocal(updatedUserObject);

      toast({
        title: "Photo updated",
        description: `${field} updated successfully`,
      });

    } catch (err) {
      
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      e.target.value = "";
    }
  };

  if (!loading && profileNotFound) {
    return (
      <div className="min-h-screen bg-background font-sans flex flex-col">
        <SEO title="Player not found | TennisConnect" description="This player's profile isn't available." noIndex />
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24" data-testid="player-profile-not-found">
          <User className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-semibold text-lg">This profile isn't available</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This player may not have finished setting up their profile yet, or the link may be incorrect.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => setLocation("/players")} data-testid="player-profile-not-found-back">
            Browse Players
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${profile.name} | TennisConnect`}
        description={
          profile.bio ||
          `Tennis player from ${profile.location}`
        }
        canonical={`/player/${profileSlug}`}
      />
        <div className="min-h-screen bg-background font-sans relative pb-20">
          <div 
            className="fixed inset-0 z-0 pointer-events-none opacity-[0.15]" 
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
              mixBlendMode: 'multiply'
            }}
          />         
          <div className="relative z-10">
            <Navbar />
            <main id="main-content">
            
            <input
              type="file"
              id="avatar-upload"
              className="hidden"
              accept="image/*"
              data-testid="avatar-upload"
              onChange={(e) => handleFileChange(e, "avatar")}
            />

            <input
              type="file"
              id="cover-upload"
              className="hidden"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "cover")}
              data-testid="cover-upload"
            />

            <input
              type="file"
              id="player-photo-upload"
              className="hidden"
              accept="image/*"
              onChange={handleGalleryPhotoChange}
              data-testid="player-photo-upload"
            />

            {loading ? (
              <Skeleton
                className="w-full h-[280px] sm:h-[300px] md:h-[380px] lg:h-[460px] rounded-t-3xl"
                data-testid="player-cover-skeleton"
              />
            ) : (
              <ProfileCover
                  cover={profile.cover}
                  defaultCover={defaultPlayerCover}
                  defaultCoverMobile={defaultPlayerCoverMobile}
                  isOwner={isOwnProfile}
                  onEdit={() =>
                      document.getElementById("cover-upload")?.click()
                  }
              />
            )}
            <div className="container mx-auto px-4 -mt-20 relative z-30 max-w-6xl">
            
            {loading ? (
              <div
                className="relative"
                data-testid="player-hero-skeleton"
              >
                <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md shadow-lg pt-28 sm:pt-28 md:pt-8 pb-5 sm:pb-7 md:pb-8 px-4 sm:px-5 md:px-8 md:pl-56">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <Skeleton className="w-16 h-16 md:w-20 md:h-20 rounded-full shrink-0" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-6 md:h-8 w-48" />
                      <Skeleton className="h-4 w-64 max-w-full" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2 md:gap-4 mt-8">
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                    <Skeleton className="h-16 md:h-20 rounded-xl" />
                  </div>
                </div>
              </div>
            ) : (
            <PlayerHero
                profile={profile}
                tournaments={tournaments}
                isEditing={isEditing}
                isOwnProfile={isOwnProfile}
                setProfile={setProfile}
                onAvatarEdit={() =>
                    document.getElementById("avatar-upload")?.click()
                }
                onEdit={() => {
                  setOriginalProfile(profile);
                  setIsEditing(true);
                }}
                onCancel={() => {
                  setProfile(originalProfile);
                  setIsEditing(false);
                }}
                onSave={handleSave}
             />
            )}
              {!loading && profileSetupIncomplete && !isOwnProfile && (
                <div
                  className="mt-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
                  data-testid="player-profile-setup-incomplete-banner"
                >
                  {profile.name} is still setting up their profile - some details aren't available yet.
                </div>
              )}
              {loading ? (
                <div className="mt-12 space-y-4" data-testid="player-tabs-skeleton">
                  <div className="flex gap-4">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                  <Skeleton className="h-40 w-full rounded-2xl" />
                  <Skeleton className="h-40 w-full rounded-2xl" />
                </div>
              ) : (
              <Tabs defaultValue={initialTab} className="mt-4 space-y-1">
                <TabsList className="w-full
                      flex
                      overflow-x-auto
                      whitespace-nowrap
                      justify-start
                      border-b
                      rounded-none
                      h-auto
                      p-0
                      bg-transparent
                      gap-2
                      scrollbar-hide">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><User className="w-4 h-4" />Overview</TabsTrigger>
                  <TabsTrigger value="sessions" data-testid="my-sessions-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><Trophy className="w-4 h-4" />My Sessions</TabsTrigger>
                  <TabsTrigger value="courts" data-testid="my-courts-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><Heart className="w-4 h-4" />My Courts</TabsTrigger>
                  {/* Results is owner-only in the redesign - a visitor's
                      profile view no longer shows this tab at all. */}
                  {isOwnProfile && (
                    <TabsTrigger value="results" data-testid="my-results-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><Award className="w-4 h-4" />Results</TabsTrigger>
                  )}
                  {showOrganisingTab && (
                    <TabsTrigger value="organizing" data-testid="my-organized-sessions-tab" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><ClipboardList className="w-4 h-4" />Organising</TabsTrigger>
                  )}
                  {/* Selling tab hidden for now, per request - marketplace items still exist in marketplaceItems if this needs to come back */}
                  {/* <TabsTrigger value="marketplace" className="data-[state=active]:bg-primary/10 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 md:px-4 py-3 text-sm md:text-base gap-1.5"><ShoppingBag className="w-4 h-4" />Selling ({marketplaceItems.length})</TabsTrigger> */}
                </TabsList>

                <TabsContent value="overview" className="space-y-2.5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                    {/* Main column */}
                    <div className="lg:col-span-2 space-y-2">
                      <AboutMeCard
                        bio={profile.bio}
                        isOwner={isOwnProfile}
                        onSave={(bio) => saveProfileFields({ bio })}
                      />
                      <LookingForCard
                        data={{ tags: profile.lookingFor || [] }}
                        isOwner={isOwnProfile}
                        onSave={(data) => saveProfileFields({ lookingFor: data.tags })}
                      />
                      <PlayingPreferencesCard
                        data={{
                          skillLevel: profile.skillLevel,
                          preferredCourts: profile.preferredCourts,
                          gameFormat: profile.gameFormat || "",
                          playStyle: profile.playStyle || "",
                          availability: profile.availability || [],
                          playRadiusKm: profile.playRadiusKm ?? 15,
                          courtSurfacePreference: profile.courtSurfacePreference || "",
                        }}
                        isOwner={isOwnProfile}
                        onSave={(data) => saveProfileFields(data)}
                      />
                      {isOwnProfile && (
                        <PhotosCard
                          photos={profile.photos || []}
                          isOwner={isOwnProfile}
                          onAddPhoto={() => document.getElementById("player-photo-upload")?.click()}
                          onDeletePhoto={handleDeletePhoto}
                        />
                      )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-2">
                      {/* Visitors get the photo gallery here instead of
                          in the main column - makes better use of this
                          column's space, and keeps the main column
                          focused on About/Looking For/Playing
                          Preferences for a guest. Owners still manage
                          photos in the main column above, alongside
                          everything else they edit. */}
                      {!isOwnProfile && (
                        <PhotosCard
                          photos={profile.photos || []}
                          isOwner={false}
                        />
                      )}
                      {!isOwnProfile && viewerProfile && (() => {
                        const match = computeMatchScore(viewerProfile, {
                          skillLevel: profile.skillLevel,
                          availability: profile.availability,
                          preferredCourts: profile.preferredCourts,
                          gameFormat: profile.gameFormat,
                          lookingFor: profile.lookingFor,
                        });
                        return (
                          <GoodMatchCard
                            percent={match.percent}
                            reasons={match.reasons}
                            onSuggestGame={() => {
                              setMessageModalDefaultText(
                                `Hi ${profile.name.split(" ")[0]}, want to play a match sometime?`
                              );
                              setMessageModalOpen(true);
                            }}
                          />
                        );
                      })()}
                      <AvailabilityQuickCard availability={profile.availability || []} isOwner={isOwnProfile} />
                      {isOwnProfile && <LatestActivityCard items={mockActivity} />}
                      {isOwnProfile && organizerStatus.data && (
                        <BecomeOrganizerCard
                          status={organizerStatus.data}
                          onChange={() => organizerStatus.refresh()}
                        />
                      )}
                    </div>
                  </div>

                  {!isOwnProfile && (
                    <PlayerBottomCTA
                      name={profile.name.split(" ")[0] || profile.name}
                      onInvite={() => {
                        setMessageModalDefaultText(
                          `Hi ${profile.name.split(" ")[0]}, I'd love to invite you to play sometime!`
                        );
                        setMessageModalOpen(true);
                      }}
                      onMessage={() => {
                        setMessageModalDefaultText("");
                        setMessageModalOpen(true);
                      }}
                    />
                  )}
                </TabsContent>

                <TabsContent value="courts" className="space-y-6" data-testid="my-courts-tab-content">
                  <MyClubsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} mode="courts" />
                </TabsContent>

                <TabsContent value="sessions" className="space-y-6" data-testid="my-sessions-tab-content">
                  <Tabs defaultValue="regular">
                    <TabsList>
                      <TabsTrigger value="regular" data-testid="my-sessions-type-regular">Sessions</TabsTrigger>
                      <TabsTrigger value="tournament" data-testid="my-sessions-type-tournament">
                        <Trophy className="w-4 h-4 mr-1.5" />
                        Tournaments
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="regular" className="mt-2">
                      <Tabs defaultValue="upcoming">
                        <TabsList>
                          <TabsTrigger value="upcoming" data-testid="my-sessions-regular-subtab-upcoming">Upcoming</TabsTrigger>
                          <TabsTrigger value="history" data-testid="my-sessions-regular-subtab-history">History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upcoming" className="mt-2">
                          <MySessionsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} excludeTypes={TOURNAMENT_TYPES} timeframe="upcoming" />
                        </TabsContent>
                        <TabsContent value="history" className="mt-2">
                          <MySessionsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} excludeTypes={TOURNAMENT_TYPES} timeframe="past" />
                        </TabsContent>
                      </Tabs>
                    </TabsContent>

                    <TabsContent value="tournament" className="mt-2">
                      <Tabs defaultValue="upcoming">
                        <TabsList>
                          <TabsTrigger value="upcoming" data-testid="my-sessions-subtab-upcoming">Upcoming</TabsTrigger>
                          <TabsTrigger value="history" data-testid="my-sessions-subtab-history">History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upcoming" className="mt-2">
                          <MySessionsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} sessionTypes={TOURNAMENT_TYPES} timeframe="upcoming" />
                        </TabsContent>
                        <TabsContent value="history" className="mt-2">
                          <MySessionsSection isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} sessionTypes={TOURNAMENT_TYPES} timeframe="past" />
                        </TabsContent>
                      </Tabs>
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                    <TabsContent value="results" className="space-y-8" data-testid="my-results-tab-content">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Results</h3>
                    {isOwnProfile && (
                      <Dialog
                        open={isTournamentModalOpen}
                        onOpenChange={(open) => {
                          setIsTournamentModalOpen(open);
                          if (!open) resetTournamentForm();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button data-testid="add-result-button"><Plus className="w-4 h-4 mr-2" /> Add Result</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Add Result</DialogTitle>
                            <DialogDescription>
                              Record a result from a tournament, session, or match — including ones played
                              outside TennisConnect. Not every organiser runs their sessions through here yet.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <div className="flex gap-1.5">
                                <Button
                                  type="button"
                                  variant={newTournament.entryType === "session" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setNewTournament({ ...newTournament, entryType: "session" })}
                                  data-testid="result-type-session"
                                >
                                  Session
                                </Button>
                                <Button
                                  type="button"
                                  variant={newTournament.entryType === "tournament" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setNewTournament({ ...newTournament, entryType: "tournament" })}
                                  data-testid="result-type-tournament"
                                >
                                  Tournament
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input 
                                value={newTournament.name} 
                                onChange={(e) => setNewTournament({...newTournament, name: e.target.value})} 
                                placeholder="e.g. Sydney Open 2024, or Saturday Social Tennis"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Date</Label>
                                <Input 
                                  type="date"
                                  value={newTournament.date} 
                                  onChange={(e) => setNewTournament({...newTournament, date: e.target.value})} 
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Location</Label>
                                <Input 
                                  value={newTournament.location} 
                                  onChange={(e) => setNewTournament({...newTournament, location: e.target.value})} 
                                  placeholder="e.g. Homebush" 
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Result</Label>
                                <Select
                                  value={
                                    PRESET_RESULTS.includes(newTournament.result)
                                      ? newTournament.result
                                      : newTournament.result || resultInputMode !== "text"
                                      ? resultInputMode === "sets"
                                        ? "Sets"
                                        : resultInputMode === "points"
                                        ? "Points"
                                        : "Custom"
                                      : ""
                                  }
                                  onValueChange={(val) => {
                                    if (val === "Sets") {
                                      setResultInputMode("sets");
                                      setNewTournament({ ...newTournament, result: "" });
                                    } else if (val === "Points") {
                                      setResultInputMode("points");
                                      setNewTournament({ ...newTournament, result: "" });
                                    } else if (val === "Custom") {
                                      setResultInputMode("text");
                                      setNewTournament({ ...newTournament, result: "" });
                                    } else {
                                      setNewTournament({ ...newTournament, result: val });
                                    }
                                  }}
                                >
                                  <SelectTrigger data-testid="result-preset-select">
                                    <SelectValue placeholder="Select Result" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Winner">Winner</SelectItem>
                                    <SelectItem value="Runner Up">Runner Up</SelectItem>
                                    <SelectItem value="Semi-Finalist">Semi-Finalist</SelectItem>
                                    <SelectItem value="Quarter-Finalist">Quarter-Finalist</SelectItem>
                                    <SelectItem value="Round of 16">Round of 16</SelectItem>
                                    <SelectItem value="Round of 32">Round of 32</SelectItem>
                                    <SelectItem value="Participation">Participation</SelectItem>
                                    <SelectItem value="Sets">Score by sets</SelectItem>
                                    <SelectItem value="Points">Total points (e.g. Americano)</SelectItem>
                                    <SelectItem value="Custom">Custom (free text)</SelectItem>
                                  </SelectContent>
                                </Select>
                                {![...PRESET_RESULTS, ""].includes(newTournament.result) && (
                                  <div className="mt-2 space-y-2">
                                    <div className="flex gap-1.5 flex-wrap">
                                      <Button
                                        type="button"
                                        variant={resultInputMode === "sets" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setResultInputMode("sets")}
                                        data-testid="result-mode-sets"
                                      >
                                        By sets
                                      </Button>
                                      <Button
                                        type="button"
                                        variant={resultInputMode === "points" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setResultInputMode("points")}
                                        data-testid="result-mode-points"
                                      >
                                        Total points
                                      </Button>
                                      <Button
                                        type="button"
                                        variant={resultInputMode === "text" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setResultInputMode("text")}
                                        data-testid="result-mode-text"
                                      >
                                        Free text
                                      </Button>
                                    </div>
                                    {resultInputMode === "sets" ? (
                                      <SetScoreBuilder
                                        value={newTournament.result}
                                        onChange={(val) => setNewTournament((prev) => ({ ...prev, result: val }))}
                                      />
                                    ) : resultInputMode === "points" ? (
                                      <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">
                                          One number for the whole session - across all rounds and partners, not per round.
                                        </p>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={newTournament.result.replace(/\D/g, "")}
                                          onChange={(e) => setNewTournament({ ...newTournament, result: e.target.value ? `${e.target.value} points` : "" })}
                                          placeholder="e.g. 24"
                                          data-testid="result-points-input"
                                        />
                                      </div>
                                    ) : (
                                      <Input
                                        value={newTournament.result}
                                        onChange={(e) => setNewTournament({ ...newTournament, result: e.target.value })}
                                        placeholder="e.g. Won 3-1, or Won by retirement"
                                        data-testid="result-custom-input"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label>Award/Prize (Optional)</Label>
                                <Input 
                                  value={newTournament.award} 
                                  onChange={(e) => setNewTournament({...newTournament, award: e.target.value})} 
                                  placeholder="e.g. Gold Trophy" 
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>
                                Photos (Max 5)
                                {!newTournament.id && (
                                  <span className="text-xs text-muted-foreground block">
                                    Save first to upload photos
                                  </span>
                                )}
                              </Label>
                              <div className="flex flex-wrap gap-4">
                                {newTournament.photos.map((photo, index) => (
                                  <div key={index} className="relative w-20 h-20 group">
                                    <img src={photo} alt={`Upload ${index}`} className="w-full h-full object-cover rounded-md border" />
                                    <button 
                                      onClick={() => removeTournamentPhoto(index)}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                {newTournament.photos.length < 5 && (
                                  <label
                                    className={`
                                      w-20 h-20 border-2 border-dashed rounded-md flex flex-col items-center justify-center
                                      transition-colors
                                      ${
                                        newTournament.id
                                          ? "cursor-pointer hover:bg-muted/50 border-muted-foreground/30"
                                          : "cursor-not-allowed opacity-50 border-muted-foreground/20"
                                      }
                                    `}
                                  >
                                    <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                                    <span className="text-[10px] text-muted-foreground">Add Photo</span>
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      multiple 
                                      className="hidden"
                                      disabled={!newTournament.id} 
                                      onChange={handleTournamentPhotoUpload}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSaveTournament}>{editingTournament ? "Update Entry" : "Save Entry"}</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  {/* Tournament Lists */}
                  <div className="flex gap-1.5" data-testid="results-filter">
                    <Button
                      type="button"
                      variant={resultsFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setResultsFilter("all")}
                      data-testid="results-filter-all"
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant={resultsFilter === "session" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setResultsFilter("session")}
                      data-testid="results-filter-session"
                    >
                      Sessions
                    </Button>
                    <Button
                      type="button"
                      variant={resultsFilter === "tournament" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setResultsFilter("tournament")}
                      data-testid="results-filter-tournament"
                    >
                      Tournaments
                    </Button>
                  </div>
                  {(() => {
                    const sortedTournaments = [...tournaments]
                      .filter((t) => resultsFilter === "all" || t.entryType === resultsFilter)
                      .sort((a, b) => {
                      // Sort descending by date
                      return new Date(b.date).getTime() - new Date(a.date).getTime();
                    });

                    const TournamentCard = ({ t }: { t: any }) => (
                      <Card key={t.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex flex-col md:flex-row">
                            {/* Image Gallery Column - Only if photos exist */}
                            {t.photos && t.photos.length > 0 && (
                              <div className="w-full md:w-48 h-48 md:h-auto shrink-0 bg-muted relative">
                                <img src={t.photos[0]} alt={t.name} className="w-full h-full object-cover" />
                                {t.photos.length > 1 && (
                                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                                    +{t.photos.length - 1} more
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Content Column */}
                            <div className="grow p-6 flex flex-col justify-between">
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-xl">{t.name}</h4>
                                      <Badge variant="outline" className="text-[11px]" data-testid={`result-type-badge-${t.id}`}>
                                        {t.entryType === "session" ? "Session" : "Tournament"}
                                      </Badge>
                                      {(t.result === 'Winner' || t.result === 'Champion') && (
                                          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1 pl-1 pr-2">
                                            <Trophy className="w-3 h-3 fill-current" /> Winner
                                          </Badge>
                                      )}
                                      {(t.result === 'Finalist' || t.result === 'Runner-up') && (
                                          <Badge variant="secondary" className="bg-slate-300 text-slate-800 gap-1 pl-1 pr-2">
                                            <Trophy className="w-3 h-3" /> Finalist
                                          </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(t.date).toLocaleDateString()}</div>
                                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {t.location}</div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-right">
                                      <div className="font-bold text-primary text-lg">{t.result}</div>
                                      {t.award && <div className="text-sm text-muted-foreground">{t.award}</div>}
                                    </div>
                                    {isOwnProfile && (
                                      
                                      <div className="flex gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          setNewTournament(t);
                                          setEditingTournament(t);
                                          setResultInputMode(looksLikePoints(t.result) ? "points" : looksLikeSetScore(t.result) ? "sets" : "text");
                                          setIsTournamentModalOpen(true);
                                        }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>

                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handledeleteTournamentHistory(t.id)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    )}
                                </div>
                              </div>
                              
                              {/* Photo Preview Strip (if more than 1 photo) */}
                              {t.photos && t.photos.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 pt-2 border-t mt-2">
                                  {t.photos.map((photo: string, i: number) => (
                                    <div key={i} className="w-12 h-12 rounded-md overflow-hidden shrink-0 border bg-muted cursor-pointer hover:opacity-80 transition-opacity">
                                      <img src={photo} className="w-full h-full object-cover" alt={`Gallery ${i}`} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );

                    return (
                      <div className="space-y-4">
                        {sortedTournaments.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed" data-testid="results-empty">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>
                              {tournaments.length === 0
                                ? "No results added yet."
                                : resultsFilter === "session"
                                ? "No session results yet."
                                : "No tournament results yet."}
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4">
                            {sortedTournaments.map(t => <TournamentCard key={t.id} t={t} />)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                    </TabsContent>

                {showOrganisingTab && (
                  <TabsContent value="organizing" className="space-y-8" data-testid="my-organized-sessions-tab-content">
                    <MyOrganizedSessionsSection isOwnProfile={isOwnProfile} profileSlug={profileSlug} />
                  </TabsContent>
                )}

                {/* Selling tab content hidden for now, per request */}
                {false && (
                <TabsContent value="marketplace" className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">My Items for Sale</h3>
                    {isOwnProfile && (
                      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                        <DialogTrigger asChild>
                          <Button><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Sell an Item</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Item Name</Label>
                              <Input 
                                value={newItem.name} 
                                onChange={(e) => setNewItem({...newItem, name: e.target.value})} 
                                placeholder="e.g. Wilson Racket" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Price (AUD)</Label>
                              <Input 
                                value={newItem.price} 
                                onChange={(e) => setNewItem({...newItem, price: e.target.value})} 
                                placeholder="e.g. 150" 
                                type="number" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Condition</Label>
                              <Select 
                                value={newItem.condition} 
                                onValueChange={(val) => setNewItem({...newItem, condition: val})}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="New">New</SelectItem>
                                  <SelectItem value="Like New">Like New</SelectItem>
                                  <SelectItem value="Used - Good">Used - Good</SelectItem>
                                  <SelectItem value="Used - Fair">Used - Fair</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea 
                                value={newItem.description} 
                                onChange={(e) => setNewItem({...newItem, description: e.target.value})} 
                                placeholder="Tell potential buyers about your item..." 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Location</Label>
                              <Input
                                value={newItem.location}
                                onChange={(e) =>
                                  setNewItem({ ...newItem, location: e.target.value })
                                }
                                placeholder="e.g. Sydney"
                              />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {newItem.photos.map((photo, i) => (
                                <div key={i} className="w-20 h-20 relative">
                                  <img
                                    src={photo}
                                    alt={`Uploaded photo ${i + 1}`}
                                    className="w-full h-full object-cover rounded"
                                  />
                                </div>
                              ))}

                              {newItem.photos.length < 3 && (
                                <label className="w-20 h-20 border-dashed border flex items-center justify-center cursor-pointer">
                                  +
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) =>
                                      setNewItem(prev => ({
                                        ...prev,
                                        files: Array.from(e.target.files || []),
                                      }))
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleSaveItem}>
                            {newItem.id ? "Update Item" : "List Item"}
                          </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {marketplaceItems.map(item => (
                      <Card key={item.id}>
                        <div className="aspect-square bg-muted relative">
                          <img src={item.photos?.[0]} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <CardHeader>
                          <CardTitle className="flex justify-between items-start text-lg">
                            <span>{item.title}</span>
                            <span className="text-primary">${item.price}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.description}</p>
                          <div className="flex justify-between items-center">
                            <Badge variant="outline">{item.condition}</Badge>
                            {isOwnProfile && (
                              <><Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setNewItem({
                                    id: item.id,
                                    name: item.title,
                                    price: item.price,
                                    description: item.description,
                                    condition: item.condition,
                                    location: item.location,
                                    photos: item.photos || [],
                                  });
                                  setIsItemModalOpen(true);
                                } }
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button><Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-4 h-4" />
                                </Button></>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {marketplaceItems.length === 0 && (
                      <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>You haven't listed any items yet.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                )}
              </Tabs>
              )}

              {!isOwnProfile && playerUserId && (
                <QuickMessageModal
                  open={messageModalOpen}
                  onOpenChange={setMessageModalOpen}
                  recipient={{ id: playerUserId, name: profile.name, type: "player" }}
                  defaultMessage={messageModalDefaultText}
                />
              )}
            </div>
            </main>
          </div>
        </div>
        <Footer />
    </>
  );
 }

